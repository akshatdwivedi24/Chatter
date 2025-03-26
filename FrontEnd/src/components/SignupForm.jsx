import React, { useState } from 'react';

const SignupForm = ({ onSignup }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('Attempting registration with:', { name, email }); // Don't log password
      
      const response = await fetch('http://localhost:8080/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ name, email, password }),
        credentials: 'include'
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned non-JSON response');
      }

      console.log('Raw server response:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error('Server error response:', {
          status: response.status,
          statusText: response.statusText,
          data
        });
        throw new Error(data.message || data.error || `Registration failed: ${response.statusText}`);
      }

      // Log the exact structure of the response
      console.log('Response structure:', {
        hasToken: !!data.token,
        hasAccessToken: !!data.accessToken,
        hasJwt: !!data.jwt,
        hasUser: !!data.user,
        hasId: !!data.id,
        hasUserId: !!data.userId,
        hasName: !!data.name,
        hasUsername: !!data.username,
        hasEmail: !!data.email
      });

      // Create user object from response with more flexible structure
      const userResponse = {
        token: data.token || data.accessToken || data.jwt || data.Token || data.AccessToken || data.JWT,
        user: {
          id: data.id || data.userId || (data.user && data.user.id) || data.Id || data.UserId,
          name: data.name || data.username || (data.user && data.user.name) || data.Name || data.Username,
          email: data.email || (data.user && data.user.email) || data.Email
        }
      };

      console.log('Processed response:', JSON.stringify(userResponse, null, 2));

      // Validate the processed response
      if (!userResponse.token) {
        console.error('Missing token in processed response. Full response:', data);
        throw new Error('Authentication token not received from server');
      }

      if (!userResponse.user.id || !userResponse.user.name || !userResponse.user.email) {
        console.error('Missing user data in processed response. Full response:', data);
        throw new Error('User data incomplete in server response');
      }

      onSignup(userResponse);
    } catch (err) {
      console.error('Registration error details:', err);
      setError(err.message || 'Failed to register. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-form">
      <h2>Sign Up</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name:</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            minLength={6}
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Signing up...' : 'Sign Up'}
        </button>
      </form>
    </div>
  );
};

export default SignupForm; 