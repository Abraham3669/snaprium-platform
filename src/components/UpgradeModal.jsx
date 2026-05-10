// src/components/UpgradeModal.jsx
import React from 'react';
import { X } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';

export default function UpgradeModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const goToUpgradePage = () => {
    onClose();
    navigate('/upgrade');
  };

  return (
    <div className="upgrade-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="upgrade-close" onClick={onClose}>
          <X size={28} />
        </button>

        <div className="upgrade-header">
          <div className="limit-icon">⏰</div>
          <h2 className="upgrade-title">Daily Limit Reached</h2>
          <p className="upgrade-subtitle">
            You've used your <strong>10 free solves</strong> for today.
          </p>
        </div>

        <div className="upgrade-body">
          <p className="upgrade-main-text">
            Get <strong>Unlimited solves</strong> and upgrade your experience.
          </p>
        </div>

        <div className="upgrade-actions">
          <button
            className="upgrade-btn primary full-width"
            onClick={goToUpgradePage}
          >
            Upgrade to Unlimited
          </button>
        </div>
      </div>
    </div>
  );
}