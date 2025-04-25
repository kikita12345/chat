package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"messenger/config"
	"messenger/database"
	"messenger/logger"
	"messenger/middleware"
	"messenger/models"
	"messenger/redis"
	"messenger/utils/crypto"
)

// Upgrader для WebSocket соединений
var upgrader = &websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// В продакшне здесь нужна проверка Origin
		return true // Для разработки разрешаем все соединения
	},
}

// Структура сервера API
type Server struct {
	router *gin.Engine
	config *config.Config
	db     *database.Database
	redis  *redis.RedisClient

	configLock sync.RWMutex

	// Управление клиентами WebSocket
	clients map[uint]*Client
	mu      sync.Mutex

	// Для graceful shutdown
	httpServer *http.Server

	// Добавляем поле wsClients
	wsClients sync.Map
}

// Config содержит настройки сервера
type Config struct {
	Port      string
	JWTSecret string
	Debug     bool
}

// Создание нового сервера
func NewServer(cfg *config.Config, db *database.Database) *Server {
	// Инициализация криптографического модуля для шифрования данных на сервере
	if err := crypto.InitCrypto(); err != nil {
		log.Fatalf("Ошибка инициализации криптографического модуля: %v", err)
	}

	// Настраиваем режим Gin в зависимости от настроек
	if cfg.Server.Debug {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Инициализация Redis, если он включен в конфигурации
	var redisClient *redis.RedisClient
	var err error

	logger.Info("Инициализация Redis")
	redisClient, err = redis.NewRedisClient(cfg)
	if err != nil {
		logger.Warnf("Ошибка подключения к Redis: %v. Работа без Redis.", err)
		// Не выходим, продолжаем без Redis
	}

	server := &Server{
		router:  router,
		config:  cfg,
		db:      db,
		clients: make(map[uint]*Client),
		redis:   redisClient,
	}

	// Настройка middleware
	logger.Debug("Настройка CORS middleware")
	router.Use(middleware.CORS())

	// Защита от брутфорса
	logger.Info("Настройка защиты от брутфорса")
	authLimiter := middleware.NewAuthLimiter(5, 15*time.Minute, 30*time.Minute)
	router.Use(authLimiter.Middleware())
	// Запускаем периодическую очистку устаревших блокировок
	authLimiter.Cleanup(1 * time.Hour)

	// Настройка маршрутов
	logger.Debug("Настройка маршрутов API")
	server.setupRoutes()

	// Проверка и автоматическая инициализация системы при запуске
	server.initializeSystemIfNeeded()

	// Если Redis включен, настраиваем подписку на сообщения
	if redisClient != nil && redisClient.IsEnabled() {
		logger.Info("Настройка подписок Redis")
		if err := server.setupRedisSubscriptions(); err != nil {
			logger.Errorf("Ошибка настройки подписок Redis: %v", err)
		}
	}

	logger.Info("Сервер успешно инициализирован")
	return server
}

// Настройка подписок Redis
func (s *Server) setupRedisSubscriptions() error {
	if s.redis == nil || !s.redis.IsEnabled() {
		logger.Warn("Redis отключен, пропуск настройки подписок")
		return nil
	}

	// Обработчик сообщений из Redis
	s.redis.Subscribe(func(message redis.PubSubMessage) {
		s.handleRedisMessage(message)
	})

	// Подписываемся на глобальный канал
	go s.subscribeToGlobalChannel()

	logger.Info("Redis подписки настроены успешно")
	return nil
}

// Обработка сообщений из Redis
func (s *Server) handleRedisMessage(msg redis.PubSubMessage) {
	// Пропускаем сообщения к самому себе (если отправитель и получатель - один и тот же сервер)
	recipientID := msg.RecipientID

	s.mu.Lock()
	client, exists := s.clients[recipientID]
	s.mu.Unlock()

	if exists {
		ctx := map[string]interface{}{
			"message_type": msg.Type,
			"recipient_id": recipientID,
			"sender_id":    msg.SenderID,
		}

		logger.DebugWithContext(ctx, "Получено сообщение из Redis")

		// Формируем WebSocket сообщение
		wsMsg := WSMessage{
			Type:    msg.Type,
			Payload: msg.Content,
		}

		// Сериализуем сообщение
		data, err := json.Marshal(wsMsg)
		if err != nil {
			logger.ErrorWithContext(ctx, "Ошибка сериализации сообщения из Redis:", err)
			return
		}

		// Отправляем сообщение клиенту
		select {
		case client.send <- data:
			// Сообщение успешно отправлено
			logger.DebugWithContext(ctx, "Сообщение из Redis успешно отправлено клиенту")
		default:
			// Буфер клиента полон, закрываем соединение
			logger.WarnWithContext(ctx, "Буфер клиента полон, закрытие соединения")
			s.unregisterClient(client)
		}
	} else {
		logger.Debugf("Сообщение из Redis проигнорировано: клиент %d не найден", recipientID)
	}
}

// Подписка на глобальный канал Redis
func (s *Server) subscribeToGlobalChannel() {
	if s.redis == nil || !s.redis.IsEnabled() {
		return
	}

	// Создаем глобальный канал
	channel := redis.GlobalChannel
	logger.Infof("Подписка на глобальный канал: %s", channel)

	// Здесь можно добавить дополнительную логику для глобальных сообщений
}

// Настройка маршрутов API
func (s *Server) setupRoutes() {
	// Публичные маршруты
	public := s.router.Group("/api")
	{
		// Авторизация
		public.POST("/auth/login", s.handleLogin)
		public.POST("/register", s.handleRegister)

		// Проверка работы сервера
		public.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		// Скачивание файлов (публичный доступ по токену)
		public.GET("/files/download/:token", s.handleFileDownload)

		// WebSocket для чата и звонков (перемещен из защищенной группы)
		public.GET("/ws", s.handleWebSocket)
	}

	// Защищенные маршруты
	auth := s.router.Group("/api")
	auth.Use(middleware.JWTAuth(s.config.JWT.Secret))
	{
		// Проверка аутентификации
		auth.GET("/auth/check", s.handleAuthCheck)

		// Пользователи (доступ только админу - проверка внутри обработчиков)
		auth.GET("/users", s.handleGetUsers) // Может быть админским
		// TODO: Добавить PUT /users/:id и DELETE /users/:id, если нужно для админки
		auth.PUT("/users/:id", s.handleAdminUpdateUser)    // Добавлен обработчик обновления
		auth.DELETE("/users/:id", s.handleAdminDeleteUser) // Добавлен обработчик удаления

		// Список пользователей для чата (доступно всем авторизованным)
		auth.GET("/chat/users", s.handleGetChatUsers)

		// API для работы с чатами
		auth.GET("/chat", s.handleGetChats)
		auth.POST("/chat", s.handleCreateChat)
		auth.GET("/chat/:chatID", s.handleGetChat)
		auth.PUT("/chat/:chatID", s.handleUpdateChat)
		auth.POST("/chat/:chatID/leave", s.handleLeaveChat)
		auth.POST("/chat/:chatID/users", s.handleAddUserToChat)
		auth.DELETE("/chat/:chatID/users/:userID", s.handleRemoveUserFromChat)

		// API для сообщений в чатах
		auth.GET("/chat/:chatID/messages", s.handleGetMessages)

		// API для файлов
		auth.POST("/files/upload", s.handleFileUpload)

		// --- Админские маршруты ---
		// Группируем админские маршруты для наглядности (хотя middleware уже применен)
		admin := auth.Group("/admin") // Можно было бы и без группы, но так понятнее
		{
			admin.GET("/users", s.handleAdminGetUsers)          // Список всех пользователей
			admin.POST("/users", s.handleCreateUser)            // Добавляем маршрут создания пользователя сюда
			admin.GET("/settings", s.handleAdminGetSettings)    // Настройки системы
			admin.PUT("/settings", s.handleAdminUpdateSettings) // Обновление настроек
			// Новые маршруты
			admin.GET("/stats", s.handleAdminStats)
			admin.GET("/system/status", s.handleSystemStatus)
			admin.POST("/system/reset", s.handleResetSystem)

			// Маршруты для блокировки/разблокировки пользователей
			admin.PUT("/users/:userId/block", s.handleAdminBlockUser)     // Новый маршрут
			admin.PUT("/users/:userId/unblock", s.handleAdminUnblockUser) // Новый маршрут
		}
	}

	// Логирование всех доступных маршрутов
	routes := s.router.Routes()
	for _, route := range routes {
		logger.Debugf("Зарегистрирован маршрут: %s %s", route.Method, route.Path)
	}
}

// Запуск сервера с поддержкой graceful shutdown
func (s *Server) Run() error {
	addr := fmt.Sprintf("%s:%s", s.config.Server.Host, s.config.Server.Port)
	logger.Infof("Настройка HTTP сервера на адресе %s", addr)

	// Создаем HTTP сервер
	s.httpServer = &http.Server{
		Addr:    addr,
		Handler: s.router,
	}

	// Канал для сигналов завершения
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// Запускаем сервер в отдельной горутине
	go func() {
		logger.Infof("Сервер запущен на %s", addr)
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("Ошибка запуска сервера: %s", err)
		}
	}()

	// Ожидаем сигнал завершения
	<-quit
	logger.Info("Получен сигнал завершения, начинаем graceful shutdown...")

	// Создаем контекст с таймаутом для graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := s.httpServer.Shutdown(ctx); err != nil {
		logger.Fatalf("Ошибка при Shutdown сервера: %s", err)
		return err
	}

	logger.Info("Сервер успешно остановлен")
	return nil
}

