// src/components/UpgradeModal.jsx
import React from 'react';
import { X } from 'lucide-react';

export default function UpgradeModal({ isOpen, onClose }) {
  if (!isOpen) return null;

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
            Upgrade your plan to continue solving more questions.
          </p>
        </div>

        {/* Actions */}
        <div className="upgrade-actions">
          <button 
            className="upgrade-btn secondary"
            onClick={() => window.location.href = '/login'}
          >
            Sign In
          </button>
          <button 
            className="upgrade-btn primary"
            onClick={() => window.location.href = '/upgrade'}
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
}