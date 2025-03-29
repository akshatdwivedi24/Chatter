import React, { useEffect, useState } from 'react';
import '../styles/auth.css';

const AuthPage = ({ onAuthSuccess }) => {
  const [error, setError] = useState(null);
  const [showAuthorModal, setShowAuthorModal] = useState(false);

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

  // Add Font Awesome script for icons
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
    link.integrity = 'sha512-9usAa10IRO0HhonpyAIVpjrylPvoDwiPUiKdWk5t3PyolY1cOd4DSE0Ga+ri4AuTroPR5aQvXU9xC6qOPnzFeg==';
    link.crossOrigin = 'anonymous';
    link.referrerPolicy = 'no-referrer';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
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

  // Toggle author modal
  const toggleAuthorModal = () => {
    setShowAuthorModal(!showAuthorModal);
  };

  return (
    <div className="auth-container">
      {/* Animated background shapes */}
      <div className="shape shape-1"></div>
      <div className="shape shape-2"></div>
      <div className="shape shape-3"></div>
      
      {/* About the Author button */}
      <button className="author-button" onClick={toggleAuthorModal}>
        <i className="fas fa-user-circle"></i> About the Author
      </button>
      
      {/* Author Modal */}
      {showAuthorModal && (
        <div className="author-modal-overlay" onClick={toggleAuthorModal}>
          <div className="author-modal" onClick={e => e.stopPropagation()}>
            <div className="author-modal-header">
              <h2>About the Author</h2>
              <button className="close-button" onClick={toggleAuthorModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="author-modal-content">
              <p>
                Akshat Dwivedi is a passionate software developer with expertise in Spring Boot, Java, Docker, and Software Testing. 
                He enjoys building robust and scalable applications while continuously exploring new technologies to enhance his skills.
              </p>
              <p>
                Beyond the world of coding, Akshat is a Cricket Enthusiast, Music Aficionado, Movie Buff, and outdoor explorer. 
                He enjoys long walks, finding inspiration in the rhythm of the world around him. With a blend of technical expertise 
                and creativity, he is always eager to innovate and bring ideas to life. ❤️
              </p>
              
              <div className="author-social-links">
                <a href="https://www.instagram.com/aksh.at_24?utm_source=qr&igsh=ZmZzajVlYndkbnkz" target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-instagram"></i>
                </a>
                <a href="https://www.linkedin.com/in/akshat-dwivedi1/" target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-linkedin-in"></i>
                </a>
                <a href="https://github.com/akshatdwivedi24" target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-github"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="auth-content">
        {/* Left column with slogan */}
        <div className="slogan-container">
          <div className="slogan">
            <h1>WELCOME TO CHATTER!!!!</h1>
            <p>Unfiltered Vibes, Untamed Chats – This is Chatter!</p>
          </div>
        </div>
        
        {/* Right column with login */}
        <div className="login-column">
          <div className="auth-card">
            <div className="welcome-text">
              <h2>Continue with Google</h2>
              {error && <div className="error-message">{error}</div>}
            </div>
            
            {/* Google Sign-In button container */}
            <div id="googleButton" className="google-button-container"></div>
            
            {/* Connect with the developer section */}
            <div className="connect-developer">
              <h3>Connect With The Developer</h3>
              <div className="social-links">
                <a href="https://www.instagram.com/aksh.at_24?utm_source=qr&igsh=ZmZzajVlYndkbnkz" target="_blank" rel="noopener noreferrer" title="Instagram">
                  <i className="fab fa-instagram"></i> Instagram
                </a>
                <a href="https://www.linkedin.com/in/akshat-dwivedi1/" target="_blank" rel="noopener noreferrer" title="LinkedIn">
                  <i className="fab fa-linkedin-in"></i> LinkedIn
                </a>
                <a href="https://github.com/akshatdwivedi24" target="_blank" rel="noopener noreferrer" title="GitHub">
                  <i className="fab fa-github"></i> GitHub
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