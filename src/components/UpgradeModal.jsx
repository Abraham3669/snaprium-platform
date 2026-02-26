// src/components/UpgradeModal.jsx
import React from 'react';
import { X } from 'lucide-react'; // or use your close icon

export default function UpgradeModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="upgrade-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="upgrade-close" onClick={onClose}>
          <X size={28} />
        </button>

        {/* Heading & subheadline */}
        <div className="upgrade-header">
          <h2 className="upgrade-title">Unlock More Expert-Level Solutions</h2>
          <p className="upgrade-subtitle">
            Get more high-quality, exam-ready step-by-step solutions every month.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="pricing-grid">
          {/* Free */}
          <div className="pricing-card free">
            <h3 className="plan-name">Free</h3>
            <p className="plan-desc">15 Solutions Every Month</p>
            <p className="plan-detail">
              Perfect for light study and quick homework help.
            </p>
            <button className="plan-cta disabled">Current Plan</button>
          </div>

          {/* Pro – highlighted */}
          <div className="pricing-card pro">
            <div className="popular-badge">MOST POPULAR</div>
            <h3 className="plan-name">Pro</h3>
            <p className="plan-desc">75 Expert-Level Solutions Every Month</p>
            <p className="plan-detail">
              Built for serious students who solve consistently and prepare with confidence.
            </p>
            <button className="plan-cta primary">Upgrade to Pro</button>
          </div>

          {/* Premium */}
          <div className="pricing-card premium">
            <h3 className="plan-name">Premium</h3>
            <p className="plan-desc">150 Advanced Solutions Every Month</p>
            <p className="plan-detail">
              Maximum solving power for exam season and heavy coursework.
            </p>
            <button className="plan-cta">Upgrade to Premium</button>
          </div>
        </div>
      </div>
    </div>
  );
}