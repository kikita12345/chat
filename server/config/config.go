package config

import (
	"encoding/json"
	"fmt"
	"messenger/logger"
	"os"
	"path/filepath"
	"strconv"

	"github.com/go-playground/validator/v10"
)

type Config struct {
	Server struct {
		Port                string `json:"port" validate:"required"`
		Host                string `json:"host" validate:"required"`
		Debug               bool   `json:"debug"`
		RegistrationEnabled bool   `json:"registration_enabled"`
		MaintenanceMode     bool   `json:"maintenance_mode"`
		EnableGeminiPro     bool   `json:"enable_gemini_pro"` // Новое поле
	} `json:"server"`

	Database struct {
		Host     string `json:"host" validate:"required"`
		Port     string `json:"port" validate:"required"`
		User     string `json:"user" validate:"required"`
		Password string `json:"password"`
		DBName   string `json:"dbname" validate:"required"`
	} `json:"database"`

	JWT struct {
		Secret string `json:"secret" validate:"required,min=32"`
		Expiry int    `json:"expiry" validate:"required,min=1,max=720"` // в часах, макс. 30 дней
	} `json:"jwt"`

	SFU struct {
		Host string `json:"host" validate:"required"`
		Port string `json:"port" validate:"required"`
	} `json:"sfu"`

	Redis struct {
		Host     string `json:"host" validate:"required"`
		Port     string `json:"port" validate:"required"`
		Password string `json:"password"`
		DB       int    `json:"db" validate:"min=0,max=15"`
		Enabled  bool   `json:"enabled" validate:"required"`
	} `json:"redis"`

	FileStorage struct {
		Path             string `json:"path" validate:"required"`
		MaxSizeMB        int    `json:"max_size_mb" validate:"required,min=1,max=1000"`
		AllowedMimeTypes string `json:"allowed_mime_types" validate:"required"`
	} `json:"file_storage"`
}

