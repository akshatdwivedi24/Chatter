import React, { useState, useEffect, useRef, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import '../styles/chat.css';
import 'font-awesome/css/font-awesome.min.css';
import FriendList from './FriendList';

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
    textColor: '#000000'
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
    textColor: '#000000'
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
    textColor: '#000000'
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
    textColor: '#000000'
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
    textColor: '#000000'
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
  const isReconnecting = useRef(false);
  const messageQueueRef = useRef([]);
  const processedMessages = useRef(new Set());
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_IMAGE_CHUNK_SIZE = 64 * 1024; // 64KB chunks for images
  const MAX_VOICE_CHUNK_SIZE = 8 * 1024; // 8KB chunks for voice messages
  const MAX_RECORDING_DURATION = 300000; // 5 minutes in milliseconds
  const fileInputRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimeoutRef = useRef(null);
  const [selectedFriend, setSelectedFriend] = useState(null);

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
    let activeConnection = false;
    let cleanupFunction = null;

    const connect = async () => {
      if (activeConnection) return;
      activeConnection = true;

      try {
        // Cleanup any existing connection
        if (stompClient) {
          await stompClient.deactivate();
          setStompClient(null);
        }
        
        setIsConnecting(true);
        console.log('Attempting to connect to WebSocket...');
        
        const socket = new SockJS('http://localhost:8081/ws');
        const stomp = new Client({
          webSocketFactory: () => socket,
          debug: (str) => {
            console.log('STOMP: ' + str);
          },
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
          connectionTimeout: 30000
        });

        // Setup connection handlers before activating
        stomp.onConnect = (frame) => {
          console.log('STOMP Connected:', frame);
          setConnected(true);
          setError(null);
          setIsConnecting(false);
          setIsReconnecting(false);
          connectionAttempts.current = 0;

          // Subscribe to messages
          const subscription = stomp.subscribe('/topic/messages', (message) => {
            try {
              const receivedMessage = JSON.parse(message.body);
              console.log('Received message:', receivedMessage);
              
              if (receivedMessage.type === 'IMAGE_CHUNK') {
                handleImageChunk(receivedMessage);
              } else if (receivedMessage.type === 'VOICE_CHUNK') {
                handleVoiceChunk(receivedMessage);
              } else {
                const messageKey = `${receivedMessage.type || 'TEXT'}-${receivedMessage.sender}-${receivedMessage.timestamp}`;
                if (!processedMessages.current.has(messageKey)) {
                  processedMessages.current.add(messageKey);
                  setMessages(prev => [...prev, receivedMessage]);
                }
              }
            } catch (error) {
              console.error('Error parsing message:', error);
            }
          });

          // Process queued messages
          if (messageQueueRef.current.length > 0) {
            console.log('Processing queued messages:', messageQueueRef.current.length);
            processMessageQueue(stomp);
          }

          // Store cleanup function
          cleanupFunction = () => {
            try {
              subscription.unsubscribe();
              stomp.deactivate();
            } catch (error) {
              console.error('Error during cleanup:', error);
            }
          };
        };

        stomp.onStompError = (frame) => {
          console.error('STOMP error:', frame);
          setConnected(false);
          setError('Lost connection to chat server. Attempting to reconnect...');
          activeConnection = false;
          handleReconnect();
        };

        stomp.onWebSocketClose = () => {
          console.log('WebSocket connection closed');
          setConnected(false);
          setStompClient(null);
          activeConnection = false;
          
          if (!isReconnecting.current && connectionAttempts.current < maxRetries) {
            setError('Connection lost. Reconnecting...');
            handleReconnect();
          }
        };

        // Activate the connection
        await stomp.activate();
        setStompClient(stomp);
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        setError('Failed to connect to chat server. Retrying...');
        activeConnection = false;
        handleReconnect();
      }
    };

    connect();

    // Cleanup function
    return () => {
      if (cleanupFunction) {
        cleanupFunction();
      }
      activeConnection = false;
    };
  }, []); // Run only once on component mount

  const processMessageQueue = async (client) => {
    const queue = [...messageQueueRef.current];
    messageQueueRef.current = [];
    
    for (const msg of queue) {
      try {
        if (msg.type === 'IMAGE' || msg.type === 'IMAGE_CHUNK') {
          await sendImageMessage(msg.content, msg.contentType);
        } else {
          await sendMessageToServer(msg, client);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Error processing queued message:', error);
        messageQueueRef.current.push(msg);
      }
    }
  };

  const sendMessageToServer = async (messageData, client) => {
    if (!client?.connected) {
      console.log('No connection, queueing message');
      messageQueueRef.current.push(messageData);
      return;
    }

    try {
      client.publish({
        destination: "/app/chat",
        body: JSON.stringify(messageData)
      });
    } catch (error) {
      console.error('Error sending message:', error);
      messageQueueRef.current.push(messageData);
      throw error;
    }
  };

  const handleReconnect = useCallback(() => {
    if (isReconnecting.current) {
      console.log('Reconnection already in progress, skipping...');
      return;
    }
    
    isReconnecting.current = true;
    connectionAttempts.current += 1;
    setIsConnecting(true);
    
    if (connectionAttempts.current <= maxRetries) {
      console.log(`Reconnection attempt ${connectionAttempts.current}/${maxRetries}`);
      const delay = Math.min(1000 * Math.pow(2, connectionAttempts.current - 1), 10000);
      
      setTimeout(() => {
        isReconnecting.current = false;
        // Force cleanup of existing client
        if (stompClient) {
          stompClient.deactivate()
            .catch(error => console.error('Error deactivating client:', error))
            .finally(() => {
              setStompClient(null);
              // Trigger a new connection attempt
              const connect = async () => {
                try {
                  const socket = new SockJS('http://localhost:8081/ws');
                  const stomp = new Client({
                    webSocketFactory: () => socket,
                    debug: (str) => {
                      console.log('STOMP: ' + str);
                    },
                    reconnectDelay: 5000,
                    heartbeatIncoming: 4000,
                    heartbeatOutgoing: 4000,
                    connectionTimeout: 30000
                  });
                  await stomp.activate();
                  setStompClient(stomp);
                } catch (error) {
                  console.error('Error during reconnection:', error);
                  handleReconnect();
                }
              };
              connect();
            });
        }
      }, delay);
    } else {
      setIsConnecting(false);
      setError('Unable to connect to chat server. Please check your connection and refresh the page.');
      isReconnecting.current = false;
    }
  }, [stompClient]);

  const sendMessage = () => {
    if (!message.trim()) return;

    const messageData = {
      type: 'TEXT',
      sender: user.name,
      content: message.trim(),
      timestamp: new Date().toISOString()
    };

    // Add message to local state immediately
    setMessages(prev => [...prev, messageData]);
    setMessage('');

    try {
      if (!stompClient?.connected) {
        console.log('No connection, queueing message');
        messageQueueRef.current.push(messageData);
        setError('Message queued. Waiting for connection...');
        handleReconnect();
        return;
      }

      stompClient.publish({
        destination: "/app/chat",
        body: JSON.stringify(messageData)
      });

      setError(null);
    } catch (error) {
      console.error('Error sending message:', error);
      messageQueueRef.current.push(messageData);
      setError('Failed to send message. It will be retried when connection is restored.');
      handleReconnect();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError(`Image size should be less than ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target.result;
        await sendImageMessage(base64Image, file.type);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing image:', error);
      setError('Failed to process image');
    }
  };

  const sendImageMessage = async (base64Image, imageType) => {
    // Add temporary message to show upload progress
    const tempMessage = {
      type: 'IMAGE',
      content: base64Image,
      contentType: imageType,
      sender: user.name,
      timestamp: new Date().toISOString(),
      status: 'sending'
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      if (!stompClient?.connected) {
        messageQueueRef.current.push({
          type: 'IMAGE',
          content: base64Image,
          contentType: imageType,
          sender: user.name,
          timestamp: tempMessage.timestamp
        });
        handleReconnect();
        return;
      }

      // Split image into chunks if needed
      const chunks = [];
      const totalChunks = Math.ceil(base64Image.length / MAX_IMAGE_CHUNK_SIZE);
      const messageId = Date.now().toString(); // Unique ID for this image

      for (let i = 0; i < totalChunks; i++) {
        const start = i * MAX_IMAGE_CHUNK_SIZE;
        const end = Math.min(start + MAX_IMAGE_CHUNK_SIZE, base64Image.length);
        chunks.push(base64Image.slice(start, end));
      }

      // Send chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunkMessage = {
          type: 'IMAGE_CHUNK',
          content: chunks[i],
          contentType: imageType,
          sender: user.name,
          timestamp: tempMessage.timestamp,
          messageId,
          chunkIndex: i,
          totalChunks
        };

        await sendMessageToServer(chunkMessage, stompClient);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between chunks
      }

      setError(null);
    } catch (error) {
      console.error('Error sending image:', error);
      messageQueueRef.current.push({
        type: 'IMAGE',
        content: base64Image,
        contentType: imageType,
        sender: user.name,
        timestamp: new Date().toISOString()
      });
      handleReconnect();
    }
  };

  const handleImageChunk = (chunk) => {
    // Implementation for handling image chunks
    // This would reassemble the image from chunks
    console.log('Received image chunk:', chunk);
  };

  const handleVoiceChunk = (chunk) => {
    // Implementation for handling voice message chunks
    console.log('Received voice chunk:', chunk);
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

  const startRecording = async (e) => {
    e.preventDefault();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        bitsPerSecond: 32000
      });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await sendVoiceMessage(audioBlob);
        }
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);

      recordingTimeoutRef.current = setTimeout(() => {
        if (isRecording) {
          stopRecording();
        }
      }, MAX_RECORDING_DURATION);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please ensure you have granted microphone permissions.');
    }
  };

  const stopRecording = (e) => {
    if (e) e.preventDefault();
    
    if (mediaRecorderRef.current && isRecording) {
      try {
        if (recordingTimeoutRef.current) {
          clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }

        mediaRecorderRef.current.stop();
        setIsRecording(false);
      } catch (error) {
        console.error('Error stopping recording:', error);
        setIsRecording(false);
      }
    }
  };

  const sendVoiceMessage = async (audioBlob) => {
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = reader.result.split(',')[1];
        
        const tempMessage = {
          type: 'VOICE',
          content: base64Audio,
          contentType: 'audio/webm',
          sender: user.name,
          timestamp: new Date().toISOString(),
          status: 'sending'
        };

        setMessages(prev => [...prev, tempMessage]);

        if (!stompClient?.connected) {
          messageQueueRef.current.push(tempMessage);
          handleReconnect();
          return;
        }

        const chunks = [];
        for (let i = 0; i < base64Audio.length; i += MAX_VOICE_CHUNK_SIZE) {
          chunks.push(base64Audio.slice(i, i + MAX_VOICE_CHUNK_SIZE));
        }

        const messageId = Date.now().toString();

        for (let i = 0; i < chunks.length; i++) {
          const chunkMessage = {
            type: 'VOICE_CHUNK',
            content: chunks[i],
            contentType: 'audio/webm',
            sender: user.name,
            timestamp: tempMessage.timestamp,
            messageId,
            chunkIndex: i,
            totalChunks: chunks.length
          };

          await sendMessageToServer(chunkMessage, stompClient);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error sending voice message:', error);
      setError('Failed to send voice message. Please try again.');
    }
  };

  const renderMessage = (message) => {
    const isTemporary = message.status === 'sending';
    const messageClass = `message-content ${isTemporary ? 'sending' : ''}`;

    switch (message.type) {
      case 'IMAGE':
        return (
          <div className={messageClass}>
            {message.sender !== user.name && (
              <div className="message-sender">{message.sender}</div>
            )}
            <div className="image-message">
              <img 
                src={`data:${message.contentType};base64,${message.content}`}
                alt="Shared image"
                style={{ maxWidth: '300px', maxHeight: '300px', objectFit: 'contain' }}
                onError={(e) => {
                  console.error('Error loading image:', e);
                  e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24"><text x="50%" y="50%" font-size="12" text-anchor="middle" dy=".3em">Image Error</text></svg>';
                }}
              />
            </div>
            <div className="message-time">
              {formatTime(message.timestamp)}
              {isTemporary && ' (sending...)'}
            </div>
          </div>
        );
      case 'VOICE':
        return (
          <div className={messageClass}>
            {message.sender !== user.name && (
              <div className="message-sender">{message.sender}</div>
            )}
            <div className="voice-message">
              <audio 
                controls
                src={`data:${message.contentType};base64,${message.content}`}
                style={{ maxWidth: '200px' }}
              />
            </div>
            <div className="message-time">
              {formatTime(message.timestamp)}
              {isTemporary && ' (sending...)'}
            </div>
          </div>
        );
      default:
        return (
          <div className={messageClass}>
            {message.sender !== user.name && (
              <div className="message-sender">{message.sender}</div>
            )}
            <div className="text-message">{message.content}</div>
            <div className="message-time">
              {formatTime(message.timestamp)}
              {isTemporary && ' (sending...)'}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app-container">
      {/* Side panel with friend list */}
      <div className="side-panel">
        <FriendList user={user} />
      </div>
      
      {/* Main chat panel */}
      <div className={`chat-container ${darkMode ? 'dark-mode' : ''} theme-${currentTheme}`}>
        <div className="chat-header">
          <div className="header-left">
            <h2>{selectedFriend || 'Global Chat'}</h2>
          </div>
          
          <div className="header-right">
            <div className="theme-selector">
              <select 
                value={currentTheme}
                onChange={(e) => setCurrentTheme(e.target.value)}
                aria-label="Select chat theme"
              >
                {Object.keys(THEMES).map(theme => (
                  <option key={theme} value={theme}>{THEMES[theme].name}</option>
                ))}
              </select>
            </div>
            
            <div className="theme-switch">
              <label className="switch">
                <input 
                  type="checkbox"
                  checked={darkMode}
                  onChange={() => setDarkMode(!darkMode)}
                  aria-label="Toggle dark mode"
                />
                <span className="slider round"></span>
              </label>
              <span className="mode-label">{darkMode ? 'Dark' : 'Light'}</span>
            </div>
            
            <button onClick={onLogout} className="logout-button">
              Logout
            </button>
          </div>
        </div>
        
        <div className="messages-container">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          {isConnecting && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Connecting to chat server...</p>
            </div>
          )}
          
          {!connected && !isConnecting && (
            <div className="connection-failed">
              <p>Connection failed. Try refreshing the page.</p>
              <button 
                className="refresh-button"
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.sender === user.name ? 'sent' : 'received'}`}
            >
              {renderMessage(msg)}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="message-input">
          <button 
            className="image-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!connected}
            title="Send an image"
          >
            <i className="fa fa-camera"></i>
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleImageUpload}
          />
          
          <button
            className={`voice-button ${isRecording ? 'recording' : ''}`}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            disabled={!connected}
            title={isRecording ? 'Release to send voice message' : 'Hold to record voice message'}
          >
            <i className={`fa ${isRecording ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
          </button>
          
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={!connected}
          />
          
          <button
            className="send-button"
            onClick={sendMessage}
            disabled={!connected || (!message.trim() && !isRecording)}
          >
            <i className="fa fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage; 