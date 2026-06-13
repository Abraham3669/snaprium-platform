// src/pages/Signup.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification,
  signOut,
  signInWithPopup   // Added for Google
} from 'firebase/auth';
import { auth, analytics, logEvent, googleProvider } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // ==================== EMAIL STATES (Currently Disabled) ====================
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  // =========================================================================

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return <div className="auth-container"><p>Loading...</p></div>;
  }

  // ==================== GOOGLE SIGN UP (Currently Active) ====================
  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      logEvent(analytics, 'sign_up', { method: 'google' });
      // Navigation handled by useEffect
    } catch (err) {
      console.error('Google sign-up error:', err.code, err.message);
      setError('Failed to sign up with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  // =========================================================================

  // ==================== EMAIL SIGNUP (Commented Out - Will be used later) ====================
  const handleSignup = async (e) => {
    e.preventDefault();
    if (!email || !password || !name) {
      setError('Please fill all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      await updateProfile(userCredential.user, { displayName: name.trim() });

      const actionCodeSettings = {
        url: window.location.origin + '/login',
        handleCodeInApp: true,
      };

      await sendEmailVerification(userCredential.user, actionCodeSettings);
      
      logEvent(analytics, 'sign_up', { method: 'email' });

      await signOut(auth);

      setVerificationSent(true);
    } catch (err) {
      console.error('Signup error:', err.code, err.message);
      const msg = {
        'auth/email-already-in-use': 'Email already in use',
        'auth/invalid-email': 'Invalid email address',
        'auth/weak-password': 'Password is too weak (minimum 6 characters)',
      }[err.code] || 'Failed to create account. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Reliable Resend Function
  const resendVerification = async () => {
    if (!email || !password) return;
    
    setResendLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
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
  // =======================================================================================

  // Success Screen - Commented Out
  /*
  if (verificationSent) {
    return (
      <div className="auth-container" style={{ textAlign: 'center', maxWidth: '420px' }}>
        <h1>Check Your Email</h1>
        <p style={{ fontSize: '1.1rem', margin: '20px 0' }}>
          We've sent a verification link to <strong>{email}</strong>
        </p>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          Please check your <strong>inbox</strong> and <strong>spam/junk folder</strong>.<br />
          Click the big button/link in the email to verify your account.
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
          Already verified? <Link to="/login">Sign in</Link>
        </p>
      </div>
    );
  }
  */

  // Signup Form
  return (
    <div className="auth-container">
      <h1>Create Account</h1>
      <p>Join Snaprium</p>

      {/* Google Signup Button - Active */}
      <button
        onClick={handleGoogleSignUp}
        disabled={loading}
        className="btn-google"
        style={{ width: '100%', marginBottom: '24px' }}
      >
        {loading ? (
          'Connecting to Google...'
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.239 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.277 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.277 4 24 4c-7.682 0-14.318 4.337-17.694 10.691z" />
              <path fill="#4CAF50" d="M24 44c5.177 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.143 35.091 26.715 36 24 36c-5.218 0-9.621-3.317-11.283-7.946l-6.522 5.025C9.532 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.793 2.239-2.231 4.166-4.084 5.57l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            <span>Sign up with Google</span>
          </>
        )}
      </button>

      {/* ==================== EMAIL SIGNUP FORM (Commented Out) ==================== */}
      {/* 
      <form onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="input-field"
        />

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input-field"
        />

        <div className="password-container" style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input-field"
            style={{ paddingRight: '50px' }}
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
              color: '#666',
              fontSize: '14px',
              padding: '4px 8px'
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
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      {error && <p className="error-message">{error}</p>}
      */}
      {/* ========================================================================== */}

      <p className="auth-link">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}