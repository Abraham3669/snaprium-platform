// src/pages/Login.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) {
    navigate('/');
    return null;
  }

  const handleGoogleSignIn = async () => {
    // console.log('Google button clicked'); // keep for debug - remove later
    setLoading(true);
    setError('');
    try {
      // console.log('Calling signInWithPopup...');
      await signInWithPopup(auth, googleProvider);
      // console.log('Google sign-in success');
      navigate('/');
    } catch (err) {
      console.error('Google sign-in error:', err.code, err.message);
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    // console.log('Email form submitted');
    if (!email || !password) {
      setError('Please fill in email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // console.log('Calling signInWithEmailAndPassword...');
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate('/');
    } catch (err) {
      console.error('Email sign-in error:', err.code, err.message);
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const getFriendlyErrorMessage = (code) => {
    const messages = {
      'auth/invalid-email': 'Please enter a valid email address',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/too-many-requests': 'Too many attempts — please wait a moment or reset your password',
      'auth/user-disabled': 'This account has been disabled',
      'auth/popup-closed-by-user': 'Google sign-in was cancelled',
      'auth/operation-not-allowed': 'Google sign-in is not available right now',
      'auth/popup-blocked': 'Popup blocked — please allow popups for this site',
      'auth/network-request-failed': 'Network error — check your internet connection',
    };
    return messages[code] || 'Unable to sign in. Please try again.';
  };

  return (
    <div
      style={{
        padding: '2rem',
        maxWidth: '420px',
        margin: '4rem auto',
        background: 'var(--card-bg, #fff)',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        color: 'var(--text-color, #000)',
      }}
    >
      <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Welcome Back</h1>
      <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
        Sign in to continue to Snaprium
      </p>

      {/* Google Button */}
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          background: '#4285F4',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
        }}
      >
        {loading ? 'Connecting...' : 'Continue with Google'}
        {!loading && (
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            width="20"
            height="20"
          />
        )}
      </button>

      <div style={{ textAlign: 'center', margin: '1.5rem 0', color: '#888', fontSize: '14px' }}>
        ───────── or ─────────
      </div>

      <form onSubmit={handleEmailSignIn}>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: '1rem',
            border: '1px solid #ccc',
            borderRadius: '6px',
            fontSize: '16px',
          }}
        />

        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '6px',
              fontSize: '16px',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#666',
            }}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '1rem',
          }}
        >
          {loading ? 'Signing in...' : 'Sign In with Email'}
        </button>
      </form>

      {error && (
        <p
          style={{
            color: 'red',
            textAlign: 'center',
            margin: '1rem 0',
            fontSize: '14px',
          }}
        >
          {error}
        </p>
      )}

      <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '14px' }}>
        Don't have an account?{' '}
        <Link to="/signup" style={{ color: '#007bff', textDecoration: 'none', fontWeight: '500' }}>
          Sign up
        </Link>
      </p>

      <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '13px', color: '#888' }}>
        <Link to="/forgot-password" style={{ color: '#007bff' }}>
          Forgot password?
        </Link>
      </p>
    </div>
  );
}