// src/pages/Login.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // adjust path if needed
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase'; // adjust path

export default function Login() {
  const { user } = useAuth(); // If already logged in → redirect
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // If user is already logged in, redirect to home
  if (user) {
    navigate('/');
    return null;
  }

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged in AuthContext will handle user update & Firestore doc
      navigate('/'); // redirect to home after success
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate('/');
    } catch (err) {
      console.error('Email sign-in error:', err);
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  // Map Firebase error codes to nice messages
  const getFriendlyErrorMessage = (code) => {
    switch (code) {
      case 'auth/invalid-email':
        return 'Invalid email format';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Incorrect email or password';
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again later or reset password';
      case 'auth/user-disabled':
        return 'This account has been disabled';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in was cancelled';
      default:
        return 'Something went wrong. Please try again';
    }
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
          cursor: 'pointer',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
        }}
      >
        {loading ? 'Signing in...' : 'Continue with Google'}
        {!loading && (
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            width="20"
            height="20"
          />
        )}
      </button>

      <div
        style={{
          textAlign: 'center',
          margin: '1.5rem 0',
          color: '#888',
          fontSize: '14px',
        }}
      >
        ───────── or ─────────
      </div>

      {/* Email/Password Form */}
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
            cursor: 'pointer',
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
        <Link
          to="/signup"
          style={{ color: '#007bff', textDecoration: 'none', fontWeight: '500' }}
        >
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