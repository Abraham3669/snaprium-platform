import React, { useState, useEffect } from 'react';
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

  // ✅ Navigate to home if user is already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      // navigate handled by useEffect
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
      // navigate handled by useEffect
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
      'auth/too-many-requests': 'Too many attempts — wait a bit or reset password',
      'auth/user-disabled': 'Account disabled',
      'auth/popup-closed-by-user': 'Google sign-in cancelled',
    };
    return messages[code] || 'Unable to sign in. Please try again.';
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
        {!loading && (
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            width="20"
            height="20"
          />
        )}
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