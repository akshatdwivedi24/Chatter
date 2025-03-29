import React, { useState, useEffect, useRef, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import '../styles/chat.css';
import 'font-awesome/css/font-awesome.min.css';
import FriendList from './FriendList';
import axios from 'axios';

const THEMES = {
  whatsapp: {
    name: 'WhatsApp',
    primary: '#075E54',
    secondary: '#DCF8C6',
    accent: '#25D366',
    background: '#E5DDD5',
    messageBox: '#ffffff',
    sentMessage: '#DCF8C6',
    receivedMessage: '#ffffff',
    textColor: '#2C3E50',
    darkMode: {
      background: '#0D1418',
      messageBox: '#1F2C34',
      textColor: '#E5E5E5',
      sentMessage: '#005C4B',
      receivedMessage: '#1F2C34'
    }
  },
  telegram: {
    name: 'Telegram',
    primary: '#5682A3',
    secondary: '#EFFDDE',
    accent: '#31A1DD',
    background: '#ffffff',
    messageBox: '#ffffff',
    sentMessage: '#EFFDDE',
    receivedMessage: '#ffffff',
    textColor: '#2C3E50',
    darkMode: {
      background: '#17212B',
      messageBox: '#1F2936',
      textColor: '#ffffff',
      sentMessage: '#2B5278',
      receivedMessage: '#1F2936'
    }
  },
  instagram: {
    name: 'Instagram',
    primary: '#405DE6',
    secondary: '#3797F0',
    accent: '#C13584',
    background: '#FAFAFA',
    messageBox: '#ffffff',
    sentMessage: '#3797F0',
    receivedMessage: '#ffffff',
    textColor: '#262626',
    darkMode: {
      background: '#121212',
      messageBox: '#262626',
      textColor: '#ffffff',
      sentMessage: '#3797F0',
      receivedMessage: '#262626'
    }
  },
  discord: {
    name: 'Discord',
    primary: '#7289DA',
    secondary: '#99AAB5',
    accent: '#43B581',
    background: '#36393F',
    messageBox: '#40444B',
    sentMessage: '#7289DA',
    receivedMessage: '#40444B',
    textColor: '#FFFFFF',
    darkMode: {
      background: '#202225',
      messageBox: '#2F3136',
      textColor: '#FFFFFF',
      sentMessage: '#7289DA',
      receivedMessage: '#2F3136'
    }
  },
  messenger: {
    name: 'Messenger',
    primary: '#0084FF',
    secondary: '#E4E6EB',
    accent: '#00C6FF',
    background: '#FFFFFF',
    messageBox: '#F1F0F0',
    sentMessage: '#0084FF',
    receivedMessage: '#F1F0F0',
    textColor: '#050505',
    darkMode: {
      background: '#242526',
      messageBox: '#3A3B3C',
      textColor: '#E4E6EB',
      sentMessage: '#0084FF',
      receivedMessage: '#3A3B3C'
    }
  }
};

const ChatPage = ({ user, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [stompClient, setStompClient] = useState(null);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const messagesEndRef = useRef(null);
  const connectionAttempts = useRef(0);
  const maxRetries = 5;
  const messageQueueRef = useRef([]);
  const processedMessages = useRef(new Set());
  const initialConnectionRef = useRef(false);
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  const MAX_IMAGE_CHUNK_SIZE = 64 * 1024;
  const MAX_VOICE_CHUNK_SIZE = 8 * 1024;
  const MAX_RECORDING_DURATION = 300000;
  const fileInputRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimeoutRef = useRef(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showFriendList, setShowFriendList] = useState(true);
  const profilePictureInputRef = useRef(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const messageStatuses = useRef(new Map());
  const [currentTheme, setCurrentTheme] = useState('discord');
  const stompClientRef = useRef(null);

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
    const themeColors = darkMode && theme.darkMode 
      ? {
          '--primary-color': theme.primary,
          '--secondary-color': theme.secondary,
          '--accent-color': theme.accent,
          '--background-color': theme.darkMode.background,
          '--message-box-color': theme.darkMode.messageBox,
          '--text-color': theme.darkMode.textColor,
          '--sent-message-bg': theme.darkMode.sentMessage,
          '--received-message-bg': theme.darkMode.receivedMessage,
          '--header-bg': theme.primary,
          '--border-color': 'rgba(255, 255, 255, 0.1)'
        }
      : {
          '--primary-color': theme.primary,
          '--secondary-color': theme.secondary,
          '--accent-color': theme.accent,
          '--background-color': theme.background,
          '--message-box-color': theme.messageBox,
          '--text-color': theme.textColor,
          '--sent-message-bg': theme.sentMessage,
          '--received-message-bg': theme.receivedMessage,
          '--header-bg': theme.primary,
          '--border-color': 'rgba(0, 0, 0, 0.1)'
        };

    // Apply all theme variables to CSS
    Object.entries(themeColors).forEach(([variable, value]) => {
      document.documentElement.style.setProperty(variable, value);
    });
  }, [currentTheme, darkMode]);

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

  // Initialize WebSocket connection
  useEffect(() => {
    let activeConnection = false;
    let cleanupFunction = null;
    let connectionTimeout = null;

    const initializeConnection = async () => {
      if (!user || initialConnectionRef.current) return;

      try {
        setIsConnecting(true);
        setError(null);

        // Get the token from localStorage
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        // Cleanup any existing connection
        if (stompClientRef.current) {
          await stompClientRef.current.deactivate();
          stompClientRef.current = null;
        }

        // Create WebSocket connection with token
        const socket = new SockJS('http://localhost:8081/ws');
        const stomp = new Client({
          webSocketFactory: () => socket,
          debug: (str) => {
            console.log('STOMP: ' + str);
          },
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
          connectionTimeout: 30000,
          connectHeaders: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Setup connection handlers before activating
        stomp.onConnect = (frame) => {
          console.log('STOMP Connected:', frame);
          setConnected(true);
          setError(null);
          setIsConnecting(false);
          connectionAttempts.current = 0;
          initialConnectionRef.current = true;
          stompClientRef.current = stomp;
          setStompClient(stomp);

          // Clear any existing connection timeout
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }

          // Process queued messages
          if (messageQueueRef.current.length > 0) {
            console.log('Processing queued messages:', messageQueueRef.current.length);
            processMessageQueue(stomp);
          }

          // Store cleanup function
          cleanupFunction = () => {
            try {
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
          stompClientRef.current = null;
          activeConnection = false;
          
          if (connectionAttempts.current < maxRetries) {
            setError('Connection lost. Reconnecting...');
            handleReconnect();
          }
        };

        // Set a connection timeout
        connectionTimeout = setTimeout(() => {
          if (!stomp.connected) {
            console.error('Connection timeout');
            setError('Connection timeout. Please check your internet connection.');
            stomp.deactivate();
          }
        }, 30000);

        // Activate the connection
        await stomp.activate();
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        setError('Failed to connect to chat server. Retrying...');
        activeConnection = false;
        handleReconnect();
      }
    };

    // Initialize connection when component mounts or user changes
    initializeConnection();

    // Cleanup function
    return () => {
      if (cleanupFunction) {
        cleanupFunction();
      }
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
      activeConnection = false;
    };
  }, [user]); // Run when user changes

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
    if (connectionAttempts.current >= maxRetries) {
      setIsConnecting(false);
      setError('Unable to connect to chat server. Please check your connection and refresh the page.');
      return;
    }

    connectionAttempts.current += 1;
    setIsConnecting(true);
    
    console.log(`Reconnection attempt ${connectionAttempts.current}/${maxRetries}`);
    const delay = Math.min(1000 * Math.pow(2, connectionAttempts.current - 1), 10000);
    
    setTimeout(() => {
      // Force cleanup of existing client
      if (stompClientRef.current) {
        stompClientRef.current.deactivate()
          .catch(error => console.error('Error deactivating client:', error))
          .finally(() => {
            stompClientRef.current = null;
            setStompClient(null);
            // Trigger a new connection attempt
            const connect = async () => {
              try {
                const token = localStorage.getItem('token');
                if (!token) {
                  throw new Error('No authentication token found');
                }

                const socket = new SockJS('http://localhost:8081/ws');
                const stomp = new Client({
                  webSocketFactory: () => socket,
                  debug: (str) => {
                    console.log('STOMP: ' + str);
                  },
                  reconnectDelay: 5000,
                  heartbeatIncoming: 4000,
                  heartbeatOutgoing: 4000,
                  connectionTimeout: 30000,
                  connectHeaders: {
                    'Authorization': `Bearer ${token}`
                  }
                });
                await stomp.activate();
                stompClientRef.current = stomp;
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
  }, []);

  const handleSelectFriend = (friend) => {
    if (!friend) return;

    setSelectedFriend(friend);
    setShowFriendList(false);
    setMessages([]);
    setError(null);

    // Connect to the chat and subscribe to the appropriate topic
    if (connected && stompClient) {
      // First unsubscribe from any existing subscription
      try {
        // Unsubscribe from all existing chat subscriptions
        Object.keys(stompClient.subscriptions).forEach(subId => {
          stompClient.unsubscribe(subId);
        });
      } catch (err) {
        console.warn('Error unsubscribing from previous topics', err);
      }

      // Subscribe to new topics
      if (friend.isGroup) {
        // For groups, subscribe to the group topic
        const groupTopic = `/topic/group/${friend.id}`;
        stompClient.subscribe(groupTopic, (message) => {
          try {
            const receivedMessage = JSON.parse(message.body);
            console.log('Received group message:', receivedMessage);
            
            // Skip if this is our own message
            if (receivedMessage.sender === user.username) {
              return;
            }

            // Add the message to the messages state
            setMessages(prev => [...prev, receivedMessage]);
          } catch (error) {
            console.error('Error parsing group message:', error);
          }
        });
        
        // Load previous group messages
        fetchPreviousMessages(friend.id, true);
      } else {
        // For direct messages, subscribe to the specific chat topic
        const chatTopic = `/topic/chat/${user.sub}_${friend.id}`;
        
        const messageHandler = (message) => {
          try {
            const receivedMessage = JSON.parse(message.body);
            console.log('Received direct message:', receivedMessage);
            
            // Skip if this is our own message
            if (receivedMessage.sender === user.username) {
              return;
            }

            // Add the message to the messages state
            setMessages(prev => [...prev, receivedMessage]);
          } catch (error) {
            console.error('Error parsing direct message:', error);
          }
        };

        // Subscribe to the chat topic
        stompClient.subscribe(chatTopic, messageHandler);
        
        // Load previous direct messages
        fetchPreviousMessages(friend.id, false);
      }
    }
  };

  const fetchPreviousMessages = async (chatId, isGroup) => {
    try {
      const token = localStorage.getItem('token');
      let endpoint;
      
      if (isGroup) {
        endpoint = `http://localhost:8081/api/messages/group/${chatId}`;
      } else {
        endpoint = `http://localhost:8081/api/messages/direct?userId=${user.sub}&friendId=${chatId}`;
      }
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).catch(() => {
        // For now, return empty array if endpoint doesn't exist yet
        return { data: [] };
      });
      
      setMessages(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching previous messages:', err);
      setError('Failed to load previous messages. Please try again.');
    }
  };

  const goBackToFriendList = () => {
    setShowFriendList(true);
    setSelectedFriend(null);
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedFriend) return;

    const messageData = {
      sender: user.username,
      recipient: selectedFriend.username,
      content: message,
      timestamp: new Date().toISOString(),
      messageStatus: 'SENT',
      type: 'TEXT',
      id: Date.now().toString(),
      groupId: selectedFriend.isGroup ? selectedFriend.id : undefined
    };

    try {
      if (stompClient && connected) {
        // Add message to local state immediately
        setMessages(prev => [...prev, messageData]);

        // Send message to server
        const destination = selectedFriend.isGroup 
          ? `/app/group/chat` 
          : `/app/chat/${user.sub}_${selectedFriend.id}`;

        stompClient.publish({
          destination: destination,
          body: JSON.stringify(messageData)
        });

        // Update message status to delivered after sending
        setTimeout(() => {
          updateMessageStatus(messageData.id, 'DELIVERED');
        }, 1000);

        setMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
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
    if (!msg || !user) return null;
    
    const isOwnMessage = msg.sender === user.username;
    const messageStatus = messageStatuses.current.get(msg.id) || msg.messageStatus;
    
    return (
      <div key={index} className={`message ${isOwnMessage ? 'sent' : 'received'}`}>
        <div className="message-content">
          <div className="text-message">{msg.content}</div>
          <div className="message-time">
            {formatTime(msg.timestamp)}
            {isOwnMessage && (
              <span className="message-status">
                {messageStatus === 'SENT' && '  ✓'}
                {messageStatus === 'DELIVERED' && '  ✓✓'}
                {messageStatus === 'SEEN' && '  ✓✓'}
              </span>
            )}
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

  useEffect(() => {
    if (stompClient && connected) {
      // Subscribe to typing indicators
      const typingSubscription = stompClient.subscribe('/topic/typing', (message) => {
        const data = JSON.parse(message.body);
        if (data.recipient === user.username) {
          setIsTyping(true);
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
          }, 3000);
        }
      });

      // Subscribe to message status updates
      const statusSubscription = stompClient.subscribe('/topic/message-status', (message) => {
        const data = JSON.parse(message.body);
        if (data.recipient === user.username) {
          messageStatuses.current.set(data.id, data.messageStatus);
          setMessages(prev => prev.map(msg => 
            msg.id === data.id ? { ...msg, messageStatus: data.messageStatus } : msg
          ));
        }
      });

      return () => {
        typingSubscription.unsubscribe();
        statusSubscription.unsubscribe();
      };
    }
  }, [stompClient, connected, user.username]);

  const handleTyping = () => {
    if (!stompClient || !connected || !selectedFriend || !user) return;

    const typingMessage = {
      sender: user.username,
      recipient: selectedFriend.username,
      isTyping: true,
      timestamp: new Date().toISOString()
    };

    stompClient.publish({
      destination: '/app/typing',
      body: JSON.stringify(typingMessage)
    });
  };

  const updateMessageStatus = (messageId, status) => {
    if (!stompClient || !connected || !selectedFriend || !user) return;

    const statusMessage = {
      id: messageId,
      sender: user.username,
      recipient: selectedFriend.username,
      messageStatus: status,
      timestamp: new Date().toISOString()
    };

    stompClient.publish({
      destination: '/app/message-status',
      body: JSON.stringify(statusMessage)
    });
  };

  return (
    <div className={`chat-container ${darkMode ? 'dark-mode' : ''} ${currentTheme}-theme`}>
      <ProfilePictureModal />
      
      <div className="chat-header">
        <div className="header-left">
          {!showFriendList && (
            <button className="back-button" onClick={() => setShowFriendList(true)}>
              <i className="fa fa-arrow-left"></i>
            </button>
          )}
          {showFriendList ? (
            <div className="user-profile-info">
              <div className="user-avatar" onClick={handleProfilePictureClick}>
                {user.profilePicture ? (
                  <img src={user.profilePicture} alt={user.name || user.email} className="profile-picture" />
                ) : (
                  <div className="avatar-placeholder">
                    {(user.name ? user.name.charAt(0) : user.email.charAt(0)).toUpperCase()}
                  </div>
                )}
                <div className="avatar-overlay">
                  <i className="fa fa-camera"></i>
                </div>
              </div>
              <div className="user-details">
                <h3>{user.name || 'User'}</h3>
                <span className="user-email">{user.email}</span>
              </div>
            </div>
          ) : (
            selectedFriend && (
              <div className="selected-friend-info">
                <div className="friend-avatar">
                  {selectedFriend.profilePicture ? (
                    <img 
                      src={selectedFriend.profilePicture} 
                      alt={selectedFriend.name || selectedFriend.email || selectedFriend.username} 
                      className="profile-picture"
                    />
                  ) : (
                    <div className="avatar-placeholder">
                      {(selectedFriend.name || selectedFriend.email || selectedFriend.username || 'F').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="friend-name-status">
                  <h3>{selectedFriend.name || selectedFriend.email || selectedFriend.username || 'Unknown User'}</h3>
                  {selectedFriend.email && <span className="friend-email">{selectedFriend.email}</span>}
                  <span className="status">Online</span>
                </div>
              </div>
            )
          )}
        </div>
        <div className="header-right">
          <div className="theme-switch-wrapper">
            <label className="theme-switch">
              <input
                type="checkbox"
                id="darkmode-toggle"
                checked={darkMode}
                onChange={() => setDarkMode(!darkMode)}
              />
              <label htmlFor="darkmode-toggle"></label>
            </label>
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
                onChange={(e) => {
                  setMessage(e.target.value);
                  handleTyping();
                }}
                onKeyDown={handleKeyPress}
                disabled={!connected || isConnecting || !selectedFriend}
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
                disabled={!connected || isConnecting || !selectedFriend}
              >
                <i className="fa fa-camera"></i>
              </button>
              
              <button
                className={`voice-record-btn ${isRecording ? 'recording' : ''}`}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={isRecording ? stopRecording : undefined}
                disabled={!connected || isConnecting || !selectedFriend}
              >
                <i className="fa fa-microphone"></i>
              </button>
              
              <button 
                className="send-button" 
                onClick={sendMessage}
                disabled={!message.trim() || !connected || isConnecting || !selectedFriend}
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