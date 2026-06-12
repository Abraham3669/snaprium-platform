// src/components/WelcomeModal.jsx
import React, { useEffect, useState, useCallback } from 'react';
import Confetti from 'react-confetti';

export default function WelcomeModal({ plan, onClose }) {
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [isClient, setIsClient] = useState(false);

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

        {/* Rocket SVG */}
        <div className="welcome-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" 
              fill="url(#rocketGradient)" 
            />
            <path 
              d="M12 19V22" 
              stroke="#3b82f6" 
              strokeWidth="2" 
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="rocketGradient" x1="4" y1="10" x2="20" y2="10" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3b82f6"/>
                <stop offset="100%" stopColor="#60a5fa"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

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