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
      setTimeout(() => navigate('/login'), 5000);
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
    <div className="auth-container">
      <h1>Reset Password</h1>
      <p>Enter your email and we'll send you a reset link</p>

      <form onSubmit={handleReset}>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
          className="input-field"
        />

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}

      <p className="auth-link">
        Back to <Link to="/login">Sign In</Link>
      </p>
    </div>
  );
}