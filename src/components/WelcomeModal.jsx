// src/components/WelcomeModal.jsx
import React, { useEffect } from 'react';
import Confetti from 'react-confetti';

export default function WelcomeModal({ plan, onClose }) {
  const isPro = plan === 'pro';
  const planName = isPro ? 'Pro' : 'Premium';
  const solutions = isPro ? '80' : '170';

  // Auto-close after 8 seconds (user can close earlier)
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="welcome-modal-overlay" onClick={onClose}>
      <Confetti
        width={window.innerWidth}
        height={window.innerHeight}
        recycle={false}
        numberOfPieces={200}
        gravity={0.15}
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