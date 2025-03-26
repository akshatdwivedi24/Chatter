import React, { useState, useEffect, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import wallpaper1 from '../assets/374250.jpg';
import wallpaper2 from '../assets/matthew-henry-2Ts5HnA67k8-unsplash.jpg';
import wallpaper3 from '../assets/mike-yukhtenko-a2kD4b0KK4s-unsplash.jpg';
import wallpaper4 from '../assets/prometey-sanchez-noskov-c6M7AoevSXE-unsplash.jpg';
import wallpaper5 from '../assets/javen-yang-MWZi4XTIsKA-unsplash.jpg';

const THEMES = {
  whatsapp: {
    name: 'WhatsApp',
    primary: '#128C7E',
    secondary: '#DCF8C6',
    accent: '#25D366',
    background: '#E5DDD5',
    messageBox: '#ffffff',
    sentMessage: '#E7FFDB',
    receivedMessage: '#ffffff',
    textColor: '#000000',
    wallpaper: wallpaper1
  },
  telegram: {
    name: 'Telegram',
    primary: '#0088cc',
    secondary: '#ffffff',
    accent: '#31a1dd',
    background: '#ebedf0',
    messageBox: '#ffffff',
    sentMessage: '#eeffde',
    receivedMessage: '#ffffff',
    textColor: '#000000',
    wallpaper: wallpaper2
  },
  instagram: {
    name: 'Instagram',
    primary: '#E1306C',
    secondary: '#ffffff',
    accent: '#833AB4',
    background: '#FAFAFA',
    messageBox: '#ffffff',
    sentMessage: '#0095F6',
    receivedMessage: '#ffffff',
    textColor: '#000000',
    wallpaper: wallpaper3
  },
  discord: {
    name: 'Discord',
    primary: '#7289DA',
    secondary: '#ffffff',
    accent: '#43B581',
    background: '#F5F5F5',
    messageBox: '#ffffff',
    sentMessage: '#7289DA',
    receivedMessage: '#ffffff',
    textColor: '#000000',
    wallpaper: wallpaper4
  },
  messenger: {
    name: 'Messenger',
    primary: '#0084FF',
    secondary: '#ffffff',
    accent: '#00C6FF',
    background: '#F5F7FB',
    messageBox: '#ffffff',
    sentMessage: '#0084FF',
    receivedMessage: '#F0F0F0',
    textColor: '#000000',
    wallpaper: wallpaper5
  }
};

const ChatPage = ({ user, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [stompClient, setStompClient] = useState(null);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('whatsapp');
  const [isConnecting, setIsConnecting] = useState(true);
  const messagesEndRef = useRef(null);
  const connectionAttempts = useRef(0);
  const maxRetries = 5;
  const processedMessages = useRef(new Set());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Apply dark mode class to body
    document.body.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  useEffect(() => {
    // Apply theme colors to CSS variables
    const theme = THEMES[currentTheme];
    document.documentElement.style.setProperty('--primary-color', theme.primary);
    document.documentElement.style.setProperty('--secondary-color', theme.secondary);
    document.documentElement.style.setProperty('--accent-color', theme.accent);
  }, [currentTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    // Set the wallpaper
    const root = document.documentElement;
    root.style.setProperty('--theme-wallpaper', `url(${THEMES[currentTheme].wallpaper})`);
  }, [currentTheme]);

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        setIsConnecting(true);
        console.log('Attempting to connect to WebSocket...');
        const socket = new SockJS('http://localhost:8080/ws');
        
        const stomp = new Client({
          webSocketFactory: () => socket,
          debug: (str) => {
            console.log('STOMP: ' + str);
          },
          reconnectDelay: 2000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000
        });

        stomp.onConnect = (frame) => {
          console.log('STOMP Connected:', frame);
          setConnected(true);
          setError(null);
          setIsConnecting(false);
          connectionAttempts.current = 0;
          
          stomp.subscribe('/topic/messages', (message) => {
            try {
              const receivedMessage = JSON.parse(message.body);
              console.log('Received message:', receivedMessage);
              
              const messageKey = `${receivedMessage.sender}-${receivedMessage.timestamp}-${receivedMessage.content}`;
              
              if (!processedMessages.current.has(messageKey)) {
                processedMessages.current.add(messageKey);
                setMessages(prev => [...prev, receivedMessage]);
              }
            } catch (error) {
              console.error('Error parsing message:', error);
              setError('Error processing message. Please refresh if this persists.');
            }
          });
        };

        stomp.onStompError = (frame) => {
          console.error('STOMP error:', frame);
          setConnected(false);
          setError('Lost connection to chat server. Attempting to reconnect...');
          handleReconnect();
        };

        stomp.onWebSocketClose = () => {
          console.log('WebSocket connection closed');
          setConnected(false);
          if (connectionAttempts.current < maxRetries) {
            setError('Connection lost. Reconnecting...');
            handleReconnect();
          }
        };

        stomp.onWebSocketError = (event) => {
          console.error('WebSocket error:', event);
          setConnected(false);
          setError('Connection error. Attempting to reconnect...');
          handleReconnect();
        };

        console.log('Activating STOMP client...');
        stomp.activate();
        setStompClient(stomp);

        return () => {
          console.log('Cleaning up WebSocket connection...');
          if (stomp.connected) {
            stomp.deactivate();
          }
        };
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        setError('Failed to connect to chat server. Retrying...');
        handleReconnect();
      }
    };

    const handleReconnect = () => {
      connectionAttempts.current += 1;
      setIsConnecting(true);
      if (connectionAttempts.current <= maxRetries) {
        console.log(`Reconnection attempt ${connectionAttempts.current}/${maxRetries}`);
        const delay = Math.min(1000 * Math.pow(2, connectionAttempts.current - 1), 10000);
        setTimeout(connectWebSocket, delay);
      } else {
        setIsConnecting(false);
        setError('Unable to connect to chat server. Please check your connection and refresh the page.');
      }
    };

    connectWebSocket();
  }, []);

  const sendMessage = () => {
    if (!message.trim()) return;
    
    if (!stompClient || !connected) {
      setError('Not connected to chat server. Please try refreshing the page.');
      return;
    }

    try {
      const messageData = {
        sender: user.name,
        content: message,
        timestamp: new Date().toISOString()
      };
      console.log('Sending message:', messageData);
      stompClient.publish({
        destination: "/app/chat",
        body: JSON.stringify(messageData)
      });
      setMessage('');
      setError(null);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return '';
      }
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }).toLowerCase();
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (error) {
    return (
      <div className="error-container">
        <h2>Chat Connection Status</h2>
        <p>{error}</p>
        {!isConnecting && (
          <button 
            onClick={() => {
              connectionAttempts.current = 0;
              setError(null);
              window.location.reload();
            }}
            className="refresh-button"
          >
            Refresh Page
          </button>
        )}
        {isConnecting && (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Attempting to reconnect...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`chat-container ${darkMode ? 'dark-mode' : ''} theme-${currentTheme}`}>
      <div className="chat-header">
        <h1>Chat Room</h1>
        <div className="user-info">
          <div className="theme-controls">
            <div className="theme-switch-wrapper">
              <label className="theme-switch">
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={(e) => setDarkMode(e.target.checked)}
                />
                <div className="slider round"></div>
              </label>
            </div>
            <select 
              className="theme-select"
              value={currentTheme}
              onChange={(e) => setCurrentTheme(e.target.value)}
            >
              {Object.entries(THEMES).map(([key, theme]) => (
                <option key={key} value={key}>
                  {theme.name}
                </option>
              ))}
            </select>
          </div>
          <span>{user.name}</span>
          <button className="logout-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
      <div className="messages-container">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.sender === user.name ? 'sent' : 'received'}`}
          >
            <div className="message-content">
              {message.sender !== user.name && (
                <div className="message-sender">{message.sender}</div>
              )}
              <div className="message-text">{message.content}</div>
              <div className="message-time">{formatTime(message.timestamp)}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="message-input">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};

export default ChatPage; 