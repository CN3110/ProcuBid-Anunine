import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../Common/Alert';
import Footer from '../Common/Footer';
import '../../styles/auth.css';
import TermsConditions from './TermsConditions';

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({
    userId: '',
    password: ''
  });
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const navigate = useNavigate();

  // Check if user has already accepted terms
  useEffect(() => {
    const hasAcceptedTerms = localStorage.getItem('termsAccepted');
    if (hasAcceptedTerms) {
      setTermsAccepted(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if terms are accepted
    if (!termsAccepted && !localStorage.getItem('termsAccepted')) {
      setAlert({
        show: true,
        message: 'Please accept the Terms and Conditions to proceed',
        type: 'error'
      });
      return;
    }

    // Validate inputs
    if (!credentials.userId || !credentials.password) {
      setAlert({
        show: true,
        message: 'Please enter both User ID and Password',
        type: 'error'
      });
      return;
    }

    setIsLoading(true);
    setAlert({ show: false, message: '', type: '' });

    try {
      // Use environment variable for API URL
      const apiUrl = import.meta.env.VITE_API_URL;
      const loginUrl = `${apiUrl}/auth/login`;

      console.log('Environment:', import.meta.env.MODE);
      console.log('API URL:', loginUrl);

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: credentials.userId,
          password: credentials.password
        }),
      });

      console.log('Response status:', response.status);

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('Non-JSON response:', responseText);
        throw new Error('Server returned non-JSON response. Please check if the backend server is running.');
      }

      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and user data
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Store terms acceptance if just accepted
      if (termsAccepted && !localStorage.getItem('termsAccepted')) {
        localStorage.setItem('termsAccepted', 'true');
      }

      // Call onLogin callback if provided
      if (onLogin) {
        onLogin(data.user);
      }

      // Show success message
      setAlert({
        show: true,
        message: `Welcome ${data.user.name}! Redirecting...`,
        type: 'success'
      });

      // Redirect based on role after a brief delay
      setTimeout(() => {
        if (data.user.role === 'admin' || data.user.role === 'system_admin') {
          navigate('/admindashboard', { replace: true });
        } else if (data.user.role === 'bidder') {
          navigate('/bidderdashboard', { replace: true });
        } else {
          throw new Error(`Unknown user role: ${data.user.role}`);
        }
      }, 1000);

    } catch (error) {
      console.error('Login error:', error);
      setAlert({
        show: true,
        message: error.message || 'Login failed. Please check if the server is running and try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setCredentials(prev => ({
      ...prev,
      [field]: field === 'userId' ? value.toUpperCase() : value
    }));
  };

  const viewTerms = (e) => {
    e.preventDefault();
    setShowTerms(true);
  };

  const closeTerms = () => {
    setShowTerms(false);
  };

  const acceptTerms = () => {
    setTermsAccepted(true);
    closeTerms();
  };

  return (
    <>
      <div className="login-page">
        <div className="login-form">
          <h2>
            ProcuBid<br /> E-Auction System
            <br /> <small>Anunine Holdings Pvt Ltd</small>
          </h2>

          <form onSubmit={handleSubmit} method="post">
            <div className="form-group">
              <label>User ID</label>
              <input 
                type="text" 
                value={credentials.userId}
                onChange={(e) => handleInputChange('userId', e.target.value)}
                placeholder="Enter your User ID" 
                required 
                maxLength={10}
                autoComplete="username"
              />
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                value={credentials.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Enter your password" 
                required
                autoComplete="current-password"
              />
            </div>
            
            {!localStorage.getItem('termsAccepted') && (
              <div className="terms-checkbox">
                <label>
                  <input 
                    type="checkbox" 
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                  I agree to the{' '}
                  <span 
                    className="terms-link" 
                    onClick={viewTerms}
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Terms and Conditions
                  </span>
                </label>
              </div>
            )}
            
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading || (!termsAccepted && !localStorage.getItem('termsAccepted'))}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          {alert.show && (
            <Alert 
              message={alert.message} 
              type={alert.type}
              onClose={() => setAlert({ show: false, message: '', type: '' })}
            />
          )}
        </div>
        <Footer />
      </div>

      {/* Terms and Conditions Modal */}
      {showTerms && (
        <div className="modal-overlay" onClick={closeTerms}>
          <div className="modal-content terms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Terms and Conditions</h3>
              <button 
                className="close-button" 
                onClick={closeTerms}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <TermsConditions />
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={closeTerms}
                type="button"
              >
                Close
              </button>
              <button 
                className="btn btn-primary" 
                onClick={acceptTerms}
                type="button"
              >
                Accept Terms
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Login;