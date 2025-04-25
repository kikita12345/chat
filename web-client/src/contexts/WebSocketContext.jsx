import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { logger } from '../config';
import wsServiceInstance from '../utils/websocket'; // Используем экземпляр из utils

const WebSocketContext = createContext();

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket должен использоваться внутри WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]); // Храним входящие сообщения
  const wsRef = useRef(null); // Используем useRef для хранения экземпляра wsServiceInstance
  const isConnectingRef = useRef(false); // Флаг для предотвращения множественных попыток подключения

  // Обработчик входящих сообщений WebSocket
  const handleMessage = useCallback((event) => {
    try {
      const messageData = JSON.parse(event.data);
      logger.log('WebSocketContext: Получено сообщение:', messageData.type, messageData);
      setMessages((prevMessages) => [...prevMessages, messageData]); // Добавляем сообщение в стейт
      setError(null); // Сбрасываем ошибку при получении сообщения
    } catch (e) {
      logger.error('WebSocketContext: Ошибка парсинга сообщения:', e, 'Данные:', event.data);
      setError('Ошибка обработки сообщения от сервера');
    }
  }, []);

  // Обработчик события открытия соединения
  const handleOpen = useCallback(() => {
    logger.log('WebSocketContext: Соединение установлено');
    setIsConnected(true);
    isConnectingRef.current = false; // Сбрасываем флаг
    setError(null);
  }, []);

  // Обработчик события закрытия соединения
  const handleClose = useCallback((event) => {
    logger.warn('WebSocketContext: Соединение закрыто', event.code, event.reason);
    setIsConnected(false);
    isConnectingRef.current = false; // Сбрасываем флаг
    // Не устанавливаем ошибку здесь, чтобы не показывать её при штатном logout
    // Ошибка будет установлена в handleError или при неудачном реконнекте
  }, []);

  // Обработчик ошибок WebSocket
  const handleError = useCallback((err) => {
    logger.error('WebSocketContext: Ошибка WebSocket:', err);
    setIsConnected(false);
    isConnectingRef.current = false; // Сбрасываем флаг
    setError('Ошибка WebSocket соединения. Попытка переподключения...');
    // Логика переподключения уже в wsServiceInstance
  }, []);

  // Функция для подключения WebSocket
  const connect = useCallback(() => {
    if (!token) {
      logger.warn('WebSocketContext: Попытка подключения без токена');
      return;
    }
    // Проверяем, не подключены ли уже или не идет ли процесс подключения
    if (wsRef.current || isConnectingRef.current) {
        logger.log('WebSocketContext: Соединение уже существует или устанавливается, пропуск.');
        return;
    }

    logger.log('WebSocketContext: Попытка подключения к WebSocket');
    isConnectingRef.current = true; // Устанавливаем флаг
    setError(null);

    try {
        // Передаем обработчики напрямую в init
        wsServiceInstance.init(token, handleOpen, handleClose, handleError, handleMessage);
        wsServiceInstance.connect();
        wsRef.current = wsServiceInstance; // Сохраняем ссылку
    } catch (e) {
        logger.error('WebSocketContext: Критическая ошибка при инициализации WebSocket', e);
        setError('Не удалось инициализировать WebSocket');
        isConnectingRef.current = false; // Сбрасываем флаг при ошибке
    }

  }, [token, handleOpen, handleClose, handleError, handleMessage]);

  // Функция для отключения WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      logger.log('WebSocketContext: Отключение WebSocket');
      wsRef.current.disconnect();
      wsRef.current = null; // Обнуляем ссылку
      setIsConnected(false);
      isConnectingRef.current = false;
    } else {
        logger.log('WebSocketContext: Попытка отключения несуществующего WebSocket соединения.');
    }
  }, []);

  // Эффект для установки и очистки соединения
  useEffect(() => {
    if (isAuthenticated && token) {
      logger.log('WebSocketContext: Пользователь аутентифицирован, вызываем connect.');
      connect();
    } else {
      logger.log('WebSocketContext: Пользователь не аутентифицирован или нет токена, вызываем disconnect.');
      disconnect();
    }

    // Очистка при размонтировании компонента
    return () => {
      logger.log('WebSocketContext: Размонтирование компонента, вызываем disconnect.');
      disconnect();
    };
  }, [isAuthenticated, token, connect, disconnect]);

  // Функция отправки сообщения
  const sendMessage = useCallback((type, payload) => {
    if (wsRef.current && isConnected) {
      try {
          const message = { type, payload };
          logger.log('WebSocketContext: Отправка сообщения:', message);
          wsRef.current.sendMessage(JSON.stringify(message));
      } catch (e) {
          logger.error('WebSocketContext: Ошибка при отправке сообщения:', e);
          setError('Ошибка отправки сообщения');
      }
    } else {
      logger.warn('WebSocketContext: Попытка отправки сообщения без активного соединения');
      setError('Нет WebSocket соединения для отправки сообщения');
    }
  }, [isConnected]);

  const value = {
    ws: wsRef.current?.socket, // Предоставляем доступ к нативному сокету (если нужно)
    isConnected,
    error,
    messages, // Предоставляем доступ к полученным сообщениям
    sendMessage,
    connect, // Добавляем connect и disconnect в контекст
    disconnect
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext; 