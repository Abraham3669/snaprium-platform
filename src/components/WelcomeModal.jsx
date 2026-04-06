// src/components/WelcomeModal.jsx
import React, { useEffect, useState, useCallback } from 'react';
import Confetti from 'react-confetti';

export default function WelcomeModal({ plan, onClose }) {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const isPro = plan === 'pro';
  const planName = isPro ? 'Pro' : 'Premium';
  const solutions = isPro ? '80' : '170';

  // Update dimensions on resize (critical for Vercel + mobile + hydration)
  const handleResize = useCallback(() => {
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    // Also update immediately in case of layout shift
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Auto-close after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="welcome-modal-overlay" onClick={onClose}>
      <Confetti
        width={dimensions.width}
        height={dimensions.height}
        recycle={false}
        numberOfPieces={250}
        gravity={0.12}
        initialVelocityY={-10}
        colors={['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3']}
      />

      <div className="welcome-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="welcome-close-btn" onClick={onClose}>
          ×
        </button>

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