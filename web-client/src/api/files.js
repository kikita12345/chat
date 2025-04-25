import API from '../utils/api'; // Импортируем настроенный API

// Базовый URL для API
const API_URL = '/api';

/**
 * Класс для работы с API файлов
 */
class FilesAPI {
  /**
   * Загрузка файла
   * @param {File} file - Файл для загрузки
   * @param {number} recipientId - ID получателя
   * @param {string} message - Сопроводительное сообщение (опционально)
   * @returns {Promise<Object>} Данные о загруженном файле
   */
  async uploadFile(file, recipientId, message) {
    try {
      // Создаем FormData для отправки файла
      const formData = new FormData();
      formData.append('file', file);
      formData.append('recipient_id', recipientId);
      if (message) {
        formData.append('message', message);
      }
      
      // Используем API, устанавливаем правильный Content-Type
      const response = await API.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } catch (error) {
      // Используем стандартную обработку ошибок из перехватчика API
      if (error.response) {
        throw new Error(error.response.data.error || 'Ошибка загрузки файла');
      } else if (error.request) {
        throw new Error('Сервер недоступен. Проверьте подключение к интернету');
      } else {
        throw new Error('Ошибка при отправке запроса');
      }
    }
  }

  /**
   * Получение URL для скачивания файла
   * @param {string} token - Токен для скачивания файла
   * @returns {string} URL для скачивания файла
   */
  getDownloadUrl(token) {
    // URL остается прежним, так как он публичный и не требует Authorization
    return `${API_URL}/files/download/${token}`;
  }
  
  /**
   * Определение типа файла по MIME типу
   * @param {string} mimeType - MIME тип файла
   * @returns {string} Тип файла (image, audio, video, document, other)
   */
  getFileTypeByMime(mimeType) {
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('audio/')) {
      return 'audio';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else if (
      mimeType === 'application/pdf' || 
      mimeType.startsWith('application/msword') || 
      mimeType.startsWith('application/vnd.openxmlformats-officedocument')
    ) {
      return 'document';
    } else {
      return 'other';
    }
  }
  
  /**
   * Форматирование размера файла
   * @param {number} bytes - Размер в байтах
   * @returns {string} Отформатированный размер
   */
  formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + ' Б';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' КБ';
    } else if (bytes < 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    } else {
      return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' ГБ';
    }
  }
}

// Экспорт экземпляра класса
const filesApi = new FilesAPI();
export default filesApi; 