// src/pages/Signup.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification,
  signOut 
} from 'firebase/auth';
import { auth, analytics, logEvent } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Redirect if already logged in (only verified users should reach here)
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return <div className="auth-container"><p>Loading...</p></div>;
  }

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

      // Professional configuration for verification email
      const actionCodeSettings = {
        url: window.location.origin + '/login', // Redirect back to login after verification
        handleCodeInApp: true,
      };

      await sendEmailVerification(userCredential.user, actionCodeSettings);

      logEvent(analytics, 'sign_up', { method: 'email' });

      // IMPORTANT: Sign out so user is NOT logged in until they verify
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

  const resendVerification = async () => {
    if (!auth.currentUser) return;
    
    setResendLoading(true);
    try {
      const actionCodeSettings = {
        url: window.location.origin + '/login',
        handleCodeInApp: true,
      };
      await sendEmailVerification(auth.currentUser, actionCodeSettings);
      alert('✅ Verification email resent! Please check your inbox and spam folder.');
    } catch (err) {
      console.error(err);
      alert('Failed to resend email. Try again later.');
    } finally {
      setResendLoading(false);
    }
  };

  // Professional Success Screen
  if (verificationSent) {
    return (
      <div className="auth-container" style={{ textAlign: 'center', maxWidth: '420px' }}>
        <h1>Check Your Email</h1>
        <p style={{ fontSize: '1.1rem', margin: '20px 0' }}>
          We've sent a verification link to <strong>{email}</strong>
        </p>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          Please check your inbox (and spam/junk folder).<br />
          Click the link to verify your account, then return here to sign in.
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

  // Signup Form
  return (
    <div className="auth-container">
      <h1>Create Account</h1>
      <p>Join Snaprium</p>

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

      <p className="auth-link">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}