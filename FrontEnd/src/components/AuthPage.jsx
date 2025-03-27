import React, { useEffect, useState } from 'react';
import '../styles/auth.css';

const AuthPage = ({ onAuthSuccess }) => {
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadGoogleScript = () => {
      // Remove any existing Google Sign-In scripts
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }

      // Create new script element
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        if (window.google && window.google.accounts) {
          try {
            window.google.accounts.id.initialize({
              client_id: '740488617018-t28neflc0nm4di0pniiudq0s6t8mic1q.apps.googleusercontent.com',
              callback: handleGoogleSignIn,
              auto_select: false,
              cancel_on_tap_outside: true,
              context: 'signin',
              ux_mode: 'popup',
              use_fedcm_for_prompt: true // Enable the new Identity Services
            });

            // Render the button explicitly
            window.google.accounts.id.renderButton(
              document.getElementById('googleButton'),
              {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: '100%'
              }
            );
          } catch (err) {
            console.error('Error initializing Google Sign-In:', err);
            setError('Failed to initialize Google Sign-In');
          }
        } else {
          setError('Failed to load Google Sign-In');
        }
      };

      script.onerror = () => {
        console.error('Failed to load Google Sign-In script');
        setError('Failed to load Google Sign-In');
      };

      document.head.appendChild(script);
    };

    loadGoogleScript();

    return () => {
      // Cleanup
      const scriptElement = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (scriptElement) {
        document.head.removeChild(scriptElement);
      }
    };
  }, []);

  const handleGoogleSignIn = async (response) => {
    try {
      setError(null);
      console.log('Google Sign-In response:', response);
      
      if (!response.credential) {
        throw new Error('No credential received from Google');
      }

      const apiResponse = await fetch('http://localhost:8081/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: response.credential }),
        credentials: 'include'
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.message || 'Authentication failed');
      }

      const data = await apiResponse.json();
      console.log('Server response:', data);

      // Extract both token and user data from the response
      if (data.token && data.user) {
        console.log('JWT token received:', data.token);
        onAuthSuccess(data); // Pass both token and user data
      } else {
        console.error('Invalid server response:', data);
        throw new Error('Invalid response from server: missing token or user data');
      }
    } catch (err) {
      console.error('Sign-in error:', err);
      setError(err.message || 'Failed to sign in with Google');
    }
  };

  return (
    <div className="auth-container">
      {/* Animated background shapes */}
      <div className="shape shape-1"></div>
      <div className="shape shape-2"></div>
      <div className="shape shape-3"></div>

      <div className="auth-card">
        <div className="welcome-text">
          <h1>Welcome to Chatter</h1>
          <p>Continue with Google to start chatting</p>
          {error && <div className="error-message">{error}</div>}
        </div>

        {/* Google Sign-In button container */}
        <div id="googleButton" className="google-button-container"></div>
      </div>
    </div>
  );
};

export default AuthPage; 