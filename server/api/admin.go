package api

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	// "context" // Раскомментируйте, если используется Redis

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"messenger/logger"
	"messenger/models"
)

// AdminUserResponse представляет структуру для ответа с данными пользователя
type AdminUserResponse struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	Email     string `json:"email,omitempty"`
	Role      string `json:"role"`
	Blocked   bool   `json:"blocked,omitempty"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// AdminGetUsersResponse представляет ответ на запрос списка пользователей
type AdminGetUsersResponse struct {
	Users []AdminUserResponse `json:"users"`
}

// AdminCreateUpdateUserRequest представляет запрос на создание/обновление пользователя
type AdminCreateUpdateUserRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password,omitempty"`
	Role     string `json:"role" binding:"required"`
	Blocked  bool   `json:"blocked"`
}

// AdminSettingsResponse представляет настройки системы
type AdminSettingsResponse struct {
	RegistrationEnabled bool `json:"registration_enabled"`
	MaintenanceMode     bool `json:"maintenance_mode"`
	EnableGeminiPro     bool `json:"enable_gemini_pro"` // Новое поле
}

// AdminUpdateSettingsRequest представляет запрос на обновление настроек
type AdminUpdateSettingsRequest struct {
	RegistrationEnabled bool `json:"registration_enabled"`
	MaintenanceMode     bool `json:"maintenance_mode"`
	EnableGeminiPro     bool `json:"enable_gemini_pro"` // Новое поле
}

// AdminStatsResponse представляет статистику системы
type AdminStatsResponse struct {
	UserCount         int64 `json:"user_count"`
	MessageCount      int64 `json:"message_count"`
	ActiveConnections int   `json:"active_connections"`
}

// SystemStatusResponse представляет статус компонентов системы
type SystemStatusResponse struct {
	OverallStatus string `json:"overall_status"`
	DBStatus      string `json:"db_status"`
	RedisStatus   string `json:"redis_status"`
}

