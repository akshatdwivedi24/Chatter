import React, { useEffect, useState } from 'react';
import '../styles/auth.css';

const AuthPage = ({ onAuthSuccess }) => {
  const [error, setError] = useState(null);
  const [showAboutAuthor, setShowAboutAuthor] = useState(false);

  useEffect(() => {
    // Add Font Awesome
    const fontAwesomeScript = document.createElement('link');
    fontAwesomeScript.rel = 'stylesheet';
    fontAwesomeScript.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(fontAwesomeScript);

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
      
      const fontAwesomeLink = document.querySelector('link[href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"]');
      if (fontAwesomeLink) {
        document.head.removeChild(fontAwesomeLink);
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

  const toggleAboutAuthor = () => {
    setShowAboutAuthor(!showAboutAuthor);
  };

  return (
    <div className="auth-container">
      {/* Animated background shapes */}
      <div className="shape shape-1"></div>
      <div className="shape shape-2"></div>
      <div className="shape shape-3"></div>

      {/* About the author section */}
      <div className="about-author-section">
        <button className="about-button" onClick={toggleAboutAuthor}>
          About the author
        </button>
        
        {showAboutAuthor && (
          <div className="about-author-modal">
            <div className="about-author-content">
              <button className="close-button" onClick={toggleAboutAuthor}>×</button>
              <h2>About the Author</h2>
              <p>
                Akshat Dwivedi is a passionate software developer with expertise in Spring Boot, React, and distributed systems. 
                With a strong foundation in backend development, real-time data processing, and system architecture, 
                Akshat enjoys building scalable and efficient applications.
              </p>
              <p>
                He has worked on multiple projects, including real-time chat applications, distributed file systems, 
                and data ingestion pipelines using Kafka. His focus is on designing robust, high-performance systems 
                while ensuring security and seamless user experience.
              </p>
              <p>
                Beyond coding, Akshat enjoys sports, watching movies, walking, and listening to music. 
                He believes in continuous learning and staying updated with the latest technological trends.
              </p>
              <div className="author-social-links">
                <a href="https://www.instagram.com/aksh.at_24?utm_source=qr&igsh=ZmZzajVlYndkbnkz" target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href="https://github.com/akshatdwivedi24" target="_blank" rel="noopener noreferrer">GitHub</a>
                <a href="https://www.linkedin.com/in/akshat-dwivedi1/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="auth-split-container">
        {/* Left side - Welcome and slogan */}
        <div className="auth-welcome-side">
          <div className="welcome-content">
            <h1>Welcome to Chatter</h1>
            <div className="slogan">
              <p>"Unfiltered Vibes, Untamed Chats – This is Chatter!" 💬⚡🎭</p>
            </div>
            <div className="welcome-design">
              <div className="chat-bubble bubble-1">Hey there!</div>
              <div className="chat-bubble bubble-2">Welcome to Chatter!</div>
              <div className="chat-bubble bubble-3">Join the conversation...</div>
            </div>
          </div>
        </div>

        {/* Right side - Login form */}
        <div className="auth-login-side">
          <div className="auth-card">
            <div className="login-text">
              <h2>Sign in</h2>
              <p>Continue with Google to start chatting</p>
              {error && <div className="error-message">{error}</div>}
            </div>

            {/* Google Sign-In button container */}
            <div id="googleButton" className="google-button-container"></div>
            
            {/* Social links */}
            <div className="auth-social-links">
              <p>Connect with the developer:</p>
              <div className="social-icons">
                <a href="https://www.instagram.com/aksh.at_24?utm_source=qr&igsh=ZmZzajVlYndkbnkz" target="_blank" rel="noopener noreferrer" className="social-icon instagram">
                  <i className="fab fa-instagram"></i>
                </a>
                <a href="https://github.com/akshatdwivedi24" target="_blank" rel="noopener noreferrer" className="social-icon github">
                  <i className="fab fa-github"></i>
                </a>
                <a href="https://www.linkedin.com/in/akshat-dwivedi1/" target="_blank" rel="noopener noreferrer" className="social-icon linkedin">
                  <i className="fab fa-linkedin"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage; 