import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Tab, Nav, Table, Button, Form, Alert, Badge, Modal, Spinner } from 'react-bootstrap';
import { useAdmin } from '../../contexts/AdminContext';
import { useAuth } from '../../contexts/AuthContext';
import UsersList from './UsersList';
import UserForm from './UserForm';
import SystemSettings from './SystemSettings';
import Statistics from './Statistics';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUser, 
  faUsers, 
  faTrash, 
  faEdit, 
  faUserPlus, 
  faChartLine, 
  faCog, 
  faExclamationTriangle,
  faCheckCircle,
  faTimesCircle,
  faServer,
  faDatabase
} from '@fortawesome/free-solid-svg-icons';
import API from '../../utils/api';
import './AdminPanel.css';
import { Navigate } from 'react-router-dom';

const AdminPanel = () => {
  const { user, isAuthenticated } = useAuth();
  const { 
    users, 
    settings, 
    loading: adminContextLoading, 
    apiError: adminContextApiError,
    loadUsers,
    updateSettings, 
    toggleRegistration, 
    createUser, 
    updateUser, 
    toggleUserBlock, 
    deleteUser,
    getStats,
    fetchSettings,
  } = useAdmin();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    display_name: '',
    password: '',
    confirm_password: '',
    role: 'user'
  });
  const [formError, setFormError] = useState('');
  const [statsLoading, setStatsLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [validated, setValidated] = useState(false);
  const [apiError, setApiError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [statusError, setStatusError] = useState(null);
  const [stats, setStats] = useState(null);
  const [localSettings, setLocalSettings] = useState(null);
  const [settingsError, setSettingsError] = useState(null);

  const fetchSystemStatus = useCallback(async () => {
    try {
      setStatusError(null);
      const response = await API.get('/admin/system/status');
      setSystemStatus(response.data);
    } catch (err) {
      console.error('Ошибка при загрузке статуса системы:', err);
      setStatusError('Не удалось загрузить статус системы.');
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      console.log('AdminPanel useEffect: Загрузка основных данных (пользователи, статус)');
      loadUsers();
      getStats();
      fetchSystemStatus();
    }
  }, [isAuthenticated, user, loadUsers, getStats, fetchSystemStatus]);

  useEffect(() => {
    const loadAdminSettings = async () => {
      if (isAuthenticated && user?.role === 'admin') {
        console.log('AdminPanel useEffect: Загрузка настроек');
        setSettingsError(null);
        try {
          if (settings) { 
             setLocalSettings({...settings});
             console.log("AdminPanel: Настройки установлены в локальное состояние из контекста:", settings);
          } else {
             const loadedSettings = await fetchSettings();
             if (loadedSettings) {
               setLocalSettings(loadedSettings);
               console.log("AdminPanel: Настройки загружены и установлены в локальное состояние:", loadedSettings);
             } else {
               setLocalSettings({});
               console.warn("AdminPanel: Настройки не были загружены из fetchSettings.");
               setSettingsError("Не удалось загрузить настройки системы.");
             }
          }
        } catch (error) {
          console.error('AdminPanel: Ошибка при загрузке/установке настроек:', error);
          setLocalSettings({});
          setSettingsError("Ошибка при загрузке настроек системы.");
        }
      }
    };
    loadAdminSettings();
  }, [isAuthenticated, user, fetchSettings, settings]);

  useEffect(() => {
    const loadStats = async () => {
      if (isAuthenticated && user?.role === 'admin') {
        console.log('AdminPanel useEffect: Загрузка статистики');
        setStatsLoading(true);
        try {
          const statsData = await getStats();
          if (statsData) {
            setStats(statsData);
          } else {
            setStats(null);
            console.warn('Не удалось получить данные статистики');
          }
        } catch (error) {
          console.error('Ошибка при загрузке статистики:', error);
          setStats(null);
        } finally {
          setStatsLoading(false);
        }
      }
    };
    
    loadStats();
  }, [isAuthenticated, user, getStats]);
  
  const handleUserFormChange = (e) => {
    const { name, value } = e.target;
    setUserForm(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (userForm.password !== userForm.confirm_password) {
      return setFormError('Пароли не совпадают');
    }
    
    if (!userForm.email.includes('@')) {
      return setFormError('Пожалуйста, введите корректный email');
    }
    
    const userData = {
      username: userForm.username,
      email: userForm.email,
      display_name: userForm.display_name,
      password: userForm.password,
      role: userForm.role
    };
    
    const result = await createUser(userData);
    
    if (result) {
      setUserForm({
        username: '',
        email: '',
        display_name: '',
        password: '',
        confirm_password: '',
        role: 'user'
      });
      setShowCreateModal(false);
    }
  };
  
  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (!userForm.email.includes('@')) {
      return setFormError('Пожалуйста, введите корректный email');
    }
    
    const userData = {
      email: userForm.email,
      display_name: userForm.display_name,
      role: userForm.role
    };
    
    if (userForm.password) {
      if (userForm.password !== userForm.confirm_password) {
        return setFormError('Пароли не совпадают');
      }
      userData.password = userForm.password;
    }
    
    const result = await updateUser(selectedUser.id, userData);
    
    if (result) {
      setUserForm({
        username: '',
        email: '',
        display_name: '',
        password: '',
        confirm_password: '',
        role: 'user'
      });
      setShowEditModal(false);
      setSelectedUser(null);
    }
  };
  
  const handleDeleteUserConfirm = async () => {
    if (selectedUser) {
      await deleteUser(selectedUser.id);
      setShowDeleteModal(false);
      setSelectedUser(null);
    }
  };
  
  const handleToggleBlock = async (userId, currentState) => {
    await toggleUserBlock(userId, !currentState);
  };
  
  const openEditModal = (user) => {
    setSelectedUser(user);
    setUserForm({
      username: user.username,
      email: user.email || '',
      display_name: user.display_name || '',
      password: '',
      confirm_password: '',
      role: user.role || 'user'
    });
    setShowEditModal(true);
  };
  
  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleAddUser = async (event) => {
    event.preventDefault();
    console.log('AdminPanel.jsx: handleAddUser СРАБОТАЛО!', { ...userForm });

    if (userForm.password !== userForm.confirm_password) {
      setFormError('Пароли не совпадают');
      return;
    }
    
    if (!userForm.email.includes('@')) {
      setFormError('Пожалуйста, введите корректный email');
      return;
    }
    
    setApiError(null);
    setLoading(true);
    setFormError(null);

    try {
      const response = await API.post('/users', userForm);
      loadUsers([...users, response.data]);
      setUserForm({
        username: '',
        email: '',
        display_name: '',
        password: '',
        confirm_password: '',
        role: 'user'
      });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Ошибка при добавлении пользователя:', error);
      setApiError(error.response?.data?.message || 'Не удалось добавить пользователя');
    } finally {
      setLoading(false);
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserForm({
      ...userForm,
      [name]: value
    });
  };
  
  const resetForm = () => {
    setUserForm({
      username: '',
      email: '',
      display_name: '',
      password: '',
      confirm_password: '',
      role: 'user'
    });
    setValidated(false);
    setApiError('');
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLocalSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value, 10) || 0 : value
    }));
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSettingsError(null);
    if (localSettings) {
      console.log("AdminPanel: Попытка сохранить настройки:", localSettings);
      const success = await updateSettings(localSettings);
      if (success) {
        alert('Настройки успешно сохранены!');
      } else {
        setSettingsError(adminContextApiError.settings || 'Не удалось сохранить настройки.');
        alert('Ошибка сохранения настроек.');
      }
    } else {
       console.error('AdminPanel: Ошибка сохранения - localSettings пуст.');
       setSettingsError('Не удалось сохранить настройки. Данные не готовы.');
    }
  };

  if (!isAuthenticated) {
    return (
        <Container className="mt-4 d-flex justify-content-center">
            <Spinner animation="border" role="status">
                <span className="visually-hidden">Загрузка...</span>
            </Spinner>
        </Container>
    );
  }
  
  if (user?.role !== 'admin') {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Отказано в доступе</Alert.Heading>
          <p>У вас нет прав для доступа к административной панели.</p>
        </Alert>
      </Container>
    );
  }

  const isUsersLoading = adminContextLoading.users;
  const isSettingsLoading = adminContextLoading.settings;
  const usersError = adminContextApiError.users;

  return (
    <Container fluid className="py-4">
      <Card>
        <Card.Header>
          <h4 className="mb-0">Администрирование</h4>
        </Card.Header>
        <Card.Body>
          {apiError && <Alert variant="danger">{apiError}</Alert>}
          {usersError && <Alert variant="danger">Ошибка загрузки пользователей: {usersError}</Alert>}
          {settingsError && <Alert variant="danger">Ошибка настроек: {settingsError}</Alert>}
          
          <Tab.Container id="admin-tabs" defaultActiveKey="dashboard" activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
            <Row>
              <Col sm={3}>
                <Nav variant="pills" className="flex-column mb-3">
                  <Nav.Item>
                    <Nav.Link eventKey="dashboard">Обзор</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="users">Пользователи</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="settings">Настройки</Nav.Link>
                  </Nav.Item>
                </Nav>
              </Col>
              <Col sm={9}>
                <Tab.Content>
                  <Tab.Pane eventKey="dashboard">
                    <h5 className="mb-4">Статистика системы</h5>
                    
                    {statsLoading ? (
                      <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-2">Загрузка статистики...</p>
                      </div>
                    ) : stats ? (
                      <Row>
                        <Col md={4} className="mb-3">
                          <Card className="text-center h-100">
                            <Card.Body>
                              <h2 className="display-4">{stats.userCount ?? 'N/A'}</h2>
                              <Card.Title>Пользователей</Card.Title>
                            </Card.Body>
                          </Card>
                        </Col>
                        <Col md={4} className="mb-3">
                          <Card className="text-center h-100">
                            <Card.Body>
                              <h2 className="display-4">{stats.activeUsers}</h2>
                              <Card.Title>Активны сегодня</Card.Title>
                            </Card.Body>
                          </Card>
                        </Col>
                        <Col md={4} className="mb-3">
                          <Card className="text-center h-100">
                            <Card.Body>
                              <h2 className="display-4">{stats.messageCount}</h2>
                              <Card.Title>Сообщений</Card.Title>
                            </Card.Body>
                          </Card>
                        </Col>
                        {stats.diskUsage && (
                          <Col md={6} className="mb-3">
                            <Card>
                              <Card.Body>
                                <Card.Title>Использование диска</Card.Title>
                                <div className="d-flex justify-content-between align-items-center mt-3">
                                  <div className="progress w-75">
                                    <div
                                      className={`progress-bar ${stats.diskUsage.percentage > 80 ? 'bg-danger' : stats.diskUsage.percentage > 60 ? 'bg-warning' : 'bg-success'}`}
                                      role="progressbar"
                                      style={{ width: `${stats.diskUsage.percentage}%` }}
                                      aria-valuenow={stats.diskUsage.percentage}
                                      aria-valuemin="0"
                                      aria-valuemax="100"
                                    />
                                  </div>
                                  <span>{stats.diskUsage.percentage}%</span>
                                </div>
                                <div className="small text-muted mt-2">
                                  {stats.diskUsage.used} / {stats.diskUsage.total}
                                </div>
                              </Card.Body>
                            </Card>
                          </Col>
                        )}
                        {stats.memoryUsage && (
                          <Col md={6} className="mb-3">
                            <Card>
                              <Card.Body>
                                <Card.Title>Использование памяти</Card.Title>
                                <div className="d-flex justify-content-between align-items-center mt-3">
                                  <div className="progress w-75">
                                    <div
                                      className={`progress-bar ${stats.memoryUsage.percentage > 80 ? 'bg-danger' : stats.memoryUsage.percentage > 60 ? 'bg-warning' : 'bg-success'}`}
                                      role="progressbar"
                                      style={{ width: `${stats.memoryUsage.percentage}%` }}
                                      aria-valuenow={stats.memoryUsage.percentage}
                                      aria-valuemin="0"
                                      aria-valuemax="100"
                                    />
                                  </div>
                                  <span>{stats.memoryUsage.percentage}%</span>
                                </div>
                                <div className="small text-muted mt-2">
                                  {stats.memoryUsage.used} / {stats.memoryUsage.total}
                                </div>
                              </Card.Body>
                            </Card>
                          </Col>
                        )}
                      </Row>
                    ) : (
                      <Alert variant="info">Нет доступной статистики или произошла ошибка загрузки.</Alert>
                    )}
                  </Tab.Pane>
                  
                  <Tab.Pane eventKey="users">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <h5 className="mb-0">Управление пользователями</h5>
                      <Button variant="primary" onClick={() => setShowAddUserModal(true)}>
                        <FontAwesomeIcon icon={faUserPlus} className="me-1" />
                        Добавить пользователя
                      </Button>
                    </div>
                    
                    {isUsersLoading ? (
                      <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-2">Загрузка пользователей...</p>
                      </div>
                    ) : users && users.length > 0 ? (
                      <div className="table-responsive">
                        <Table striped bordered hover>
                          <thead>
                            <tr>
                              <th>Имя пользователя</th>
                              <th>Email</th>
                              <th>Роль</th>
                              <th>Статус</th>
                              <th>Действия</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map(user => (
                              <tr key={user.id}>
                                <td>{user.display_name || user.username}</td>
                                <td>{user.email}</td>
                                <td>
                                  {user.role === 'admin' ? (
                                    <Badge bg="danger">Администратор</Badge>
                                  ) : (
                                    <Badge bg="secondary">Пользователь</Badge>
                                  )}
                                </td>
                                <td>
                                  {user.blocked ? (
                                    <Badge bg="danger">Заблокирован</Badge>
                                  ) : (
                                    <Badge bg="success">Активен</Badge>
                                  )}
                                </td>
                                <td>
                                  <div className="d-flex gap-2">
                                    <Button 
                                      variant="outline-secondary" 
                                      size="sm"
                                      onClick={() => openEditModal(user)}
                                    >
                                      Редактировать
                                    </Button>
                                    <Button 
                                      variant={user.blocked ? "outline-success" : "outline-warning"} 
                                      size="sm"
                                      onClick={() => handleToggleBlock(user.id, user.blocked)}
                                    >
                                      {user.blocked ? "Разблокировать" : "Заблокировать"}
                                    </Button>
                                    <Button 
                                      variant="outline-danger" 
                                      size="sm"
                                      onClick={() => openDeleteModal(user)}
                                    >
                                      Удалить
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    ) : (
                      <Alert variant="info">Нет пользователей для отображения {usersError ? `(${usersError})` : ''}</Alert>
                    )}
                  </Tab.Pane>
                  
                  <Tab.Pane eventKey="settings">
                    <h5 className="mb-4">Настройки системы</h5>
                    
                    {localSettings === null ? (
                      <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-2">Загрузка настроек...</p>
                      </div>
                    ) : (
                      <Form onSubmit={handleSettingsSubmit}>
                        <Form.Group className="mb-3">
                          <Form.Check 
                            type="switch"
                            id="registration-enabled"
                            name="registrationEnabled"
                            label="Регистрация пользователей разрешена"
                            checked={localSettings.registrationEnabled || false}
                            onChange={handleSettingsChange}
                            disabled={isSettingsLoading}
                          />
                          <Form.Text className="text-muted">
                            Когда регистрация отключена, новые пользователи не могут создавать аккаунты. Только администратор может создавать новых пользователей.
                          </Form.Text>
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                          <Form.Label>Максимальный размер загружаемых файлов (МБ)</Form.Label>
                          <Form.Control 
                            type="number" 
                            name="maxUploadSize"
                            value={localSettings.maxUploadSize ?? ''}
                            onChange={handleSettingsChange}
                            min="1"
                            max="1000"
                            disabled={isSettingsLoading}
                          />
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                          <Form.Label>Время хранения сообщений (дней)</Form.Label>
                          <Form.Control 
                            type="number" 
                            name="messageRetentionDays"
                            value={localSettings.messageRetentionDays ?? ''}
                            onChange={handleSettingsChange}
                            min="1"
                            disabled={isSettingsLoading}
                          />
                          <Form.Text className="text-muted">
                            Сообщения старше указанного срока будут автоматически удалены для экономии места.
                          </Form.Text>
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                          <Form.Label>Максимальное время звонка (секунд)</Form.Label>
                          <Form.Control 
                            type="number" 
                            name="callTimeout"
                            value={localSettings.callTimeout ?? ''}
                            onChange={handleSettingsChange}
                            min="10"
                            max="300"
                            disabled={isSettingsLoading}
                          />
                          <Form.Text className="text-muted">
                            Время ожидания ответа на звонок.
                          </Form.Text>
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                          <Form.Label>Максимальное количество участников в групповом чате</Form.Label>
                          <Form.Control 
                            type="number" 
                            name="maxGroupSize"
                            value={localSettings.maxGroupSize ?? ''}
                            onChange={handleSettingsChange}
                            min="2"
                            max="100"
                            disabled={isSettingsLoading}
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Check 
                            type="switch"
                            id="maintenance-mode"
                            name="maintenanceMode"
                            label="Режим обслуживания включен"
                            checked={localSettings.maintenanceMode || false}
                            onChange={handleSettingsChange}
                            disabled={isSettingsLoading}
                          />
                          <Form.Text className="text-muted">
                            В режиме обслуживания только администраторы могут использовать систему.
                          </Form.Text>
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Check 
                            type="switch"
                            id="enable-gemini-pro"
                            name="enableGeminiPro"
                            label="Включить Gemini 2.5 Pro (Preview) для всех клиентов"
                            checked={localSettings.enableGeminiPro || false}
                            onChange={handleSettingsChange}
                            disabled={isSettingsLoading}
                          />
                          <Form.Text className="text-muted">
                            Активирует экспериментальные функции Gemini 2.5 Pro.
                          </Form.Text>
                        </Form.Group>

                        <Button variant="primary" type="submit" disabled={isSettingsLoading}>
                          {isSettingsLoading ? 'Сохранение...' : 'Сохранить настройки'}
                        </Button>
                      </Form>
                    )}
                  </Tab.Pane>
                </Tab.Content>
              </Col>
            </Row>
          </Tab.Container>
        </Card.Body>
      </Card>
      
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Создание нового пользователя</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError && <Alert variant="danger">{formError}</Alert>}
          
          <Form noValidate validated={validated} onSubmit={handleAddUser}>
            <Form.Group className="mb-3">
              <Form.Label>Имя пользователя</Form.Label>
              <Form.Control 
                type="text" 
                name="username" 
                value={userForm.username} 
                onChange={handleInputChange} 
                required 
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control 
                type="email" 
                name="email" 
                value={userForm.email} 
                onChange={handleInputChange} 
                required 
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Отображаемое имя</Form.Label>
              <Form.Control 
                type="text" 
                name="display_name" 
                value={userForm.display_name} 
                onChange={handleInputChange} 
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Пароль</Form.Label>
              <Form.Control 
                type="password" 
                name="password" 
                value={userForm.password} 
                onChange={handleInputChange} 
                required 
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Подтверждение пароля</Form.Label>
              <Form.Control 
                type="password" 
                name="confirm_password" 
                value={userForm.confirm_password} 
                onChange={handleInputChange} 
                required 
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Роль</Form.Label>
              <Form.Select 
                name="role" 
                value={userForm.role} 
                onChange={handleInputChange}
              >
                <option value="user">Пользователь</option>
                <option value="admin">Администратор</option>
              </Form.Select>
            </Form.Group>
            
            <div className="d-flex justify-content-end">
              <Button variant="secondary" className="me-2" onClick={() => setShowCreateModal(false)}>
                Отмена
              </Button>
              <Button variant="primary" type="submit" disabled={adminContextLoading}>
                {adminContextLoading ? 'Создание...' : 'Создать пользователя'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
      
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Редактирование пользователя</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError && <Alert variant="danger">{formError}</Alert>}
          
          <Form noValidate validated={validated} onSubmit={handleEditUserSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Имя пользователя</Form.Label>
              <Form.Control 
                type="text" 
                value={userForm.username} 
                disabled 
              />
              <Form.Text className="text-muted">
                Имя пользователя не может быть изменено
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control 
                type="email" 
                name="email" 
                value={userForm.email} 
                onChange={handleInputChange} 
                required 
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Отображаемое имя</Form.Label>
              <Form.Control 
                type="text" 
                name="display_name" 
                value={userForm.display_name} 
                onChange={handleInputChange} 
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Новый пароль</Form.Label>
              <Form.Control 
                type="password" 
                name="password" 
                value={userForm.password} 
                onChange={handleInputChange} 
                placeholder="Оставьте пустым, чтобы не менять" 
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Подтверждение нового пароля</Form.Label>
              <Form.Control 
                type="password" 
                name="confirm_password" 
                value={userForm.confirm_password} 
                onChange={handleInputChange} 
                placeholder="Оставьте пустым, чтобы не менять" 
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Роль</Form.Label>
              <Form.Select 
                name="role" 
                value={userForm.role} 
                onChange={handleInputChange}
              >
                <option value="user">Пользователь</option>
                <option value="admin">Администратор</option>
              </Form.Select>
            </Form.Group>
            
            <div className="d-flex justify-content-end">
              <Button variant="secondary" className="me-2" onClick={() => setShowEditModal(false)}>
                Отмена
              </Button>
              <Button variant="primary" type="submit" disabled={adminContextLoading}>
                {adminContextLoading ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
      
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Подтверждение удаления</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Вы уверены, что хотите удалить пользователя <strong>{selectedUser?.username}</strong>?
          </p>
          <p className="text-danger">
            Это действие невозможно отменить. Все данные пользователя будут удалены.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Отмена
          </Button>
          <Button variant="danger" onClick={handleDeleteUserConfirm} disabled={adminContextLoading}>
            {adminContextLoading ? 'Удаление...' : 'Удалить пользователя'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AdminPanel;