// handleAdminGetUsers обрабатывает запрос на получение списка всех пользователей
func (s *Server) handleAdminGetUsers(c *gin.Context) {
	// Исправленная проверка прав администратора
	role, exists := c.Get("role")
	if !exists || role.(string) != "admin" {
		SendForbidden(c, "Недостаточно прав")
		return
	}

	var users []models.User
	result := s.db.DB.Find(&users)
	if result.Error != nil {
		SendInternalError(c, "Ошибка при получении списка пользователей")
		return
	}

	var responseUsers []AdminUserResponse
	for _, user := range users {
		responseUsers = append(responseUsers, AdminUserResponse{
			ID:        user.ID,
			Username:  user.Username,
			Role:      user.Role,
			CreatedAt: user.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt: user.UpdatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	c.JSON(http.StatusOK, AdminGetUsersResponse{Users: responseUsers})
}

// handleAdminGetSettings обрабатывает запрос на получение настроек системы
func (s *Server) handleAdminGetSettings(c *gin.Context) {
	// Исправленная проверка прав администратора
	role, exists := c.Get("role")
	if !exists || role.(string) != "admin" {
		SendForbidden(c, "Недостаточно прав")
		return
	}

	// Блокируем для чтения
	s.configLock.RLock()
	defer s.configLock.RUnlock()

	settings := AdminSettingsResponse{
		RegistrationEnabled: s.config.Server.RegistrationEnabled,
		MaintenanceMode:     s.config.Server.MaintenanceMode,
		EnableGeminiPro:     s.config.Server.EnableGeminiPro, // Читаем новое поле
	}

	c.JSON(http.StatusOK, settings)
}

// handleAdminUpdateSettings обрабатывает запрос на обновление настроек системы
func (s *Server) handleAdminUpdateSettings(c *gin.Context) {
	// Проверяем роль пользователя (должен быть администратор)
	role, _ := c.Get("role")
	if role != "admin" {
		SendForbidden(c, "Доступ запрещен: требуются права администратора")
		return
	}

	var req AdminUpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		SendBadRequest(c, "Неверный формат запроса: "+err.Error())
		return
	}

	logger.Debugf("Получен запрос на обновление настроек: %+v", req)

	// Блокируем конфигурацию для записи
	s.configLock.Lock()
	// Обновляем значения в конфигурации сервера из запроса (req)
	s.config.Server.RegistrationEnabled = req.RegistrationEnabled
	s.config.Server.MaintenanceMode = req.MaintenanceMode
	s.config.Server.EnableGeminiPro = req.EnableGeminiPro // Обновляем новое поле
	// Создаем копию обновленных значений для логирования (уже после обновления!)
	updatedSettingsForLog := AdminSettingsResponse{
		RegistrationEnabled: s.config.Server.RegistrationEnabled,
		MaintenanceMode:     s.config.Server.MaintenanceMode,
		EnableGeminiPro:     s.config.Server.EnableGeminiPro, // Добавляем в лог
	}
	s.configLock.Unlock() // Разблокируем сразу после обновления в памяти

	// Сохраняем обновленную конфигурацию в файл
	if err := s.config.Save(); err != nil {
		logger.Errorf("Ошибка сохранения настроек в файл: %v", err)
		SendInternalError(c, "Не удалось сохранить настройки")
		return
	}

	logger.Infof("Настройки успешно обновлены администратором %s: Регистрация=%t, Обслуживание=%t, GeminiPro=%t",
		c.GetString("username"), // Получаем имя пользователя из контекста
		updatedSettingsForLog.RegistrationEnabled,
		updatedSettingsForLog.MaintenanceMode,
		updatedSettingsForLog.EnableGeminiPro) // Добавляем в лог

	// Возвращаем обновленные настройки (уже после сохранения)
	c.JSON(http.StatusOK, updatedSettingsForLog)
}

// handleAdminUpdateUser обрабатывает обновление данных пользователя администратором
func (s *Server) handleAdminUpdateUser(c *gin.Context) {
	logger.Debug("handleAdminUpdateUser: начало обработки")
	// Проверка роли администратора
	role, exists := c.Get("role")
	if !exists || role.(string) != "admin" {
		logger.Warn("handleAdminUpdateUser: Попытка доступа без прав администратора")
		SendForbidden(c, "Требуются права администратора")
		return
	}

	// Получение ID пользователя из URL
	userIDStr := c.Param("userId")
	userID, err := strconv.ParseUint(userIDStr, 10, 32)
	if err != nil {
		logger.Errorf("handleAdminUpdateUser: Неверный ID пользователя: %s, ошибка: %v", userIDStr, err)
		SendBadRequest(c, "Неверный ID пользователя")
		return
	}

	// Парсинг данных из запроса
	var req AdminCreateUpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Warnf("handleAdminUpdateUser: Неверный формат запроса для пользователя ID %d: %v", userID, err)
		SendBadRequest(c, "Неверный формат запроса", err.Error())
		return
	}

	logger.Infof("handleAdminUpdateUser: Попытка обновления пользователя ID %d", userID)

	// Поиск пользователя в БД
	var user models.User
	if err := s.db.DB.First(&user, uint(userID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			logger.Warnf("handleAdminUpdateUser: Пользователь с ID %d не найден", userID)
			SendNotFound(c, "Пользователь не найден")
		} else {
			logger.Errorf("handleAdminUpdateUser: Ошибка поиска пользователя ID %d: %v", userID, err)
			SendInternalError(c, "Ошибка базы данных при поиске пользователя")
		}
		return
	}

	// Обновление полей пользователя
	user.Username = req.Username
	user.Email = req.Email // Допустим, email есть в модели User
	user.Role = req.Role
	user.Blocked = req.Blocked

	// Обновление пароля, если он предоставлен
	if req.Password != "" {
		logger.Debugf("handleAdminUpdateUser: Обновление пароля для пользователя ID %d", userID)
		user.Password = req.Password
		if err := user.HashPassword(); err != nil {
			logger.Errorf("handleAdminUpdateUser: Ошибка хеширования нового пароля для пользователя ID %d: %v", userID, err)
			SendInternalError(c, "Ошибка хеширования пароля")
			return
		}
	}

	// Сохранение изменений
	if err := s.db.DB.Save(&user).Error; err != nil {
		logger.Errorf("handleAdminUpdateUser: Ошибка сохранения пользователя ID %d: %v", userID, err)
		SendInternalError(c, "Ошибка базы данных при сохранении пользователя")
		return
	}

	logger.Infof("handleAdminUpdateUser: Пользователь ID %d успешно обновлен", userID)

	// Формирование ответа (без пароля)
	respUser := AdminUserResponse{
		ID:        user.ID,
		Username:  user.Username,
		Email:     user.Email,
		Role:      user.Role,
		Blocked:   user.Blocked,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
		UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, respUser)
}

// handleAdminDeleteUser обрабатывает запрос на удаление пользователя администратором
func (s *Server) handleAdminDeleteUser(c *gin.Context) {
	logger.Debug("handleAdminDeleteUser: начало обработки")
	// Проверка роли администратора
	role, exists := c.Get("role")
	if !exists || role.(string) != "admin" {
		logger.Warn("handleAdminDeleteUser: Попытка доступа без прав администратора")
		SendForbidden(c, "Требуются права администратора")
		return
	}

	// Получение ID пользователя из URL
	userIDStr := c.Param("userId") // Убедимся, что имя параметра совпадает с регистрацией роута
	userID, err := strconv.ParseUint(userIDStr, 10, 32)
	if err != nil {
		logger.Errorf("handleAdminDeleteUser: Неверный ID пользователя: %s, ошибка: %v", userIDStr, err)
		SendBadRequest(c, "Неверный ID пользователя")
		return
	}

	// Защита от удаления самого себя
	currentUserID, _ := c.Get("userID")
	if currentUserID.(uint) == uint(userID) {
		logger.Warnf("handleAdminDeleteUser: Попытка администратора ID %d удалить самого себя (ID %d)", currentUserID, userID)
		SendForbidden(c, "Администратор не может удалить сам себя")
		return
	}

	logger.Infof("handleAdminDeleteUser: Попытка удаления пользователя с ID: %d администратором ID: %d", userID, currentUserID)

	// Поиск пользователя для удаления
	var user models.User
	if err := s.db.DB.First(&user, uint(userID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			logger.Warnf("handleAdminDeleteUser: Пользователь с ID %d не найден", userID)
			SendNotFound(c, "Пользователь не найден")
		} else {
			logger.Errorf("handleAdminDeleteUser: Ошибка поиска пользователя ID %d: %v", userID, err)
			SendInternalError(c, "Ошибка базы данных при поиске пользователя")
		}
		return
	}

	// Удаление пользователя
	if err := s.db.DB.Delete(&user).Error; err != nil {
		logger.Errorf("handleAdminDeleteUser: Ошибка удаления пользователя ID %d: %v", userID, err)
		SendInternalError(c, "Ошибка базы данных при удалении пользователя")
		return
	}

	logger.Infof("handleAdminDeleteUser: Пользователь с ID %d успешно удален администратором ID: %d", userID, currentUserID)
	c.JSON(http.StatusOK, gin.H{"message": "Пользователь успешно удален"})
}

// handleAdminStats обрабатывает запрос на получение статистики системы
func (s *Server) handleAdminStats(c *gin.Context) {
	// Исправленная проверка прав администратора
	role, exists := c.Get("role")
	if !exists || role.(string) != "admin" {
		SendForbidden(c, "Недостаточно прав")
		return
	}

	var userCount int64
	s.db.DB.Model(&models.User{}).Count(&userCount)

	var messageCount int64
	// Уточните имя модели сообщения, если оно другое (например, models.ChatMessage)
	s.db.DB.Model(&models.Message{}).Count(&messageCount)

	// Подсчет активных WebSocket соединений (примерный)
	activeConnections := 0
	s.wsClients.Range(func(_, _ interface{}) bool {
		activeConnections++
		return true
	})

	stats := AdminStatsResponse{
		UserCount:         userCount,
		MessageCount:      messageCount,
		ActiveConnections: activeConnections,
	}

	c.JSON(http.StatusOK, stats)
}

// handleSystemStatus обрабатывает запрос на получение статуса системы
func (s *Server) handleSystemStatus(c *gin.Context) {
	// Проверка прав администратора
	role, exists := c.Get("role")
	if !exists || role.(string) != "admin" {
		SendForbidden(c, "Недостаточно прав")
		return
	}

	dbStatus := "OK"
	sqlDB, err := s.db.DB.DB()
	if err != nil || sqlDB.Ping() != nil {
		dbStatus = "Error"
		logger.Errorf("Ошибка проверки статуса БД: %v", err) // Логируем ошибку
	}

	// Пример проверки Redis
	redisStatus := "Not Used"
	// if s.redisClient != nil { ... } // Логика проверки Redis

	overallStatus := "OK"
	if dbStatus != "OK" || redisStatus == "Error" { // Проверяем и Redis если он используется и вернул ошибку
		overallStatus = "Degraded"
	}

	response := SystemStatusResponse{
		OverallStatus: overallStatus,
		DBStatus:      dbStatus,
		RedisStatus:   redisStatus,
	}

	c.JSON(http.StatusOK, response)
}

// handleAdminBlockUser обрабатывает блокировку пользователя
func (s *Server) handleAdminBlockUser(c *gin.Context) {
	logger.Debug("handleAdminBlockUser: начало обработки")
	// Проверка роли администратора
	role, exists := c.Get("role")
	if !exists || role.(string) != "admin" {
		logger.Warn("handleAdminBlockUser: Попытка доступа без прав администратора")
		SendForbidden(c, "Требуются права администратора")
		return
	}

	// Получение ID пользователя из URL
	userIDStr := c.Param("userId")
	userID, err := strconv.ParseUint(userIDStr, 10, 32)
	if err != nil {
		logger.Errorf("handleAdminBlockUser: Неверный ID пользователя: %s, ошибка: %v", userIDStr, err)
		SendBadRequest(c, "Неверный ID пользователя")
		return
	}

	// Защита от блокировки самого себя
	currentUserID, _ := c.Get("userID")
	if currentUserID.(uint) == uint(userID) {
		logger.Warnf("handleAdminBlockUser: Попытка администратора ID %d заблокировать самого себя (ID %d)", currentUserID, userID)
		SendForbidden(c, "Администратор не может заблокировать сам себя")
		return
	}

	logger.Infof("handleAdminBlockUser: Попытка блокировки пользователя ID %d администратором ID %d", userID, currentUserID)

	// Поиск пользователя
	var user models.User
	if err := s.db.DB.First(&user, uint(userID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			logger.Warnf("handleAdminBlockUser: Пользователь ID %d не найден для блокировки", userID)
			SendNotFound(c, "Пользователь не найден")
		} else {
			logger.Errorf("handleAdminBlockUser: Ошибка поиска пользователя ID %d: %v", userID, err)
			SendInternalError(c, "Ошибка базы данных при поиске пользователя")
		}
		return
	}

	// Блокировка пользователя
	if err := s.db.DB.Model(&user).Update("blocked", true).Error; err != nil {
		logger.Errorf("handleAdminBlockUser: Ошибка блокировки пользователя ID %d: %v", userID, err)
		SendInternalError(c, "Ошибка базы данных при блокировке пользователя")
		return
	}
	user.Blocked = true // Обновляем состояние в локальной переменной для ответа

	logger.Infof("handleAdminBlockUser: Пользователь ID %d успешно заблокирован администратором ID %d", userID, currentUserID)

	// Формирование ответа
	respUser := AdminUserResponse{
		ID:        user.ID,
		Username:  user.Username,
		Email:     user.Email,
		Role:      user.Role,
		Blocked:   user.Blocked,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
		UpdatedAt: user.UpdatedAt.Format(time.RFC3339), // Обновляем время последнего изменения
	}
	c.JSON(http.StatusOK, respUser)
}

// handleAdminUnblockUser обрабатывает разблокировку пользователя
func (s *Server) handleAdminUnblockUser(c *gin.Context) {
	logger.Debug("handleAdminUnblockUser: начало обработки")
	// Проверка роли администратора
	role, exists := c.Get("role")
	if !exists || role.(string) != "admin" {
		logger.Warn("handleAdminUnblockUser: Попытка доступа без прав администратора")
		SendForbidden(c, "Требуются права администратора")
		return
	}

	// Получение ID пользователя из URL
	userIDStr := c.Param("userId")
	userID, err := strconv.ParseUint(userIDStr, 10, 32)
	if err != nil {
		logger.Errorf("handleAdminUnblockUser: Неверный ID пользователя: %s, ошибка: %v", userIDStr, err)
		SendBadRequest(c, "Неверный ID пользователя")
		return
	}

	logger.Infof("handleAdminUnblockUser: Попытка разблокировки пользователя ID %d", userID)

	// Поиск пользователя
	var user models.User
	if err := s.db.DB.First(&user, uint(userID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			logger.Warnf("handleAdminUnblockUser: Пользователь ID %d не найден для разблокировки", userID)
			SendNotFound(c, "Пользователь не найден")
		} else {
			logger.Errorf("handleAdminUnblockUser: Ошибка поиска пользователя ID %d: %v", userID, err)
			SendInternalError(c, "Ошибка базы данных при поиске пользователя")
		}
		return
	}

	// Разблокировка пользователя
	if err := s.db.DB.Model(&user).Update("blocked", false).Error; err != nil {
		logger.Errorf("handleAdminUnblockUser: Ошибка разблокировки пользователя ID %d: %v", userID, err)
		SendInternalError(c, "Ошибка базы данных при разблокировке пользователя")
		return
	}
	user.Blocked = false // Обновляем состояние в локальной переменной для ответа

	logger.Infof("handleAdminUnblockUser: Пользователь ID %d успешно разблокирован", userID)

	// Формирование ответа
	respUser := AdminUserResponse{
		ID:        user.ID,
		Username:  user.Username,
		Email:     user.Email,
		Role:      user.Role,
		Blocked:   user.Blocked,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
		UpdatedAt: user.UpdatedAt.Format(time.RFC3339), // Обновляем время последнего изменения
	}
	c.JSON(http.StatusOK, respUser)
}
