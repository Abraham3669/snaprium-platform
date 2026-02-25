// src/pages/Signup.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Signup() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!email || !password || !name) {
      setError('Please fill all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // Optional: set display name
      await updateProfile(userCredential.user, { displayName: name.trim() });
      navigate('/');
    } catch (err) {
      console.error('Signup error:', err.code, err.message);
      const msg = {
        'auth/email-already-in-use': 'Email already in use',
        'auth/invalid-email': 'Invalid email',
        'auth/weak-password': 'Password too weak (min 6 characters)',
      }[err.code] || 'Failed to create account';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '420px', margin: '4rem auto', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Create Account</h1>
      <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>Join Snaprium</p>

      <form onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ width: '100%', padding: '12px', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '6px' }}
        />

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: '12px', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '6px' }}
        />

        <input
          type="password"
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: '12px', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '6px' }}
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
          {loading ? 'Creating...' : 'Sign Up'}
        </button>
      </form>

      {error && <p style={{ color: 'red', textAlign: 'center', margin: '1rem 0' }}>{error}</p>}

      <p style={{ textAlign: 'center', marginTop: '2rem' }}>
        Already have an account? <Link to="/login" style={{ color: '#007bff' }}>Sign in</Link>
      </p>
    </div>
  );
}