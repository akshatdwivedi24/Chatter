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
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB (increased from 5MB)
  const MAX_IMAGE_CHUNK_SIZE = 64 * 1024; // 64KB chunks for images
  const MAX_VOICE_CHUNK_SIZE = 8 * 1024; // 8KB chunks for voice messages
  const MAX_RECORDING_DURATION = 300000; // 5 minutes in milliseconds
  const fileInputRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimeoutRef = useRef(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showFriendList, setShowFriendList] = useState(true);
  const profilePictureInputRef = useRef(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

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

  // Load profile picture from localStorage on component mount
  useEffect(() => {
    const savedProfilePicture = localStorage.getItem('userProfilePicture');
    if (savedProfilePicture && user) {
      // Update user object with saved profile picture
      user.profilePicture = savedProfilePicture;
      // Force re-render
      setMessage(m => m);
    }
  }, [user]);

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

  const handleSelectFriend = (friend) => {
    setSelectedFriend(friend);
    setShowFriendList(false);
    
    // Reset messages when switching friends
    setMessages([]);
    
    // Here you would fetch previous messages with this friend
    fetchMessagesWithFriend(friend.id);
  };

  const fetchMessagesWithFriend = async (friendId) => {
    try {
      const token = localStorage.getItem('token');
      // This would be your API endpoint to fetch messages with a specific friend
      // const response = await axios.get(`http://localhost:8081/api/messages/${friendId}`, {
      //   headers: {
      //     'Authorization': `Bearer ${token}`
      //   }
      // });
      // setMessages(response.data);
      
      // For now we'll just use existing messages or empty array
      console.log(`Fetching messages with friend: ${friendId}`);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages. Please try again.');
    }
  };

  const goBackToFriendList = () => {
    setShowFriendList(true);
    setSelectedFriend(null);
  };

  const sendMessage = () => {
    if (!selectedFriend) {
      setError('Please select a friend to chat with');
      return;
    }
    
    if (message.trim()) {
      const messageData = {
        content: message,
        sender: user.sub || user.email,
        recipient: selectedFriend.id,
        timestamp: new Date().toISOString(),
        type: 'TEXT'
      };

      // Add message to local state immediately for display
      setMessages(prev => [...prev, messageData]);
      
      // Then try to send via websocket
      try {
        if (stompClient?.connected) {
          sendMessageToServer(messageData, stompClient);
        } else {
          console.log('No connection, queueing message');
          messageQueueRef.current.push(messageData);
          setError('Message queued. Waiting for connection...');
          handleReconnect();
        }
      } catch (error) {
        console.error('Error sending message:', error);
        messageQueueRef.current.push(messageData);
      }
      
      setMessage('');
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

  const renderMessage = (msg, index) => {
    const isSentByMe = msg.sender === (user.sub || user.email);
    const messageClass = `message ${isSentByMe ? 'sent' : 'received'}`;
    const isTemporary = msg.status === 'sending';
    
    return (
      <div key={index} className={messageClass}>
        <div className={`message-content ${isTemporary ? 'sending' : ''}`}>
          {!isSentByMe && (
            <div className="message-sender">{msg.sender}</div>
          )}
          
          {msg.type === 'IMAGE' ? (
            <div className="image-message">
              <img 
                src={`data:${msg.contentType};base64,${msg.content}`}
                alt="Shared image"
                style={{ maxWidth: '300px', maxHeight: '300px', objectFit: 'contain' }}
                onError={(e) => {
                  console.error('Error loading image:', e);
                  e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24"><text x="50%" y="50%" font-size="12" text-anchor="middle" dy=".3em">Image Error</text></svg>';
                }}
              />
            </div>
          ) : msg.type === 'VOICE' ? (
            <div className="voice-message">
              <audio 
                controls
                src={`data:${msg.contentType};base64,${msg.content}`}
                style={{ maxWidth: '200px' }}
              />
            </div>
          ) : (
            <div className="text-message">{msg.content}</div>
          )}
          
          <div className="message-time">
            {formatTime(msg.timestamp)}
            {isTemporary && ' (sending...)'}
          </div>
        </div>
      </div>
    );
  };

  const handleProfilePictureClick = () => {
    setShowProfileModal(true);
  };

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE) {
      setError(`Image too large. Maximum size is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target.result;
        
        // Update local state first for immediate feedback
        const updatedUser = { ...user, profilePicture: base64Image };
        // If you have a setUser function, use it here
        // setUser(updatedUser);
        
        // Save to localStorage for persistence between sessions
        localStorage.setItem('userProfilePicture', base64Image);
        
        // If you have an API endpoint to save the profile picture
        try {
          const token = localStorage.getItem('token');
          /*
          await axios.post('http://localhost:8081/api/user/profile-picture', {
            profilePicture: base64Image
          }, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          */
          console.log('Profile picture updated successfully');
        } catch (error) {
          console.error('Failed to save profile picture to server:', error);
          // Still keep the local change even if server update fails
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing profile picture:', error);
      setError('Failed to process profile picture. Please try again.');
    }
  };

  const removeProfilePicture = () => {
    // Remove from local state
    user.profilePicture = null;
    
    // Remove from localStorage
    localStorage.removeItem('userProfilePicture');
    
    // Force a re-render
    setMessage(m => m);
    
    // Optional: Close the modal after removing
    // setShowProfileModal(false);
  };

  const ProfilePictureModal = () => {
    if (!showProfileModal) return null;
    
    return (
      <div className="profile-modal-overlay" onClick={() => setShowProfileModal(false)}>
        <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="profile-modal-header">
            <h3>Profile Picture</h3>
            <button className="close-button" onClick={() => setShowProfileModal(false)}>
              <i className="fa fa-times"></i>
            </button>
          </div>
          <div className="profile-modal-body">
            <div className="profile-image-container">
              {user.profilePicture ? (
                <img src={user.profilePicture} alt="Profile" className="profile-modal-image" />
              ) : (
                <div className="profile-placeholder">
                  {user.name ? user.name.substring(0, 1).toUpperCase() : (user.email ? user.email.substring(0, 1).toUpperCase() : "U")}
                </div>
              )}
            </div>
            <div className="profile-modal-buttons">
              <button className="change-picture-button" onClick={() => profilePictureInputRef.current?.click()}>
                <i className="fa fa-camera"></i> Change Picture
              </button>
              {user.profilePicture && (
                <button className="remove-picture-button" onClick={removeProfilePicture}>
                  <i className="fa fa-trash"></i> Remove Picture
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`chat-container ${darkMode ? 'dark-mode' : ''}`}>
      <ProfilePictureModal />
      
      <div className="chat-header">
        {!showFriendList && selectedFriend && (
          <button className="back-button" onClick={goBackToFriendList}>
            <i className="fa fa-arrow-left"></i>
          </button>
        )}
        
        {!showFriendList && selectedFriend ? (
          <div className="selected-friend-info">
            <div className="friend-avatar">
              {selectedFriend.name.substring(0, 1).toUpperCase()}
            </div>
            <div className="friend-name-status">
              <h3>{selectedFriend.name}</h3>
              <span className="friend-email">{selectedFriend.email}</span>
              <span className="status">Online</span>
            </div>
          </div>
        ) : (
          <div className="user-profile-info">
            <div className="user-avatar" onClick={handleProfilePictureClick}>
              {user.profilePicture ? (
                <img src={user.profilePicture} alt="Profile" className="profile-picture" />
              ) : (
                user.name ? user.name.substring(0, 1).toUpperCase() : (user.email ? user.email.substring(0, 1).toUpperCase() : "U")
              )}
              <div className="avatar-overlay">
                <i className="fa fa-camera"></i>
              </div>
            </div>
            <div className="user-details">
              <h3>{user.name || "User"}</h3>
              <span className="user-email">{user.sub || user.email}</span>
            </div>
          </div>
        )}
        
        <div className="header-right">
          <div className="theme-selector">
            <select 
              value={currentTheme} 
              onChange={(e) => setCurrentTheme(e.target.value)}
              className="theme-dropdown"
            >
              {Object.entries(THEMES).map(([key, theme]) => (
                <option key={key} value={key}>{theme.name}</option>
              ))}
            </select>
          </div>
          
          <div className="theme-switch">
            <input 
              type="checkbox" 
              id="darkmode-toggle" 
              checked={darkMode}
              onChange={() => setDarkMode(!darkMode)}
            />
            <label htmlFor="darkmode-toggle">
              <span className="sr-only">Toggle dark mode</span>
            </label>
            <span className="mode-label">{darkMode ? 'Dark' : 'Light'}</span>
          </div>
          
          <button className="logout-button" onClick={onLogout}>
            <i className="fa fa-sign-out"></i>
          </button>
        </div>
      </div>
      
      {showFriendList ? (
        <FriendList user={user} onSelectFriend={handleSelectFriend} />
      ) : (
        <>
          <div className="messages-container">
            {error && <div className="error-message">{error}</div>}
            {isConnecting && !connected && (
              <div className="connecting-message">
                <div className="spinner"></div>
                <p>Connecting to chat server...</p>
              </div>
            )}
            {messages.length === 0 ? (
              <div className="empty-messages">
                <p>No messages yet. Start a conversation!</p>
              </div>
            ) : (
              <div className="messages-list">
                {messages.map((msg, index) => renderMessage(msg, index))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          <div className="message-input-container">
            <div className="message-box">
              <input 
                type="text" 
                className="message-input" 
                placeholder="Type a message..." 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={!connected || isConnecting}
              />
  
              <input 
                type="file" 
                accept="image/*" 
                style={{display: 'none'}} 
                ref={fileInputRef}
                onChange={handleImageUpload} 
              />
              
              <button 
                className="image-upload-btn" 
                onClick={() => fileInputRef.current.click()}
                disabled={!connected || isConnecting}
              >
                <i className="fa fa-camera"></i>
              </button>
              
              <button 
                className={`voice-record-btn ${isRecording ? 'recording' : ''}`}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={isRecording ? stopRecording : undefined}
                disabled={!connected || isConnecting}
              >
                <i className="fa fa-microphone"></i>
              </button>
  
              <button 
                className="send-button" 
                onClick={sendMessage}
                disabled={!message.trim() || !connected || isConnecting}
              >
                <i className="fa fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </>
      )}
      <input 
        type="file" 
        accept="image/*" 
        style={{display: 'none'}} 
        ref={profilePictureInputRef}
        onChange={handleProfilePictureChange} 
      />
    </div>
  );
};

export default ChatPage; 