import React, { useState, useEffect } from 'react';
import './App.css';
import AuthPage from './components/AuthPage';
import ChatPage from './components/ChatPage';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/auth.css';
import './styles/chat.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      
      if (token && userData && userData !== 'undefined') {
        try {
          const parsedUser = JSON.parse(userData);
          if (parsedUser && typeof parsedUser === 'object') {
            setIsAuthenticated(true);
            setUser(parsedUser);
          } else {
            // Invalid user data format
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        } catch (parseError) {
          console.error('Error parsing user data:', parseError);
          // Clear invalid data
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } else {
        // No valid auth data found
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      setError('Failed to load user data. Please try refreshing the page.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAuthSuccess = (data) => {
    try {
      if (!data || !data.user || typeof data.user !== 'object') {
        throw new Error('Invalid authentication data received');
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setIsAuthenticated(true);
      setUser(data.user);
      setError(null);
    } catch (err) {
      console.error('Error during authentication:', err);
      setError('Authentication failed. Please try again.');
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setIsAuthenticated(false);
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Error during logout:', err);
      setError('Failed to logout. Please try again.');
    }
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Refresh Page
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {!isAuthenticated ? (
        <AuthPage onAuthSuccess={handleAuthSuccess} />
      ) : (
        <ChatPage user={user} onLogout={handleLogout} />
      )}
    </ErrorBoundary>
  );
}

export default App;
