// src/pages/ForgotPassword.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage('Password reset email sent! Check your inbox (including spam).');
      setTimeout(() => navigate('/login'), 5000); // auto-redirect after 5s
    } catch (err) {
      console.error('Reset error:', err.code, err.message);
      const msg = {
        'auth/invalid-email': 'Invalid email format',
        'auth/user-not-found': 'No account found with this email',
        'auth/too-many-requests': 'Too many attempts — wait a bit',
      }[err.code] || 'Failed to send reset email';
      setError(msg);
    } finally {
      setLoading(false);
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
      }}
    >
      <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Reset Password</h1>
      <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
        Enter your email and we'll send you a reset link
      </p>

      <form onSubmit={handleReset}>
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
          }}
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      {message && (
        <p style={{ color: 'green', textAlign: 'center', margin: '1rem 0', fontSize: '14px' }}>
          {message}
        </p>
      )}
      {error && (
        <p style={{ color: 'red', textAlign: 'center', margin: '1rem 0', fontSize: '14px' }}>
          {error}
        </p>
      )}

      <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '14px' }}>
        Back to <Link to="/login" style={{ color: '#007bff' }}>Sign In</Link>
      </p>
    </div>
  );
}