import React from 'react';
import { X } from 'lucide-react';
import { usePaddle } from '../context/PaddleContext';
import { useAuth } from '../context/AuthContext';

export default function UpgradeModal({ isOpen, onClose }) {
  const { openCheckout } = usePaddle();
  const { user } = useAuth();

  if (!isOpen) return null;

  // Use the same Pro Price ID as in Upgrade page
  const PRO_PRICE_ID = 'pri_XXXXXXXXXXXXXXXXXXXXXXXX';   // ← Replace with your real Pro Price ID

  const handleUpgradeFromModal = () => {
    if (!user?.email || !user?.uid) {
      alert('Please sign in to upgrade.');
      onClose();
      return;
    }

    openCheckout(PRO_PRICE_ID, (data) => {
      alert('🎉 Thank you! Your Pro plan has been activated successfully.');
      onClose();
      // Optional: redirect user after success
      // window.location.href = '/dashboard';
    });
  };

  return (
    <div className="upgrade-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="upgrade-close" onClick={onClose}>
          <X size={28} />
        </button>

        {/* Heading */}
        <div className="upgrade-header">
          <h2 className="upgrade-title">You've reached your limit</h2>
          <p className="upgrade-subtitle">
            Upgrade to Pro and continue solving more questions with 80 solutions per month.
          </p>
        </div>

        {/* Action button */}
        <div className="upgrade-actions">
          <button 
            className="upgrade-btn primary full-width"
            onClick={handleUpgradeFromModal}
          >
            Upgrade to Pro Now
          </button>
        </div>
      </div>
    </div>
  );
}