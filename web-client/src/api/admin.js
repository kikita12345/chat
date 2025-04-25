import API from '../utils/api';

// Получение списка всех пользователей
export async function getUsers() {
  try {
    console.log('Запрос списка пользователей');
    const response = await API.get('/admin/users');
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении списка пользователей:', error);
    throw error;
  }
}

// Создание нового пользователя
export async function createUser(userData) {
  try {
    const response = await API.post('/admin/users', userData);
    return response.data;
  } catch (error) {
    console.error('Ошибка при создании пользователя:', error);
    throw error;
  }
}

// Обновление данных пользователя
export async function updateUser(userId, userData) {
  try {
    const response = await API.put(`/admin/users/${userId}`, userData);
    return response.data;
  } catch (error) {
    console.error('Ошибка при обновлении пользователя:', error);
    throw error;
  }
}

// Удаление пользователя
export async function deleteUser(userId) {
  try {
    const response = await API.delete(`/admin/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Ошибка при удалении пользователя:', error);
    throw error;
  }
}

// Блокировка пользователя
export async function blockUser(userId) {
  try {
    const response = await API.put(`/admin/users/${userId}/block`);
    return response.data;
  } catch (error) {
    console.error('Ошибка при блокировке пользователя:', error);
    throw error;
  }
}

// Разблокировка пользователя
export async function unblockUser(userId) {
  try {
    const response = await API.put(`/admin/users/${userId}/unblock`);
    return response.data;
  } catch (error) {
    console.error('Ошибка при разблокировке пользователя:', error);
    throw error;
  }
}

// Получение системных настроек
export async function getSystemSettings() {
  try {
    const response = await API.get('/admin/settings');
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении системных настроек:', error);
    throw error;
  }
}

// Обновление системных настроек
export async function updateSystemSettings(settings) {
  try {
    const response = await API.put('/admin/settings', settings);
    return response.data;
  } catch (error) {
    console.error('Ошибка при обновлении системных настроек:', error);
    throw error;
  }
}

// Получение статистики системы
export async function getSystemStats() {
  try {
    const response = await API.get('/admin/stats');
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении статистики системы:', error);
    // Не бросаем ошибку дальше, чтобы не прерывать работу панели
    // Можно вернуть пустой объект или null
    return null; 
  }
} 