// Регистрация клиента WebSocket
func (s *Server) registerClient(client *Client) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Закрываем существующее соединение
	existingClient, ok := s.clients[client.userID]
	if ok {
		logger.Infof("Закрываем существующее соединение для пользователя %d", client.userID)
		close(existingClient.send)
	}

	s.clients[client.userID] = client
	logger.Infof("Клиент %d зарегистрирован", client.userID)
}

// Отключение клиента WebSocket
func (s *Server) unregisterClient(client *Client) {
	if client.userID == 0 {
		// Клиент еще не аутентифицирован
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Проверяем, что это именно тот клиент
	if _, ok := s.clients[client.userID]; ok {
		logger.Infof("Клиент %d отключается", client.userID)
		delete(s.clients, client.userID)
		close(client.send)
	}
}

// Обработка входящего сообщения
func (s *Server) processMessage(client *Client, message []byte) {
	// Разбираем сообщение
	var msg wsMessage
	if err := json.Unmarshal(message, &msg); err != nil {
		logger.Errorf("Ошибка разбора сообщения: %v", err)
		return
	}

	// Обрабатываем сообщение в зависимости от типа
	switch msg.Type {
	case "text":
		// Обработка текстового сообщения
		var textMsg map[string]interface{}
		if err := json.Unmarshal([]byte(msg.Payload), &textMsg); err != nil {
			logger.Errorf("Ошибка разбора текстового сообщения: %v", err)
			return
		}

		// Извлекаем получателя
		recipientID, ok := textMsg["recipient_id"].(float64)
		if !ok {
			logger.Error("Не указан получатель сообщения")
			return
		}

		// Здесь должна быть логика обработки и сохранения сообщения
		// ...

		// Отправляем сообщение получателю
		s.sendToUser(uint(recipientID), message)

	case "typing":
		// Обработка индикатора набора текста
		// ...

	default:
		logger.Warnf("Неизвестный тип сообщения: %s", msg.Type)
	}
}

// sendToUser отправляет данные через WebSocket указанному пользователю
func (s *Server) sendToUser(userID uint, data []byte) {
	// Проверяем, подключен ли пользователь
	if clientObj, ok := s.wsClients.Load(userID); ok {
		if client, ok := clientObj.(*WSClient); ok {
			select {
			case client.send <- data:
				// Сообщение успешно отправлено в канал
				logger.Debugf("Сообщение успешно отправлено пользователю %d", userID)
			default:
				// Буфер полон, отключаем клиента
				logger.Warnf("Буфер клиента %d полон, отключение", userID)
				s.wsClients.Delete(userID)
				close(client.send)
			}
		}
	} else {
		logger.Debugf("Пользователь %d не подключен к WebSocket", userID)
	}
}

// Отправка истории сообщений
func (s *Server) sendMessageHistory(client *Client) {
	// Получаем непрочитанные сообщения
	var messages []models.DirectMessage
	if err := s.db.DB.Where("recipient_id = ? AND is_read = ?", client.userID, false).Find(&messages).Error; err != nil {
		logger.Errorf("Ошибка получения истории сообщений: %v", err)
		return
	}

	// Отправляем каждое сообщение
	for _, msg := range messages {
		// Формируем сообщение WebSocket
		wsMsg := WSMessage{
			Type: "text",
			Payload: json.RawMessage(fmt.Sprintf(`{
				"id": %d,
				"sender_id": %d,
				"recipient_id": %d,
				"content": %q,
				"created_at": %q,
				"is_read": false
			}`, msg.ID, msg.SenderID, msg.RecipientID, msg.Content, msg.CreatedAt)),
		}

		// Отправляем клиенту
		data, err := json.Marshal(wsMsg)
		if err != nil {
			logger.Errorf("Ошибка сериализации сообщения: %v", err)
			continue
		}

		client.send <- data
	}
}

// Обработчик для сброса системы (только для разработки)
func (s *Server) handleResetSystem(c *gin.Context) {
	if os.Getenv("APP_ENV") == "production" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Эта функция отключена в режиме продакшн"})
		return
	}

	// Сбрасываем данные в БД
	if err := s.db.Reset(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сброса данных: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Система сброшена успешно"})
}

// handleWebSocket обрабатывает WebSocket соединения
func (s *Server) handleWebSocket(c *gin.Context) {
	// Записываем детальное логирование всех возможных мест, где может быть токен
	logger.Debugf("WebSocket: Начало обработки соединения, адрес: %s", c.Request.RemoteAddr)
	logger.Debugf("WebSocket: Все заголовки запроса: %v", c.Request.Header)

	// Получаем токен из URL-параметра
	tokenString := c.Query("token")

	// Проверяем наличие токена в заголовке
	authHeader := c.GetHeader("Authorization")
	logger.Debugf("WebSocket: Заголовок Authorization: '%s'", authHeader)

	// Проверяем наличие токена в куках
	tokenCookie, err := c.Cookie("token")
	if err != nil {
		logger.Debugf("WebSocket: Токен в куках не найден: %v", err)
	} else {
		logger.Debugf("WebSocket: Токен из куки: '%s'", tokenCookie)
		if tokenString == "" {
			tokenString = tokenCookie
			logger.Debugf("WebSocket: Используем токен из куки")
		}
	}

	// Проверяем токен в заголовке
	if tokenString == "" && strings.HasPrefix(authHeader, "Bearer ") {
		tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		logger.Debugf("WebSocket: Используем токен из заголовка Authorization")
	}

	if tokenString == "" {
		logger.Warnf("WebSocket: Токен не найден ни в URL, ни в заголовке, ни в куках")
		c.Status(http.StatusUnauthorized) // Только статус без JSON для лучшей обработки ошибок WebSocket
		return
	}

	// Вместо полагания на JWTAuth middleware, напрямую проверяем токен
	claims, err := middleware.ValidateToken(tokenString, s.config.JWT.Secret)
	if err != nil {
		logger.Warnf("WebSocket: Недействительный токен: %v", err)
		c.Status(http.StatusUnauthorized) // Только статус без JSON для лучшей обработки ошибок WebSocket
		return
	}

	// Получаем userID из проверенных JWT claims
	userID := claims.UserID
	logger.Debugf("WebSocket: Успешная аутентификация пользователя ID=%d", userID)

	// Обновляем соединение до WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logger.Errorf("WebSocket: Ошибка обновления соединения до WebSocket: %v", err)
		return
	}
	logger.Debugf("WebSocket: Соединение успешно обновлено до WebSocket для пользователя ID=%d", userID)

	// Создаем клиента
	client := &WSClient{
		server:        s,
		conn:          conn,
		send:          make(chan []byte, 256),
		userID:        userID,
		authenticated: true,
		clientInfo:    c.Request.UserAgent(),
	}

	// Сохраняем клиента в карте соединений
	s.wsClients.Store(userID, client)
	logger.Debugf("WebSocket: Клиент сохранен в карте соединений, UserAgent: %s", c.Request.UserAgent())

	// Отправляем пользователю сообщение для подтверждения соединения
	debugMsg := fmt.Sprintf("Соединение WebSocket установлено для пользователя ID=%d", userID)
	debugData, _ := json.Marshal(map[string]interface{}{
		"type": "debug",
		"payload": map[string]string{
			"message": debugMsg,
		},
	})
	conn.WriteMessage(websocket.TextMessage, debugData)
	logger.Debugf("WebSocket: Отправлено отладочное сообщение подтверждения")

	// Запускаем горутины для чтения и записи
	go client.writePump()
	go client.readPump()

	logger.Infof("WebSocket: Пользователь %d успешно подключен по WebSocket", userID)
}

