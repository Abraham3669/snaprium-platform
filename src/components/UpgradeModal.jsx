// src/components/UpgradeModal.jsx
import React from 'react';
import { X } from 'lucide-react';
import { usePaddle } from '../context/PaddleContext';
import { useAuth } from '../context/AuthContext';

export default function UpgradeModal({ isOpen, onClose }) {
  const { openCheckout } = usePaddle();
  const { user } = useAuth();

  if (!isOpen) return null;

  // ←←← Replace with your actual $5.99 Unlimited Plan Price ID
  const UNLIMITED_PRICE_ID = 'pri_XXXXXXXXXXXXXXXXXXXXXXXX';

  const handleUpgrade = () => {
    if (!user?.uid) {
      alert('Please sign in to upgrade.');
      onClose();
      return;
    }

    openCheckout(UNLIMITED_PRICE_ID, (data) => {
      console.log('✅ Upgrade successful');
      onClose();
      // You can trigger WelcomeModal here if needed via context or props
    });
  };

  return (
    <div className="upgrade-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="upgrade-close" onClick={onClose}>
          <X size={28} />
        </button>

        {/* Content */}
        <div className="upgrade-header">
          <div className="limit-icon">⏰</div>
          <h2 className="upgrade-title">Daily Limit Reached</h2>
          <p className="upgrade-subtitle">
            You've used your <strong>10 free solves</strong> for today.
          </p>
        </div>

        <div className="upgrade-body">
          <p className="upgrade-main-text">
            Upgrade to <strong>Unlimited</strong> and solve as many Math & Physics 
            problems as you want — anytime, anywhere.
          </p>

          <ul className="upgrade-benefits">
            <li>No daily limits</li>
            <li>Full step-by-step explanations</li>
            <li>Perfect for exam preparation and heavy homework</li>
            <li>Faster responses and solution history</li>
          </ul>
        </div>

        {/* Action Button */}
        <div className="upgrade-actions">
          <button 
            className="upgrade-btn primary full-width"
            onClick={handleUpgrade}
          >
            Upgrade to Unlimited — $5.99/month
          </button>
          
          <p className="upgrade-note">
            Cancel anytime • Charged monthly
          </p>
        </div>
      </div>
    </div>
  );
}