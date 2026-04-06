// src/components/WelcomeModal.jsx
import React, { useEffect, useState, useCallback } from 'react';
import Confetti from 'react-confetti';

export default function WelcomeModal({ plan, onClose }) {
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [isClient, setIsClient] = useState(false);

  const isPro = plan === 'pro';
  const planName = isPro ? 'Pro' : 'Premium';
  const solutions = isPro ? '80' : '170';

  // Safe client-side dimension setup (prevents hydration error)
  const handleResize = useCallback(() => {
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, []);

  useEffect(() => {
    setIsClient(true);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Auto-close
  useEffect(() => {
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!isClient) return null; // Prevent SSR mismatch

  return (
    <div className="welcome-modal-overlay" onClick={onClose}>
      <Confetti
        width={dimensions.width}
        height={dimensions.height}
        recycle={false}
        numberOfPieces={300}
        gravity={0.1}
        initialVelocityY={-15}
        colors={['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4']}
      />

      <div className="welcome-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="welcome-close-btn" onClick={onClose}>×</button>

        <div className="welcome-icon">🎉</div>
        <h2>Congratulations!</h2>

        <p className="welcome-text">
          You are now a <strong>{planName}</strong> member!
        </p>

        <p className="welcome-detail">
          Enjoy <strong>{solutions}</strong> high-quality, expert step-by-step solutions every month.
        </p>

        <button className="welcome-cta" onClick={onClose}>
          Start Solving Now
        </button>

        <p className="welcome-note">
          Thank you for supporting Snaprium — happy studying!
        </p>
      </div>
    </div>
  );
}