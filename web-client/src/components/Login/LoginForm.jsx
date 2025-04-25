import React, { useState } from 'react';
// import axios from 'axios'; // Убираем прямой импорт axios
import API from '../../utils/api'; // Импортируем настроенный API
import { toast } from 'react-toastify';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth(); // Используем login из AuthContext

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('LoginForm: Начало процесса входа в систему');
    
    try {
      // Вызываем login из AuthContext, который теперь использует API
      const success = await login(username, password);

      if (success) {
        console.log('LoginForm: Вход через AuthContext успешен');
        toast.success('Вход выполнен успешно');
        const nextPath = location.state?.from?.pathname || '/';
        navigate(nextPath);
      } else {
        // Ошибка будет обработана внутри AuthContext и установлена там
        // Но можно установить и локальную для отображения в этой форме
        console.error('LoginForm: Вход через AuthContext не удался');
        setError('Неверное имя пользователя или пароль'); // Пример сообщения
        toast.error('Ошибка входа: Неверное имя пользователя или пароль');
      }

    } catch (err) {
      // Эта ошибка маловероятна, если AuthContext обрабатывает свои ошибки
      console.error('LoginForm: Непредвиденная ошибка при вызове login из AuthContext:', err);
      setError('Произошла непредвиденная ошибка');
      toast.error(`Ошибка входа: Произошла непредвиденная ошибка`);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Возвращаем пустой div, так как основная логика теперь в Auth/Login.jsx
    // Либо можно вернуть JSX формы, если этот компонент все же используется где-то
    <form onSubmit={handleSubmit}>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <div>
        <label>Username:</label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </div>
      <div>
        <label>Password:</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Вход...' : 'Войти'}
      </button>
    </form>
  );
};

export default LoginForm; 