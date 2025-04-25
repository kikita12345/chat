import API from '../utils/api'; // Импортируем настроенный API

/**
 * API-функции для работы с чатами
 */

const API_URL = '/api';

// Получение списка чатов пользователя
export const getChats = async () => {
  try {
    // Используем API вместо axios
    const response = await API.get('/chat'); 
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении списка чатов:', error);
    throw error;
  }
};

// Создание нового чата
export const createChat = async (chatData) => {
  try {
    // Используем API, заголовок Authorization добавится автоматически
    const response = await API.post('/chat', chatData);
    return response.data;
  } catch (error) {
    console.error('Error creating chat:', error);
    throw error;
  }
};

// Получение сообщений чата
export const getMessages = async (chatId, page = 1, limit = 50) => {
  try {
    // Используем API
    const response = await API.get(`/chat/${chatId}/messages`, {
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    console.error('Error getting messages:', error);
    throw error;
  }
};

// Отправка сообщения
export const sendMessageApi = async (messageData) => {
  try {
    // Используем API
    const response = await API.post(`/chat/${messageData.chatId}/messages`, messageData);
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Отметка сообщений как прочитанных
export const markMessagesAsRead = async (chatId) => {
  try {
    // Используем API
    const response = await API.post(`/chat/${chatId}/read`, {});
    return response.data;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

// Получение участников чата
export const getChatParticipants = async (chatId) => {
  try {
    // Используем API
    const response = await API.get(`/chat/${chatId}/participants`);
    return response.data;
  } catch (error) {
    console.error('Error getting chat participants:', error);
    throw error;
  }
};

// Добавление участника в чат
export const addChatParticipant = async (chatId, userId) => {
  try {
    // Используем API
    const response = await API.post(`/chat/${chatId}/participants`, { userId });
    return response.data;
  } catch (error) {
    console.error('Error adding chat participant:', error);
    throw error;
  }
};

// Удаление участника из чата
export const removeChatParticipant = async (chatId, userId) => {
  try {
    // Используем API
    const response = await API.delete(`/chat/${chatId}/participants/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error removing chat participant:', error);
    throw error;
  }
}; 