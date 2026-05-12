// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Prevent rendering form while auth is loading
  if (authLoading) {
    return <div className="auth-container"><p>Loading...</p></div>;
  }

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      // No need to navigate here — AuthContext + useEffect will handle it
    } catch (err) {
      console.error('Google sign-in error:', err.code, err.message);
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Navigation handled by useEffect
    } catch (err) {
      console.error('Email sign-in error:', err.code, err.message);
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const getFriendlyErrorMessage = (code) => {
    const messages = {
      'auth/invalid-email': 'Invalid email format',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/too-many-requests': 'Too many attempts. Try again later.',
      'auth/user-disabled': 'Account has been disabled',
      'auth/popup-closed-by-user': 'Google sign-in was cancelled',
      'auth/cancelled-popup-request': 'Google sign-in was cancelled',
    };
    return messages[code] || 'Sign in failed. Please try again.';
  };

  return (
    <div className="auth-container">
      <h1>Welcome Back</h1>
      <p>Sign in to continue to Snaprium</p>

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="btn-google"
      >
        {loading ? 'Connecting...' : 'Continue with Google'}
      </button>

      <div className="divider">───────── or ─────────</div>

      <form onSubmit={handleEmailSignIn}>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
          className="input-field"
        />

        <div className="password-wrapper">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            className="input-field"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="show-password-btn"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Signing in...' : 'Sign In with Email'}
        </button>
      </form>

      {error && <p className="error-message">{error}</p>}

      <p className="auth-link">
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>

      <p className="auth-link small">
        <Link to="/forgot-password">Forgot password?</Link>
      </p>
    </div>
  );
}