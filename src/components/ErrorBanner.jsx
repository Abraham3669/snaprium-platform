// src/components/ErrorBanner.jsx
import { useEffect, useState } from 'react';
import { onAppError } from '../utils/errorReporter';

export default function ErrorBanner() {
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    return onAppError((message) => {
      const id = Date.now() + Math.random();
      setErrors((prev) => [...prev, { id, message }]);
      setTimeout(() => {
        setErrors((prev) => prev.filter((e) => e.id !== id));
      }, 8000);
    });
  }, []);

  if (errors.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: 4, padding: 8,
    }}>
      {errors.map((e) => (
        <div key={e.id} style={{
          background: '#d32f2f', color: 'white', padding: '10px 14px',
          borderRadius: 6, fontSize: 13, fontFamily: 'monospace',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)', wordBreak: 'break-word',
        }}>
          {e.message}
        </div>
      ))}
    </div>
  );
}