func Load() (*Config, error) {
	var config *Config // Объявляем config здесь, чтобы он был доступен во всей функции

	logger.Debug("Определение пути к файлу конфигурации...")
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "config/config.json" // Путь по умолчанию
		logger.Debugf("Переменная окружения CONFIG_PATH не установлена, используется путь по умолчанию: %s", configPath)
	} else {
		logger.Debugf("Используется путь к конфигурации из CONFIG_PATH: %s", configPath)
	}

	// Попробуем определить абсолютный путь для лога
	absPath, err := filepath.Abs(configPath)
	if err != nil {
		logger.Warnf("Не удалось определить абсолютный путь для %s: %v", configPath, err)
		absPath = configPath // Используем относительный путь, если не получилось
	}

	logger.Infof("Загрузка конфигурации из файла: %s", absPath)

	// Чтение файла конфигурации
	file, err := os.Open(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			logger.Warnf("Файл конфигурации '%s' не найден. Будут использованы значения по умолчанию и переменные окружения.", absPath)
			// Файл не найден, создаем пустой config, чтобы применить переменные окружения и дефолты
			config = &Config{}
		} else {
			return nil, fmt.Errorf("ошибка открытия файла конфигурации '%s': %w", absPath, err)
		}
	} else {
		defer file.Close()
		logger.Debugf("Файл конфигурации '%s' успешно открыт.", absPath)

		// Создаем экземпляр config здесь, если файл существует
		config = &Config{}
		decoder := json.NewDecoder(file)
		if err := decoder.Decode(&config); err != nil {
			return nil, fmt.Errorf("ошибка декодирования JSON из файла '%s': %w", absPath, err)
		}
		logger.Infof("Конфигурация успешно загружена из файла '%s'.", absPath)
		logger.Debugf("Значения из файла config.json: RegistrationEnabled=%t", config.Server.RegistrationEnabled)
	}

	// Переопределение значений из переменных окружения
	logger.Debug("Проверка переменных окружения для переопределения конфигурации...")

	overrideFromEnv("SERVER_PORT", &config.Server.Port)
	overrideFromEnv("SERVER_HOST", &config.Server.Host)
	overrideBoolFromEnv("SERVER_DEBUG", &config.Server.Debug)
	registrationEnvSet := overrideBoolFromEnv("SERVER_REGISTRATION_ENABLED", &config.Server.RegistrationEnabled)
	if registrationEnvSet {
		logger.Infof("Значение RegistrationEnabled переопределено переменной окружения SERVER_REGISTRATION_ENABLED: %t", config.Server.RegistrationEnabled)
	}
	overrideBoolFromEnv("SERVER_MAINTENANCE_MODE", &config.Server.MaintenanceMode)
	overrideBoolFromEnv("SERVER_ENABLE_GEMINI_PRO", &config.Server.EnableGeminiPro) // Чтение из переменной окружения

	overrideFromEnv("DB_HOST", &config.Database.Host)
	overrideFromEnv("DB_PORT", &config.Database.Port)
	overrideFromEnv("DB_USER", &config.Database.User)
	overrideFromEnv("DB_PASSWORD", &config.Database.Password)
	overrideFromEnv("DB_NAME", &config.Database.DBName)

	overrideFromEnv("JWT_SECRET", &config.JWT.Secret)
	overrideIntFromEnv("JWT_EXPIRY", &config.JWT.Expiry)

	overrideFromEnv("SFU_HOST", &config.SFU.Host)
	overrideFromEnv("SFU_PORT", &config.SFU.Port)

	overrideFromEnv("REDIS_HOST", &config.Redis.Host)
	overrideFromEnv("REDIS_PORT", &config.Redis.Port)
	overrideFromEnv("REDIS_PASSWORD", &config.Redis.Password)
	overrideBoolFromEnv("REDIS_ENABLED", &config.Redis.Enabled)

	// Устанавливаем значения по умолчанию для файлового хранилища, если не заданы
	if config.FileStorage.Path == "" {
		config.FileStorage.Path = "./uploads"
		logger.Debugf("Установлено дефолтное значение для FileStorage.Path: %s", config.FileStorage.Path)
	}
	if config.FileStorage.MaxSizeMB == 0 {
		config.FileStorage.MaxSizeMB = 100
		logger.Debugf("Установлено дефолтное значение для FileStorage.MaxSizeMB: %d", config.FileStorage.MaxSizeMB)
	}
	if config.FileStorage.AllowedMimeTypes == "" {
		config.FileStorage.AllowedMimeTypes = "image/jpeg,image/png,image/gif,application/pdf,audio/mpeg,video/mp4"
		logger.Debugf("Установлено дефолтное значение для FileStorage.AllowedMimeTypes")
	}

	// Валидация конфигурации ПОСЛЕ всех переопределений
	logger.Debug("Валидация итоговой конфигурации...")
	validate := validator.New()
	if err := validate.Struct(config); err != nil {
		return nil, fmt.Errorf("ошибка валидации итоговой конфигурации: %w", err)
	}
	logger.Debug("Конфигурация успешно прошла валидацию.")

	logger.Infof("Итоговая конфигурация сервера: Port=%s, Host=%s, Debug=%t, RegistrationEnabled=%t, MaintenanceMode=%t, EnableGeminiPro=%t",
		config.Server.Port, config.Server.Host, config.Server.Debug, config.Server.RegistrationEnabled, config.Server.MaintenanceMode, config.Server.EnableGeminiPro) // Добавлено в лог

	return config, nil
}

// Save сохраняет текущую конфигурацию в файл
func (cfg *Config) Save() error {
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "server/config/config.json"
	}

	logger.Infof("Сохранение конфигурации в файл: %s", configPath)

	file, err := os.OpenFile(configPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		logger.Errorf("Ошибка открытия файла конфигурации для записи: %v", err)
		return fmt.Errorf("ошибка открытия файла конфигурации для записи: %w", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ") // Pretty print JSON
	if err := encoder.Encode(cfg); err != nil {
		logger.Errorf("Ошибка записи конфигурации в файл: %v", err)
		return fmt.Errorf("ошибка записи конфигурации в файл: %w", err)
	}

	logger.Info("Конфигурация успешно сохранена")
	return nil
}

// overrideFromEnv читает переменную окружения и обновляет значение, если она установлена
func overrideFromEnv(envVar string, target *string) {
	if value := os.Getenv(envVar); value != "" {
		*target = value
	}
}

func overrideBoolFromEnv(envVar string, target *bool) bool {
	if value := os.Getenv(envVar); value != "" {
		*target = value == "true"
		return true
	}
	return false
}

// overrideIntFromEnv читает целочисленную переменную окружения
func overrideIntFromEnv(envVar string, target *int) {
	if valueStr := os.Getenv(envVar); valueStr != "" {
		if valueInt, err := strconv.Atoi(valueStr); err == nil {
			*target = valueInt
		} else {
			logger.Warnf("Не удалось преобразовать переменную окружения %s ('%s') в число: %v", envVar, valueStr, err)
		}
	}
}
