import API from '../utils/api'; // Импортируем настроенный API

// Создаем экземпляр axios с базовыми настройками
const api = API.create({
  baseURL: '', // Пустая строка для обеспечения использования относительных URL
  headers: {
    'Content-Type': 'application/json'
  }
});

// Добавляем перехватчик для добавления токена авторизации
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Добавляем логирование запросов в режиме разработки
if (process.env.NODE_ENV !== 'production') {
  api.interceptors.request.use(
    (config) => {
      console.log(`API запрос: ${config.method.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      console.error('Ошибка при настройке API запроса:', error);
      return Promise.reject(error);
    }
  );
  
  api.interceptors.response.use(
    (response) => {
      console.log(`API ответ: ${response.status} для ${response.config.url}`);
      return response;
    },
    (error) => {
      console.error('API ошибка:', error.response?.status || 'нет соединения');
      return Promise.reject(error);
    }
  );
}

/**
 * Получение списка чатов
 * @returns {Promise} - Промис с ответом API
 */
export const getChats = () => {
  console.log('API запрос: GET /api/chat');
  return API.get('/chat') // Используем /chat, как в server.go
    .then(response => {
      console.log('API ответ: 200 для /api/chat');
      return response.data;
    });
};

/**
 * Получение сообщений чата
 * @param {string} chatId - ID чата
 * @returns {Promise} - Промис с ответом API
 */
export const getMessages = (chatId) => {
  return API.get(`/chat/${chatId}/messages`); // Используем /chat/...
};

/**
 * Отправка сообщения
 * @param {string} chatId - ID чата
 * @param {Object} data - Данные сообщения
 * @returns {Promise} - Промис с ответом API
 */
export const sendMessage = (chatId, data) => {
  return API.post(`/chat/${chatId}/messages`, data); // Используем /chat/...
};

/**
 * Удаление сообщения
 * @param {string} messageId - ID сообщения
 * @returns {Promise} - Промис с ответом API
 */
export const deleteMessage = (messageId) => {
  // Уточнить эндпоинт на бэкенде, пока предполагаем такой
  return API.delete(`/messages/${messageId}`);
};

/**
 * Редактирование сообщения
 * @param {string} messageId - ID сообщения
 * @param {Object} data - Новые данные сообщения
 * @returns {Promise} - Промис с ответом API
 */
export const editMessage = (messageId, data) => {
  // Уточнить эндпоинт на бэкенде, пока предполагаем такой
  return API.put(`/messages/${messageId}`, data);
};

/**
 * Отметка сообщений как прочитанных
 * @param {string} chatId - ID чата
 * @returns {Promise} - Промис с ответом API
 */
export const markAsRead = (chatId) => {
  // Используем эндпоинт из chat.js /api/chat/:chatId/read
  return API.post(`/chat/${chatId}/read`, {});
};

/**
 * Создание нового чата
 * @param {Object} data - Данные для создания чата
 * @returns {Promise} - Промис с ответом API
 */
export const createChat = async (chatData) => {
  try {
    const response = await API.post('/chat', chatData); // Используем /chat
    return response.data;
  } catch (error) {
    console.error('Ошибка при создании чата в messagesApi:', error);
    throw error; // Перебрасываем ошибку для обработки выше
  }
};

/**
 * Получение информации о чате
 * @param {string} chatId - ID чата
 * @returns {Promise} - Промис с ответом API
 */
export const getChat = (chatId) => {
  return API.get(`/chat/${chatId}`); // Используем /chat/...
};

/**
 * Выход из группового чата
 * @param {string} chatId - ID группового чата
 * @returns {Promise} - Промис с ответом API
 */
export const leaveChat = (chatId) => {
  return API.post(`/chat/${chatId}/leave`); // Используем /chat/...
};

/**
 * Добавление пользователя в групповой чат
 * @param {string} chatId - ID группового чата
 * @param {string} userId - ID пользователя для добавления
 * @returns {Promise} - Промис с ответом API
 */
export const addUserToChat = (chatId, userId) => {
  return API.post(`/chat/${chatId}/users`, { userId }); // Используем /chat/...
};

/**
 * Удаление пользователя из группового чата
 * @param {string} chatId - ID группового чата
 * @param {string} userId - ID пользователя для удаления
 * @returns {Promise} - Промис с ответом API
 */
export const removeUserFromChat = (chatId, userId) => {
  return API.delete(`/chat/${chatId}/users/${userId}`); // Используем /chat/...
};

/**
 * Обновление информации о чате
 * @param {string} chatId - ID чата
 * @param {Object} data - Новые данные чата
 * @returns {Promise} - Промис с ответом API
 */
export const updateChat = (chatId, data) => {
  return API.put(`/chat/${chatId}`, data); // Используем /chat/...
};

// Получение списка пользователей для добавления в чат (если необходимо)
export const getUsersForChat = async () => {
  try {
    const response = await API.get('/chat/users'); // Используем /chat/users
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении пользователей для чата:', error);
    throw error;
  }
};

export default api; 