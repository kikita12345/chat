/**
 * Конфигурационные переменные приложения
 */

// API URL
export const API_URL = '/api';

// WebSocket URL (будет использоваться, если не автоматическое определение)
export const WS_URL = window.location.protocol === 'https:' 
  ? `wss://${window.location.host}/api/ws` 
  : `ws://${window.location.host}/api/ws`;

// Версия приложения
export const APP_VERSION = '0.1.0';

// Задержка между повторными попытками подключения WebSocket (в мс)
export const WS_RECONNECT_INTERVAL = 3000;

// Максимальное количество попыток повторного подключения WebSocket
export const WS_MAX_RECONNECT_ATTEMPTS = 5;

// Время жизни токена аутентификации (в днях)
export const TOKEN_EXPIRY_DAYS = 7;

// Размер страницы при пагинации
export const PAGE_SIZE = 20;

// Флаг режима разработки
export const IS_DEV = process.env.NODE_ENV === 'development';

// Логирование в консоль (только в режиме разработки)
export const logger = {
  log: (...args) => IS_DEV && console.log(...args),
  warn: (...args) => IS_DEV && console.warn(...args),
  error: (...args) => console.error(...args),
  info: (...args) => IS_DEV && console.info(...args),
  debug: (...args) => IS_DEV && console.debug(...args),
};

/**
 * Конфигурация приложения
 */

// Проверяем наличие глобальной конфигурации
const APP_CONFIG = window.APP_CONFIG || {};

// Безопасное получение переменных окружения
const getEnvVar = (name, defaultValue = '') => {
  try {
    // Проверяем наличие объекта process
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return process.env[name];
    }
  } catch (e) {
    console.warn(`Ошибка при доступе к переменной окружения ${name}:`, e);
  }
  return defaultValue;
};

// URL базового API
export const API_BASE_URL = API_URL;

// URL для подключения к медиа-серверу SFU
export const SFU_URL = APP_CONFIG.LIVEKIT_URL || getEnvVar('REACT_APP_SFU_URL', '');

// Конфигурация STUN/TURN серверов для WebRTC (если требуется)
export const ICE_SERVERS = [
  {
    urls: 'stun:stun.l.google.com:19302',
  }
];

// Конфигурация для запросов к API
export const API_CONFIG = {
  timeout: 10000, // 10 секунд
  headers: {
    'Content-Type': 'application/json',
  },
};

// Максимальный размер загружаемых файлов (в байтах)
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 МБ

// Поддерживаемые типы файлов
export const SUPPORTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'video/webm',
];

// Настройки пагинации
export const PAGINATION = {
  messagesPerPage: 50,
  usersPerPage: 20,
};

// Настройки для аудио/видео звонков
export const CALL_CONFIG = {
  timeoutSeconds: 30, // Таймаут для ответа на вызов
  maxDurationMinutes: 60, // Максимальная длительность звонка
  autoRejectOnIdle: true, // Автоматический отклонение вызова при неактивности
};

// Для удобного логирования в консоль
export const logConfig = () => {
  console.log('=== Конфигурация приложения ===');
  console.log('API_URL:', API_URL);
  console.log('WS_URL:', WS_URL);
  console.log('MAX_FILE_SIZE:', MAX_FILE_SIZE / (1024 * 1024) + ' МБ');
  console.log('APP_VERSION:', APP_VERSION);
  console.log('==============================');
}; 