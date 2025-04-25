import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  Avatar,
  Tooltip,
  CircularProgress,
  Divider,
  Menu,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CallIcon from '@mui/icons-material/Call';
import VideocamIcon from '@mui/icons-material/Videocam';
import PersonIcon from '@mui/icons-material/Person';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import MessageItem from './MessageItem';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { toast } from 'react-toastify';

// Популярные эмодзи
const popularEmojis = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '❣️', '💕', '💞',
  '👍', '👎', '👌', '✌️', '🤞', '🤘', '🤙', '👈', '👉', '👆'
];

// Стилизованный компонент для области сообщений
const MessageArea = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  overflowY: 'auto',
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column-reverse', // Чтобы прокрутка начиналась снизу
  backgroundColor: theme.palette.background.default,
}));

const ChatWindow = ({ chat, onNewMessage }) => {
  const { currentUser } = useAuth();
  const { activeConversation, messages, sendMessage, initiateCall } = useChat();
  const { isConnected, sendTypingStatus, markMessageAsRead } = useWebSocket();
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messageAreaRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Состояние для эмодзи и вложений
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [fileUploadOpen, setFileUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Флаги для управления меню
  const emojiMenuOpen = Boolean(emojiAnchorEl);

  // Получаем сообщения для активного разговора
  const conversationMessages = messages[activeConversation?.id] || [];

  // Прокручиваем к последнему сообщению при загрузке или получении новых сообщений
  useEffect(() => {
    if (messageAreaRef.current) {
      messageAreaRef.current.scrollTop = 0;
    }
  }, [conversationMessages.length]);

  // Обработчик отправки сообщения
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    
    if (!newMessage.trim() || !activeConversation) return;
    
    setSending(true);
    try {
      await sendMessage(activeConversation.id, newMessage.trim());
      setNewMessage('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
    } finally {
      setSending(false);
    }
  };

  // Обработчик инициирования аудио звонка
  const handleAudioCall = () => {
    initiateCall(activeConversation.id, false);
  };

  // Обработчик инициирования видео звонка
  const handleVideoCall = () => {
    initiateCall(activeConversation.id, true);
  };
  
  // Обработчики для меню эмодзи
  const handleEmojiMenuOpen = (event) => {
    setEmojiAnchorEl(event.currentTarget);
  };
  
  const handleEmojiMenuClose = () => {
    setEmojiAnchorEl(null);
  };
  
  const handleEmojiClick = (emoji) => {
    setNewMessage(prevMessage => prevMessage + emoji);
    handleEmojiMenuClose();
    inputRef.current?.focus();
  };
  
  // Обработчики для загрузки файлов
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    if (files && files.length > 0) {
      setSelectedFile(files[0]); // Показываем первый файл для превью
      setFileUploadOpen(true);
    }
  };
  
  const handleFileUploadClose = () => {
    setFileUploadOpen(false);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleFileUpload = async () => {
    if (selectedFile && activeConversation) {
      setSending(true);
      try {
        // Получаем все файлы из input
        const files = Array.from(fileInputRef.current.files);
        
        // Отправляем сообщение с файлами
        await sendMessage(
          activeConversation.id, 
          newMessage, // Можно отправить комментарий вместе с файлами
          files
        );
        
        // Очищаем поле ввода и закрываем диалог
        setNewMessage('');
        handleFileUploadClose();
      } catch (error) {
        console.error('Ошибка загрузки файла:', error);
      } finally {
        setSending(false);
      }
    }
  };

  // Отметка сообщений как прочитанных
  useEffect(() => {
    if (!chat || !messages.length || !isConnected) return;
    
    // Находим непрочитанные сообщения, которые не от текущего пользователя
    const unreadMessages = messages.filter(
      msg => !msg.read && msg.senderId !== currentUser.id
    );
    
    // Отмечаем каждое непрочитанное сообщение как прочитанное
    unreadMessages.forEach(msg => {
      markMessageAsRead(msg.id, chat.id);
    });
    
  }, [chat, messages, isConnected, currentUser, markMessageAsRead]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Шапка чата */}
      <Paper 
        elevation={1} 
        sx={{ 
          p: 2, 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: 0
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
            <PersonIcon />
          </Avatar>
          <Typography variant="h6">
            {activeConversation?.name || 'Чат'}
          </Typography>
        </Box>
        
        <Box>
          <Tooltip title="Аудио звонок">
            <IconButton onClick={handleAudioCall} color="primary">
              <CallIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Видео звонок">
            <IconButton onClick={handleVideoCall} color="primary">
              <VideocamIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
      
      <Divider />
      
      {/* Область сообщений */}
      <MessageArea ref={messageAreaRef}>
        {conversationMessages.length > 0 ? (
          // Показываем сообщения в обратном порядке, чтобы последние были внизу
          [...conversationMessages].reverse().map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              isOutgoing={message.sender_id === currentUser?.id}
            />
          ))
        ) : (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
              color: 'text.secondary'
            }}
          >
            <Typography variant="body1">
              Начните общение прямо сейчас
            </Typography>
          </Box>
        )}
      </MessageArea>
      
      {/* Форма отправки сообщения */}
      <Paper 
        component="form"
        onSubmit={handleSendMessage}
        sx={{ 
          p: '2px 4px', 
          display: 'flex', 
          alignItems: 'center',
          borderRadius: 0,
          borderTop: '1px solid rgba(0, 0, 0, 0.12)'
        }}
      >
        <Tooltip title="Выбрать эмодзи">
          <IconButton 
            sx={{ p: '10px' }} 
            aria-label="эмодзи"
            onClick={handleEmojiMenuOpen}
          >
            <EmojiEmotionsIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Прикрепить файл">
          <IconButton 
            sx={{ p: '10px' }} 
            aria-label="прикрепить файл"
            onClick={handleFileButtonClick}
          >
            <AttachFileIcon />
          </IconButton>
        </Tooltip>
        
        {/* Скрытый input для загрузки файлов */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="Написать сообщение..."
          variant="standard"
          InputProps={{ disableUnderline: true }}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={sending}
          inputRef={inputRef}
          sx={{ ml: 1, flex: 1 }}
        />
        
        <IconButton 
          color="primary" 
          sx={{ p: '10px' }} 
          aria-label="отправить"
          onClick={handleSendMessage}
          disabled={!newMessage.trim() || sending}
          type="submit"
        >
          {sending ? <CircularProgress size={24} /> : <SendIcon />}
        </IconButton>
        
        {/* Меню эмодзи */}
        <Menu
          id="emoji-menu"
          anchorEl={emojiAnchorEl}
          open={emojiMenuOpen}
          onClose={handleEmojiMenuClose}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <Grid container spacing={1} sx={{ p: 1, width: 300 }}>
            {popularEmojis.map((emoji, index) => (
              <Grid item key={index}>
                <Button 
                  variant="text" 
                  onClick={() => handleEmojiClick(emoji)}
                  sx={{ minWidth: 'auto', fontSize: '1.5rem' }}
                >
                  {emoji}
                </Button>
              </Grid>
            ))}
          </Grid>
        </Menu>
        
        {/* Диалог загрузки файла */}
        <Dialog open={fileUploadOpen} onClose={handleFileUploadClose}>
          <DialogTitle>Отправка файла</DialogTitle>
          <DialogContent>
            <Box sx={{ my: 2 }}>
              {selectedFile && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1">
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(selectedFile.size / 1024).toFixed(2)} КБ
                  </Typography>
                  
                  {selectedFile.type.startsWith('image/') && (
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <img 
                        src={URL.createObjectURL(selectedFile)} 
                        alt={selectedFile.name}
                        style={{ maxWidth: '100%', maxHeight: '200px' }}
                      />
                    </Box>
                  )}
                </Box>
              )}
              
              <TextField
                fullWidth
                multiline
                maxRows={4}
                placeholder="Добавить комментарий к файлу (необязательно)"
                variant="outlined"
                margin="normal"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleFileUploadClose}>Отмена</Button>
            <Button 
              onClick={handleFileUpload} 
              color="primary"
              disabled={sending}
            >
              {sending ? 'Отправка...' : 'Отправить'}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
};

export default ChatWindow;
