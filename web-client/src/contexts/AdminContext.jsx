import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import API from '../utils/api';
import { useNavigate } from 'react-router-dom';

// Создаем контекст с дефолтными значениями чтобы избежать null
const AdminContext = createContext({
  users: [],
  settings: {
    registrationEnabled: false,
    maxUploadSize: 10,
    messageRetentionDays: 30,
    callTimeout: 60,
    maxGroupSize: 20,
    enableGeminiPro: false // Новое поле по умолчанию
  },
  loading: true,
  error: null,
  loadUsers: () => {},
  createUser: () => {},
  updateUser: () => {},
  deleteUser: () => {},
  toggleRegistration: () => {},
  updateSettings: () => {},
  getStats: () => {},
});

export const AdminProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  // Добавляем проверку на роль администратора
  useEffect(() => {
    if (isAuthenticated && user?.role !== 'admin') {
      navigate('/');
      toast.error('У вас нет прав администратора');
    }
  }, [isAuthenticated, user, navigate]);

  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({
    registrationEnabled: false,
    maxUploadSize: 10,
    messageRetentionDays: 30,
    callTimeout: 60,
    maxGroupSize: 20,
    enableGeminiPro: false // Новое поле по умолчанию
  });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState({
    users: false,
    settings: false,
    stats: false,
  });
  const [error, setError] = useState({
    users: null,
    settings: null,
    stats: null,
  });
  const [apiError, setApiError] = useState({ users: null, settings: null });
  const [selectedUser, setSelectedUser] = useState(null);

  // Функция для загрузки настроек системы
  const fetchSettings = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'admin') return;
    
    const defaultSettings = {
      registrationEnabled: false,
      maxUploadSize: 10,
      messageRetentionDays: 30,
      callTimeout: 60,
      maxGroupSize: 20,
      enableGeminiPro: false, // Новое поле по умолчанию
      // Добавляем поля, которые приходят от API, если они нужны в UI
      maintenance_mode: false, 
      app_name: 'Мессенджер',
      app_version: '0.0.0'
    };

    try {
      console.log('Admin: Загрузка настроек системы');
      setLoading(prev => ({ ...prev, settings: true })); 
      setApiError(prev => ({ ...prev, settings: null }));

      const response = await API.get('/admin/settings');
      console.log('[AdminContext] Raw settings response data:', response.data);
      
      if (response.data && typeof response.data === 'object') {
        // Объединяем дефолтные настройки с полученными данными
        const mergedSettings = { 
            ...defaultSettings, 
            ...response.data, 
            // Явно преобразуем имена полей, если они отличаются
            registrationEnabled: response.data.registration_enabled, 
            enableGeminiPro: response.data.enable_gemini_pro // Обрабатываем новое поле
        };
        setSettings(mergedSettings);
        return mergedSettings;
      } else {
        console.warn('Admin: Сервер вернул некорректные данные настроек, используем дефолтные значения');
        setSettings(defaultSettings);
        setApiError(prev => ({ ...prev, settings: 'Некорректный формат данных настроек от сервера' }));
        return defaultSettings;
      }
    } catch (error) {
      console.error('Admin: Ошибка загрузки настроек:', error);
      setApiError(prev => ({ ...prev, settings: 'Ошибка загрузки настроек. ' + (error.response?.data?.message || error.message) }));
      setSettings(defaultSettings); // Устанавливаем дефолт при ошибке
      toast.error('Ошибка загрузки настроек администратора');
      return defaultSettings;
    } finally {
      setLoading(prev => ({ ...prev, settings: false }));
    }
  }, [isAuthenticated, user, API]);

  // Функция для обновления настроек
  const updateSettings = useCallback(async (newSettings) => {
    if (!isAuthenticated || user?.role !== 'admin') return false;
    
    setLoading(prev => ({ ...prev, settings: true }));
    setApiError(prev => ({ ...prev, settings: null }));
    try {
      // Преобразуем camelCase в snake_case перед отправкой
      const settingsToSend = {
        registration_enabled: newSettings.registrationEnabled,
        maintenance_mode: newSettings.maintenanceMode,
        enable_gemini_pro: newSettings.enableGeminiPro // Добавляем новое поле
        // Добавьте другие поля при необходимости
      };
      const response = await API.put('/admin/settings', settingsToSend);
      
      if (response.status === 200 && response.data) {
        // Обновляем локальное состояние с данными из ответа сервера
        // (сервер возвращает обновленные настройки в snake_case)
        const updatedSettings = {
          ...settings, // Берем текущие настройки
          registrationEnabled: response.data.registration_enabled,
          maintenanceMode: response.data.maintenance_mode,
          enableGeminiPro: response.data.enable_gemini_pro // Обновляем новое поле
          // Добавьте другие поля при необходимости
        };
        setSettings(updatedSettings);
        toast.success('Настройки обновлены');
        return true;
      } else {
        console.error("Admin: Некорректный ответ сервера при обновлении настроек:", response);
        setApiError(prev => ({ ...prev, settings: 'Некорректный ответ сервера при обновлении настроек' }));
        toast.error('Не удалось обновить настройки: Некорректный ответ сервера');
        return false;
      }
    } catch (err) {
      console.error('Admin: Ошибка при обновлении настроек', err);
      setApiError(prev => ({ ...prev, settings: err.response?.data?.message || err.message || 'Ошибка при обновлении настроек' }));
      toast.error('Не удалось обновить настройки системы');
      return false;
    } finally {
      setLoading(prev => ({ ...prev, settings: false }));
    }
  }, [isAuthenticated, user, API, setApiError, settings]); // Добавляем settings в зависимости

  // Функция для переключения регистрации
  const toggleRegistration = useCallback(async (value) => {
    if (user?.role !== 'admin') return false;
    
    // Обновляем локальное состояние для немедленного отражения в UI
    setSettings(prev => ({
      ...prev,
      registrationEnabled: value
    }));
    return await updateSettings({ registrationEnabled: value });
  }, [user, updateSettings]);

  // Функция для получения статистики
  const getStats = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'admin') return null;
    
    try {
      const response = await axios.get('/api/admin/stats', {
        headers: {
          Authorization: `Bearer ${user?.token}`
        }
      });
      
      if (response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('Admin: Ошибка при получении статистики', err);
      toast.error('Не удалось получить статистику');
      return null;
    }
  }, [user, isAuthenticated]);

  // Функция для загрузки списка пользователей
  const loadUsers = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'admin') {
      console.warn('Admin: Попытка загрузить пользователей без нужных прав');
      return;
    }
    
    // Устанавливаем loading для пользователей
    setLoading(prev => ({ ...prev, users: true }));
    // Сбрасываем ошибку пользователей
    setApiError(prev => ({ ...prev, users: null }));
    
    try {
      console.log('Admin: Загрузка списка пользователей');
      // Используем API для консистентности
      const response = await API.get('/admin/users');
      
      // Проверяем ответ сервера
      if (response.data && Array.isArray(response.data.users)) {
        setUsers(response.data.users);
        console.log(`Admin: Загружено ${response.data.users.length} пользователей`);
      } else {
        setUsers([]);
        console.warn('Admin: Сервер вернул некорректные данные пользователей', response.data);
        setApiError(prev => ({ ...prev, users: 'Некорректные данные пользователей' }));
      }
    } catch (err) {
      console.error('Admin: Ошибка при загрузке пользователей', err);
      // Устанавливаем ошибку для пользователей
      setApiError(prev => ({ ...prev, users: err.message || 'Ошибка при загрузке списка пользователей' }));
      setUsers([]);
      toast.error('Не удалось загрузить список пользователей');
    } finally {
      // Сбрасываем loading для пользователей
      setLoading(prev => ({ ...prev, users: false }));
    }
  }, [isAuthenticated, user, API]);

  // Функция для создания нового пользователя
  const createUser = useCallback(async (userData) => {
    if (!isAuthenticated || user?.role !== 'admin') {
      toast.error('У вас нет прав администратора');
      return { success: false, error: 'Недостаточно прав' };
    }
    
    setLoading(prev => ({ ...prev, users: true }));
    setApiError(prev => ({ ...prev, users: null }));
    console.log("[AdminContext] Вызов createUser с данными:", userData);
    try {
      const response = await axios.post('/api/admin/users', userData, {
        headers: {
          Authorization: `Bearer ${user?.token}`
        }
      });
      
      // Добавляем нового пользователя в состояние
      if (response.data && response.data.user) {
        setUsers(prev => [...prev, response.data.user]);
        toast.success('Пользователь успешно создан');
        return { success: true, data: response.data.user };
      }
      return { success: false, error: 'Не удалось создать пользователя' };
    } catch (err) {
      console.error('Admin: Ошибка при создании пользователя', err);
      setError(err.message || 'Ошибка при создании пользователя');
      toast.error('Не удалось создать пользователя');
      return { success: false, error: err.message || 'Ошибка при создании пользователя' };
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated, API]);

  // Функция для обновления данных пользователя
  const updateUser = useCallback(async (userId, userData) => {
    if (!isAuthenticated || user?.role !== 'admin') {
      toast.error('У вас нет прав администратора');
      return { success: false, error: 'Недостаточно прав' };
    }
    
    setLoading(prev => ({...prev, users: true})); // Используем объектный loading
    setApiError(prev => ({ ...prev, users: null }));
    try {
      // Добавляем обязательное поле username, если его нет в userData
      const updatedData = {
        ...userData,
        username: userData.username || userData.display_name || selectedUser?.username
      };
      
      // Исправляем URL: убираем /admin
      const response = await API.put(`/users/${userId}`, updatedData); 
      
      if (response.data && response.data.user) {
        setUsers(prev => 
          prev.map(user => user.id === userId ? response.data.user : user)
        );
        toast.success('Данные пользователя обновлены');
        return { success: true, data: response.data.user };
      } else {
         console.warn("Update user response did not contain user data:", response.data);
         setApiError(prev => ({ ...prev, users: 'Некорректный ответ сервера при обновлении пользователя' }));
         return { success: false, error: 'Некорректный ответ сервера при обновлении пользователя' };
      }
    } catch (err) {
      console.error('Admin: Ошибка при обновлении пользователя', err);
      setApiError(prev => ({ ...prev, users: err.response?.data?.message || err.message || 'Ошибка при обновлении пользователя' })); 
      toast.error('Не удалось обновить данные пользователя');
      return { success: false, error: err.response?.data?.message || err.message || 'Ошибка при обновлении пользователя' };
    } finally {
      setLoading(prev => ({...prev, users: false})); // Используем объектный loading
    }
  }, [user, isAuthenticated, API, setApiError, selectedUser]); // Добавляем selectedUser в зависимости

  // Функция для удаления пользователя
  const deleteUser = useCallback(async (userId) => {
    if (!isAuthenticated || user?.role !== 'admin') {
      toast.error('У вас нет прав администратора');
      return { success: false, error: 'Недостаточно прав' };
    }
    
    setLoading(true);
    try {
      await axios.delete(`/api/admin/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${user?.token}`
        }
      });
      
      // Удаляем пользователя из состояния
      setUsers(prev => prev.filter(user => user.id !== userId));
      toast.success('Пользователь удален');
      return { success: true };
    } catch (err) {
      console.error('Admin: Ошибка при удалении пользователя', err);
      setError(err.message || 'Ошибка при удалении пользователя');
      toast.error('Не удалось удалить пользователя');
      return { success: false, error: err.message || 'Ошибка при удалении пользователя' };
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated, API]);

  // Функция для блокировки/разблокировки пользователя
  const toggleUserBlock = useCallback(async (userId, blocked) => {
    if (!isAuthenticated || user?.role !== 'admin') return false;
    
    setLoading(true);
    try {
      const response = await axios.put(`/api/admin/users/${userId}/block`, { blocked }, {
        headers: {
          Authorization: `Bearer ${user?.token}`
        }
      });
      
      // Обновляем пользователя в состоянии
      if (response.data && response.data.user) {
        setUsers(prev => 
          prev.map(user => user.id === userId ? response.data.user : user)
        );
        toast.success(blocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
        return true;
      }
      return false;
    } catch (err) {
      console.error('Admin: Ошибка при блокировке/разблокировке пользователя', err);
      setError(err.message || 'Ошибка при изменении статуса пользователя');
      toast.error('Не удалось изменить статус пользователя');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated, API]);

  // Эффект для загрузки пользователей и настроек при монтировании компонента
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      console.log('AdminContext: Инициализация и загрузка данных');
      // Устанавливаем начальное состояние загрузки при аутентификации
      setLoading({ users: true, settings: true });
      loadUsers();
      fetchSettings();
    } else {
      console.log('AdminContext: Пользователь не администратор или не аутентифицирован');
      setUsers([]);
      // Сбрасываем loading, если не аутентифицирован или не админ
      setLoading({ users: false, settings: false });
    }
  }, [isAuthenticated, user, loadUsers, fetchSettings]);

  // Создаем значение контекста
  const contextValue = {
    users,
    settings,
    loading,
    apiError,
    isAdmin: user?.role === 'admin',
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    toggleUserBlock,
    toggleRegistration,
    updateSettings,
    getStats,
    fetchSettings,
  };

  return (
    <AdminContext.Provider value={contextValue}>
      {children}
    </AdminContext.Provider>
  );
};

// Хук для использования AdminContext
export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    console.error('useAdmin должен использоваться внутри AdminProvider');
  }
  return context;
};

export default AdminContext;