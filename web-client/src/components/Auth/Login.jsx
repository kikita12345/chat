import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Form, Button, Card, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate, Link, useLocation } from 'react-router-dom';

// Базовый URL для API
// const API_URL = '/api'; // Больше не используется напрямую здесь

const Login = () => {
  const [username, setUsername] = useState(''); // Возвращаем username
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Используем локальный loading для UI кнопки
  const [successMessage, setSuccessMessage] = useState(''); // Добавляем state для сообщения об успехе
  // const [email, setEmail] = useState(''); // Убираем email
  const { login, isAuthenticated, loading: authLoading, error: authError } = useAuth(); // Получаем authError из контекста
  const location = useLocation(); // Получаем location
  
  useEffect(() => {
    // Отображаем ошибку из AuthContext, если она есть
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  // Отображаем сообщение об успехе, если оно передано из Register
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Очищаем state, чтобы сообщение не оставалось при перезагрузке
      window.history.replaceState({}, '') 
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Сбрасываем локальную ошибку перед попыткой
    
    // Валидация username и password
    if (!username || !password) {
      setError('Пожалуйста, заполните поля Имя пользователя и Пароль');
      return;
    }
    
    setLoading(true); // Включаем локальный спиннер
    try {
      console.log('Login: Вызов функции login из AuthContext...');
      // Передаем username и password
      const success = await login(username, password); 

      if (!success) {
        // Ошибка будет установлена в AuthContext и перехвачена в useEffect
        console.log('Login: Функция login вернула false');
      } else {
        console.log('Login: Успешный вход');
        // Перенаправление происходит автоматически через Navigate
      }
    } catch (err) {
      // Эта ошибка маловероятна, так как login должна обрабатывать свои ошибки
      console.error('Login: Непредвиденная ошибка при вызове login:', err);
      setError('Произошла непредвиденная ошибка');
    } finally {
      setLoading(false); // Выключаем локальный спиннер
    }
  };

  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="w-100" style={{ maxWidth: '400px' }}>
        <Card>
          <Card.Body>
            <h2 className="text-center mb-4">Вход в систему</h2>
            {/* Отображаем сообщение об успехе */} 
            {successMessage && (
              <Alert variant="success">{successMessage}</Alert>
            )}
            {/* Отображаем локальную ошибку или ошибку из AuthContext */}
            {error && (
              <Alert variant="danger">{error}</Alert>
            )}
            <Form onSubmit={handleSubmit}>
              {/* Заменяем Email на Имя пользователя */}
              <Form.Group className="mb-3" controlId="formBasicUsername">
                <Form.Label>Имя пользователя</Form.Label>
                <Form.Control
                  type="text" // Меняем тип на text
                  placeholder="Введите имя пользователя"
                  value={username} // Используем username
                  onChange={(e) => setUsername(e.target.value)} // Обновляем username
                  required
                  isInvalid={!!error} // Помечаем поле как невалидное при ошибке
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="formBasicPassword">
                <Form.Label>Пароль</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  isInvalid={!!error} // Помечаем поле как невалидное при ошибке
                />
              </Form.Group>
              {/* Используем локальный loading или authLoading для дизейбла кнопки */}
              <Button variant="primary" type="submit" className="w-100" disabled={loading || authLoading}>
                {(loading || authLoading) ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Войти'}
              </Button>
            </Form>
            <div className="mt-3 text-center">
              Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
            </div>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
};

export default Login;
