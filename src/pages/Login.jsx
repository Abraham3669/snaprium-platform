// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  signOut, 
  sendEmailVerification 
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // ==================== EMAIL/PASSWORD STATES (Disabled for now) ====================
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  // =================================================================================

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return <div className="auth-container"><p>Loading...</p></div>;
  }

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      // Navigation handled by useEffect
    } catch (err) {
      console.error('Google sign-in error:', err.code, err.message);
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  // ==================== EMAIL LOGIN - Currently Disabled ====================
  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');
    setVerificationRequired(false);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);

      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        setVerificationRequired(true);
        return;
      }

      // Verified user → navigation handled by useEffect
    } catch (err) {
      console.error('Email sign-in error:', err.code, err.message);
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  // Reliable Resend Function
  const resendVerification = async () => {
    if (!email || !password) return;

    setResendLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      
      const actionCodeSettings = {
        url: window.location.origin + '/login',
        handleCodeInApp: true,
      };

      await sendEmailVerification(userCredential.user, actionCodeSettings);
      await signOut(auth);

      alert('✅ Verification email resent! Please check your inbox and spam folder.');
    } catch (err) {
      console.error('Resend error:', err);
      alert('Failed to resend verification email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };
  // ===========================================================================

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

  // Verification Required Screen - Currently Disabled
  // if (verificationRequired) { ... full block commented below }
  /*
  if (verificationRequired) {
    return (
      <div className="auth-container" style={{ textAlign: 'center', maxWidth: '420px' }}>
        <h1>Verify Your Email</h1>
        <p style={{ fontSize: '1.1rem', margin: '20px 0' }}>
          We sent a verification link to <strong>{email}</strong>
        </p>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          Please check your inbox and spam/junk folder.<br />
          Click the link in the email to verify your account.
        </p>

        <button 
          onClick={resendVerification}
          disabled={resendLoading}
          className="btn-primary"
          style={{ marginBottom: '20px', width: '100%' }}
        >
          {resendLoading ? 'Resending...' : 'Resend Verification Email'}
        </button>

        <p className="auth-link">
          <Link to="/login">← Back to Login</Link>
        </p>
      </div>
    );
  }
  */

  // Normal Login Form
  return (
    <div className="auth-container">
      <h1>Welcome Back</h1>
      <p>Sign in to continue to Snaprium</p>

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="btn-google"
      >
        {loading ? 'Connecting...' : (
          <>
            <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.239 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.277 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.277 4 24 4c-7.682 0-14.318 4.337-17.694 10.691z" />
              <path fill="#4CAF50" d="M24 44c5.177 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.143 35.091 26.715 36 24 36c-5.218 0-9.621-3.317-11.283-7.946l-6.522 5.025C9.532 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.793 2.239-2.231 4.166-4.084 5.57l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>

      {/* ==================== EMAIL LOGIN SECTION - Currently Disabled ==================== */}
      {/* 
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

        <div className="password-wrapper" style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            className="input-field"
            style={{ paddingRight: '70px' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="show-password-btn"
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#666',
              fontSize: '14px'
            }}
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
      */}
      {/* ================================================================================ */}

      {error && <p className="error-message">{error}</p>}

      <p className="auth-link">
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>

      {/* 
      <p className="auth-link small">
        <Link to="/forgot-password">Forgot password?</Link>
      </p> 
      */}
    </div>
  );
}