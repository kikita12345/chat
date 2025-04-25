import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from '../utils/api'; // Используем стандартизированный API
import { jwtDecode } from 'jwt-decode'; // Импортируем jwt-decode, если еще не импортирован
import { logger } from '../config';
import wsService from '../utils/websocket'; // Импортируем WebSocket сервис
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Состояние аутентификации
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [token, setToken] = useState(null);
  const navigate = useNavigate();
  
  // Базовый URL для API
  const API_URL = '/api';
  
  // Получение токена из localStorage
  const getToken = useCallback(() => {
    console.log('AuthContext: Попытка получения токена из localStorage');
    
    // Используем единственный ключ для токена 
    const token = localStorage.getItem('token');
    
    console.log('AuthContext: token в localStorage:', token ? 'присутствует' : 'отсутствует');
    
    // Для обратной совместимости также проверяем старый ключ (временно)
    if (!token) {
      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        // Если нашли токен по старому ключу, переносим его в новый формат
        localStorage.setItem('token', authToken);
        localStorage.removeItem('auth_token');
        console.log('AuthContext: Токен перенесен из старого формата в новый');
        return authToken;
      }
    }
    
    return token || null;
  }, []);
  
  // Сохранение данных аутентификации
  const saveAuthData = useCallback((token, userData) => {
    try {
      console.log('AuthContext: Сохранение токена непосредственно в localStorage');
      localStorage.setItem('auth_token', token);
      localStorage.setItem('token', token);
      
      // Сохраняем данные пользователя
      localStorage.setItem('user_data', JSON.stringify(userData));
      
      // Устанавливаем заголовок Authorization для всех последующих запросов axios
      API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log('AuthContext: Установлен заголовок авторизации для Axios');
      
      // Проверяем, что токен сохранен
      const savedToken = localStorage.getItem('auth_token');
      console.log('AuthContext: Проверка сохраненного токена:', 
                  savedToken ? (savedToken.substring(0, 10) + '...') : 'не сохранен');
      
      return !!savedToken;
    } catch (e) {
      console.error('AuthContext: Ошибка при сохранении данных аутентификации:', e);
      return false;
    }
  }, []);
  
  // Очистка данных аутентификации
  const clearAuthData = useCallback(() => {
    console.log('AuthContext: Очистка данных аутентификации');
    
    try {
      // Удаляем все связанные с аутентификацией данные
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token');
      localStorage.removeItem('user_data');
      
      // Удаляем заголовок авторизации
      delete API.defaults.headers.common['Authorization'];
      
      return true;
    } catch (e) {
      console.error('AuthContext: Ошибка при очистке данных аутентификации:', e);
      return false;
    }
  }, []);
  
  // Функция выхода
  const logout = useCallback(() => {
    logger.log('AuthContext: Выход из системы');
    localStorage.removeItem('token');
    localStorage.removeItem('user_data');
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setAdmin(false);
    // Удаляем заголовок авторизации
    delete API.defaults.headers.common['Authorization'];
    logger.log('AuthContext: Удален заголовок Authorization');
    // Отключаем WebSocket
    // Эту логику лучше перенести в WebSocketContext
    // wsDisconnect();
  }, []);
  
  // Проверка актуальности сессии
  const checkSession = useCallback(async () => {
    logger.log('AuthContext: Проверка текущей сессии');
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user_data');

    if (storedToken && storedUser) {
      logger.log('AuthContext: Найден токен и пользователь в localStorage');
      setLoading(true);
      try {
        // Проверяем валидность токена (можно добавить проверку срока действия)
        // const decodedToken = jwtDecode(storedToken);
        // const isExpired = decodedToken.exp * 1000 < Date.now();
        // if (isExpired) {
        //   logger.warn('AuthContext: Токен истек');
        //   logout();
        //   return;
        // }

        // Устанавливаем токен для запросов
        API.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        logger.log('AuthContext: Установлен заголовок Authorization для запросов');

        // Опционально: можно сделать запрос к /api/auth/check для верификации на сервере
        // logger.log('AuthContext: Отправка запроса на проверку сессии');
        // const response = await API.get('/auth/check');
        // const userFromServer = response.data.user;
        // logger.log('AuthContext: Сессия активна, пользователь:', userFromServer?.username);
        // setCurrentUser(userFromServer);
        // localStorage.setItem('user', JSON.stringify(userFromServer)); // Обновляем пользователя

        // Пока используем пользователя из localStorage
        const user = JSON.parse(storedUser);
        setUser(user);
        setToken(storedToken);
        setIsAuthenticated(true);
        setAdmin(user.role === 'admin');
        logger.log('AuthContext: Сессия восстановлена из localStorage для пользователя:', user?.username);

      } catch (error) {
        logger.error('AuthContext: Ошибка проверки сессии или токен невалиден', error);
        logout(); // Выходим, если токен невалиден
      } finally {
        setLoading(false);
      }
    } else {
      logger.log('AuthContext: Токен или пользователь не найдены в localStorage');
      setLoading(false); // Убедимся, что загрузка завершена
    }
  }, [logout]);
  
  // Функция для входа пользователя
  const login = useCallback(async (username, password) => {
    logger.log('AuthContext: Попытка входа пользователя', username);
    setLoading(true);
    setError(null);

    try {
      const response = await API.post('/auth/login', { username, password }); // Используем API
      const { token, user } = response.data;

      if (token && user) {
        logger.log('AuthContext: Успешный вход, получен токен и данные пользователя');
        localStorage.setItem('token', token);
        localStorage.setItem('user_data', JSON.stringify(user));
        setUser(user);
        setToken(token);
        setIsAuthenticated(true);
        setAdmin(user.role === 'admin');
        // Устанавливаем заголовок по умолчанию для будущих запросов API
        API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        logger.log('AuthContext: Установлен заголовок Authorization для запросов');

        // Инициируем WebSocket соединение после успешного входа
        // Эту логику лучше перенести в WebSocketContext
        // wsConnect(token); 

        return true;
      } else {
        logger.warn('AuthContext: Ответ сервера не содержит токен или данные пользователя');
        setError('Неверный ответ сервера при входе');
        return false;
      }
    } catch (err) {
      logger.error('AuthContext: Ошибка входа:', err);
      const message = err.response?.data?.message || err.response?.data?.error || 'Ошибка входа';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Функция регистрации
  const register = useCallback(async (userData) => {
    logger.log('AuthContext: Регистрация нового пользователя', userData);
    setLoading(true);
    setError(null);
    try {
      logger.log('AuthContext: Отправка запроса на регистрацию');
      const response = await API.post('/register', userData); // Используем /register напрямую
      logger.log('AuthContext: Получен ответ от сервера', response);

      // Сервер при успешной регистрации возвращает токен и пользователя
      if (response.data && response.data.token && response.data.user) {
        logger.log('AuthContext: Регистрация успешна, пользователь создан:', response.data);
        // Не логиним пользователя автоматически после регистрации
        // Оставляем это на усмотрение логики приложения (например, редирект на логин)
        return { success: true, data: response.data };
      } else {
        logger.warn('AuthContext: Ответ сервера не содержит токен или пользователя после регистрации');
        setError('Неожиданный ответ сервера после регистрации');
        return { success: false, error: 'Неожиданный ответ сервера' };
      }
    } catch (err) {
      logger.error('AuthContext: Ошибка регистрации:', err);
      const message = err.response?.data?.message || err.response?.data?.error || 'Ошибка регистрации';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Обновление данных пользователя
  const updateUserData = useCallback(async (userData) => {
    if (!isAuthenticated) {
      return false;
    }
    
    console.log('AuthContext: Обновление данных пользователя');
    setLoading(true);
    
    try {
      // Отправляем запрос на обновление
      const response = await API.put('/users/profile', userData);
      
      if (response.data && response.data.user) {
        console.log('AuthContext: Данные пользователя обновлены');
        
        // Обновляем в localStorage
        localStorage.setItem('user_data', JSON.stringify(response.data.user));
        
        // Обновляем состояние
        setUser(response.data.user);
        setAdmin(response.data.user.role === 'admin');
        setLoading(false);
        return true;
      }
      
      setLoading(false);
      return false;
    } catch (error) {
      console.error('AuthContext: Ошибка обновления профиля:', error);
      
      if (error.response && error.response.data && error.response.data.error) {
        setError(error.response.data.error);
      } else {
        setError('Произошла ошибка при обновлении профиля');
      }
      
      setLoading(false);
      return false;
    }
  }, [isAuthenticated]);
  
  // Проверка сессии при загрузке компонента
  useEffect(() => {
    console.log('AuthContext: Инициализация');
    
    const initializeAuth = async () => {
      // Пытаемся загрузить пользователя из localStorage
      const token = getToken();
      const userData = localStorage.getItem('user_data');
      
      if (token && userData) {
        try {
          // Устанавливаем токен для запросов
          API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Добавляем диагностическую проверку токена в заголовке
          console.log('AuthContext: Токен установлен в заголовок Authorization:', 
                      !!API.defaults.headers.common['Authorization']);
          
          // Парсим данные пользователя
          const parsedUser = JSON.parse(userData);
          console.log('AuthContext: Данные пользователя из localStorage:', parsedUser);
          
          // Устанавливаем предварительные данные пользователя
          setUser(parsedUser);
          setIsAuthenticated(true);
          setAdmin(parsedUser.role === 'admin');
          
          // Проверяем валидность сессии
          await checkSession();
        } catch (error) {
          console.error('AuthContext: Ошибка инициализации:', error);
          clearAuthData();
          setIsAuthenticated(false);
          setUser(null);
          setLoading(false);
        }
      } else {
        // Нет сохраненной сессии
        console.log('AuthContext: Нет сохраненного токена');
        console.log('AuthContext: Результат getToken():', token);
        console.log('AuthContext: localStorage keys:', Object.keys(localStorage));
        setLoading(false);
      }
    };
    
    initializeAuth();
  }, [checkSession, clearAuthData, getToken]);
  
  // Экспортировать токен для использования в других компонентах
  const contextValue = {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
    register,
    checkSession,
    updateUserData,
    admin,
    token: token || getToken()
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
