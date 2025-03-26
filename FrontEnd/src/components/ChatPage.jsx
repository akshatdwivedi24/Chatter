import React, { useState, useEffect, useRef, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import '../styles/chat.css';
import 'font-awesome/css/font-awesome.min.css';

const CHUNK_SIZE = 8 * 1024; // 8KB chunks
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB max image size
const CHUNK_DELAY = 200; // 200ms delay between chunks

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
  const processedMessages = useRef(new Set());
  const messageQueueRef = useRef([]);
  const isReconnecting = useRef(false);
  const [imageChunks, setImageChunks] = useState({});
  const fileInputRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState([]);
  const mediaRecorderRef = useRef(null);

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
        
        const socket = new SockJS('http://localhost:8080/ws');
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
                  const socket = new SockJS('http://localhost:8080/ws');
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

  const sendImageMessage = async (base64Image, imageType) => {
    try {
      // Compress image before sending
      const compressedImage = await compressImage(base64Image, imageType);
      console.log('Original image size:', base64Image.length, 'Compressed size:', compressedImage.length);

      // Create and display temporary message immediately
      const tempMessage = {
        type: 'IMAGE',
        content: compressedImage,
        contentType: imageType,
        sender: user.name,
        timestamp: new Date().toISOString(),
        status: 'sending'
      };
      setMessages(prev => [...prev, tempMessage]);

      if (!stompClient?.connected) {
        console.log('Not connected, queueing image message');
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

      const chunks = [];
      const chunkSize = CHUNK_SIZE;
      
      for (let i = 0; i < compressedImage.length; i += chunkSize) {
        const chunk = compressedImage.slice(i, i + chunkSize);
        chunks.push(chunk);
      }

      const messageId = Date.now().toString();
      console.log(`Splitting image into ${chunks.length} chunks`);
      let successfulChunks = 0;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          for (let i = successfulChunks; i < chunks.length; i++) {
            if (!stompClient?.connected) {
              throw new Error('Connection lost during chunk sending');
            }

            const messageObj = {
              type: 'IMAGE_CHUNK',
              content: chunks[i],
              contentType: imageType,
              sender: user.name,
              timestamp: tempMessage.timestamp,
              messageId,
              chunkIndex: i,
              totalChunks: chunks.length
            };

            await new Promise((resolve, reject) => {
              try {
                stompClient.publish({
                  destination: '/app/chat',
                  body: JSON.stringify(messageObj)
                });
                successfulChunks++;
                console.log(`Chunk ${i + 1}/${chunks.length} sent successfully`);
                setTimeout(resolve, CHUNK_DELAY);
              } catch (error) {
                reject(error);
              }
            });
          }
          
          // Update the temporary message status
          setMessages(prev => prev.map(msg => 
            msg.timestamp === tempMessage.timestamp ? { ...msg, status: 'sent' } : msg
          ));
          
          console.log('Image sent successfully');
          return;
        } catch (error) {
          console.error(`Attempt ${attempt + 1} failed:`, error);
          if (attempt < 2) {
            console.log('Waiting before retry...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            if (!stompClient?.connected) {
              await waitForConnection();
            }
          }
        }
      }
      throw new Error('Failed to send image after multiple attempts');
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

  const waitForConnection = () => {
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (stompClient?.connected) {
          resolve();
        } else {
          setTimeout(checkConnection, 1000);
        }
      };
      checkConnection();
    });
  };

  const compressImage = async (base64Image, imageType) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        const maxDimension = 1024; // Max dimension of 1024px
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL(imageType, 0.7); // 70% quality
        resolve(compressedBase64.split(',')[1]);
      };
      img.onerror = reject;
      img.src = `data:${imageType};base64,${base64Image}`;
    });
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

  const handleImageChunk = (message) => {
    const { messageId, chunkIndex, totalChunks, content, contentType, sender, timestamp } = message;
    
    console.log(`Received chunk ${chunkIndex + 1}/${totalChunks} for message ${messageId}`);
    
    setImageChunks(prev => {
      const chunks = { ...(prev[messageId] || {}) };
      chunks[chunkIndex] = content;
      
      // Check if we have all chunks
      if (Object.keys(chunks).length === totalChunks) {
        console.log('All chunks received, reconstructing image');
        
        // Combine all chunks in order
        const completeImage = Array.from({ length: totalChunks })
          .map((_, i) => chunks[i])
          .join('');

        // Create complete message
        const completeMessage = {
          type: 'IMAGE',
          content: completeImage,
          contentType: contentType,
          sender: sender,
          timestamp: timestamp
        };

        // Add to messages
        const messageKey = `IMAGE-${sender}-${timestamp}`;
        if (!processedMessages.current.has(messageKey)) {
          processedMessages.current.add(messageKey);
          setMessages(prev => [...prev, completeMessage]);
          console.log('Image message added to chat');
        }

        // Remove chunks from state
        const newState = { ...prev };
        delete newState[messageId];
        return newState;
      }

      return { ...prev, [messageId]: chunks };
    });
  };

  const handleImageSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('Selected file:', file.name, 'Size:', file.size, 'Type:', file.type);

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
      reader.onload = async (e) => {
        const base64Image = e.target.result.split(',')[1];
        await sendImageMessage(base64Image, file.type);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing image:', error);
      setError('Failed to process image. Please try again.');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      setAudioChunks([]);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks((chunks) => [...chunks, event.data]);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64Audio = e.target.result.split(',')[1];
          const messageData = {
            type: 'VOICE',
            sender: user.name,
            content: base64Audio,
            contentType: 'audio/webm',
            timestamp: new Date().toISOString()
          };
          await sendMessageToServer(messageData, stompClient);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Could not access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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
            <audio controls className="voice-message">
              <source src={`data:${message.contentType};base64,${message.content}`} type={message.contentType} />
              Your browser does not support the audio element.
            </audio>
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
            {renderMessage(message)}
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
        <input
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
          ref={fileInputRef}
        />
        <button 
          className="image-button"
          onClick={() => fileInputRef.current?.click()}
          title="Send image"
        >
          <i className="fa fa-camera"></i>
        </button>
        <button
          className={`voice-button ${isRecording ? 'recording' : ''}`}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={stopRecording}
          title="Hold to record voice message"
        >
          <i className={`fa ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
        </button>
        <button 
          className="send-button" 
          onClick={sendMessage}
          title="Send message"
        >
          <i className="fa fa-paper-plane"></i>
        </button>
      </div>
    </div>
  );
};

export default ChatPage; 