// src/components/WelcomeModal.jsx
import React, { useEffect, useState, useCallback } from 'react';
import Confetti from 'react-confetti';

export default function WelcomeModal({ plan, onClose }) {
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [isClient, setIsClient] = useState(false);

  // New Unlimited Plan Logic
  const isUnlimited = plan === 'unlimited' || plan === 'premium';

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

  // Auto-close after 8 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!isClient) return null;

  return (
    <div className="welcome-modal-overlay" onClick={onClose}>
      <Confetti
        width={dimensions.width}
        height={dimensions.height}
        recycle={false}
        numberOfPieces={280}
        gravity={0.12}
        initialVelocityY={-18}
        colors={['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb', '#1e40af']}
      />

      <div className="welcome-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="welcome-close-btn" onClick={onClose}>×</button>

        <div className="welcome-icon">🚀</div>
        <h2>Congratulations!</h2>

        <p className="welcome-text">
          You are now an <strong>Unlimited</strong> member!
        </p>

        <p className="welcome-detail">
          You can now solve <strong>unlimited Math & Physics</strong> problems 
          with step-by-step explanations — anytime, anywhere.
        </p>

        <div className="welcome-benefits">
          <ul>
            <li>No more daily limits</li>
            <li>Perfect for heavy study sessions and exam prep</li>
            <li>Priority processing speed</li>
            <li>Full solution history</li>
          </ul>
        </div>

        <button className="welcome-cta" onClick={onClose}>
          Start Solving Now
        </button>

        <p className="welcome-note">
          Thank you for supporting Snaprium.<br />
          Happy studying!
        </p>
      </div>
    </div>
  );
}