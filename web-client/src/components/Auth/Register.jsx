import React, { useState } from 'react';
import { Form, Button, Card, Alert, Container, Row, Col, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, loading: authLoading, error: authError } = useAuth();
  const navigate = useNavigate();

  // Используем authError из контекста, если он есть
  React.useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    if (password.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }

    setLoading(true);
    try {
      // Вызываем register из AuthContext
      const result = await register({ username, password });

      if (result.success) {
        console.log('Регистрация успешна, перенаправление на /login...');
        // Перенаправляем на страницу входа с сообщением об успехе
        navigate('/login', { 
          replace: true, 
          state: { message: 'Регистрация прошла успешно. Пожалуйста, войдите.' } 
        });
      } else {
        // Ошибка будет установлена в AuthContext и отображена через useEffect
        console.error('Ошибка регистрации из AuthContext:', result.error);
        setError(result.error || 'Ошибка регистрации'); // Устанавливаем локальную ошибку
      }
    } catch (err) {
      // Эта ошибка маловероятна, если AuthContext обрабатывает свои ошибки
      console.error('Непредвиденная ошибка при вызове register:', err);
      setError('Произошла непредвиденная ошибка при регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="w-100" style={{ maxWidth: '400px' }}>
        <Card>
          <Card.Body>
            <h2 className="text-center mb-4">Регистрация</h2>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="username">
                <Form.Label>Имя пользователя</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Введите имя пользователя"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  isInvalid={!!error}
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="password">
                <Form.Label>Пароль</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Пароль (минимум 8 символов)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  isInvalid={!!error}
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="confirmPassword">
                <Form.Label>Подтвердите пароль</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Подтвердите пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  isInvalid={!!error || password !== confirmPassword}
                />
                {password !== confirmPassword && confirmPassword && (
                  <Form.Text className="text-danger">
                    Пароли не совпадают
                  </Form.Text>
                )}
              </Form.Group>

              <Button variant="primary" type="submit" className="w-100" disabled={loading || authLoading}>
                {loading || authLoading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Зарегистрироваться'}
              </Button>
            </Form>
            <div className="mt-3 text-center">
              Уже есть аккаунт? <Link to="/login">Войти</Link>
            </div>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
};

export default Register; 