// Инициализирует систему, если нет ни одного пользователя
func (s *Server) initializeSystemIfNeeded() {
	// Проверяем, инициализирована ли система
	initialized, err := s.db.IsInitialized()
	if err != nil {
		logger.Errorf("Ошибка проверки инициализации: %v", err)
		return
	}

	// Если система уже инициализирована, ничего не делаем
	if initialized {
		logger.Info("Система уже инициализирована")
		return
	}

	// Получаем данные первого администратора из переменных окружения
	adminUsername := os.Getenv("ADMIN_USERNAME")
	adminPassword := os.Getenv("ADMIN_PASSWORD")

	if adminUsername == "" || adminPassword == "" {
		logger.Warn("Переменные окружения ADMIN_USERNAME и/или ADMIN_PASSWORD не установлены")
		return
	}

	// Создаем администратора
	admin := models.User{
		Username: adminUsername,
		Password: adminPassword,
		Role:     "admin",
	}

	// Хешируем пароль
	if err := admin.HashPassword(); err != nil {
		logger.Errorf("Ошибка хеширования пароля: %v", err)
		return
	}

	// Сохраняем в базу данных
	result := s.db.DB.Create(&admin)
	if result.Error != nil {
		logger.Errorf("Ошибка создания администратора: %v", result.Error)
		return
	}

	logger.Infof("Система успешно инициализирована. Создан администратор: %s", admin.Username)
}
