// src/pages/Upgrade.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePaddle } from '../context/PaddleContext';

export default function Upgrade() {
  const { user } = useAuth();
  const { openCheckout } = usePaddle();

  const [upgrading, setUpgrading] = useState(false);

  // ←←← Replace with your actual $5.99 Paddle Price ID
  const UNLIMITED_PRICE_ID = 'pri_xxxxxxxxxxxx';

  const handleUpgrade = () => {
    if (!user?.uid) {
      alert("Please sign in to upgrade.");
      return;
    }

    setUpgrading(true);

    openCheckout(UNLIMITED_PRICE_ID, user, () => {
      setUpgrading(false);
      console.log("[Upgrade] Checkout completed for Unlimited plan");
    });
  };

  const isUnlimited = user?.plan === 'unlimited' || user?.plan === 'premium';

  return (
    <div className="upgrade-page">
      <div className="upgrade-header">
        <h2>Upgrade to Unlimited</h2>
        <p>Solve Math and Physics problems without restrictions</p>
      </div>

      <div className="pricing-grid" style={{ gridTemplateColumns: "1fr", maxWidth: "480px", margin: "0 auto" }}>

        {/* Free Plan */}
        <div className="pricing-card">
          <h3>Free</h3>
          <div className="plan-price">$0 <span>per month</span></div>
          <p className="plan-desc">
  <strong>10 solves per day</strong>
</p>
          <p className="plan-detail">
            Great for occasional help and trying out the app
          </p>
          <button className="plan-cta disabled">Current Plan</button>
        </div>

        {/* Unlimited Plan */}
        <div className="pricing-card premium" style={{ borderColor: '#2563eb', transform: 'scale(1.04)' }}>
          <div className="popular-badge">RECOMMENDED</div>
          
          <h3>Unlimited</h3>
          <div className="plan-price">
            $5.99 <span>per month</span>
          </div>

          <p className="plan-desc">
  Solve as many problems as you need
</p>

          <ul className="plan-features">
            <li>
              <CheckIcon />
              Solve anytime, anywhere — no daily limits
            </li>
            <li>
              <CheckIcon />
              Perfect for heavy study sessions and exam preparation
            </li>
            <li>
              <CheckIcon />
              Full step-by-step explanations for Math & Physics
            </li>
            <li>
              <CheckIcon />
              Continue learning without interruptions
            </li>
          </ul>

          <button 
            className="plan-cta primary"
            onClick={handleUpgrade}
            disabled={upgrading || isUnlimited}
          >
            {upgrading 
              ? 'Processing...' 
              : isUnlimited 
                ? '✅ Unlimited Active' 
                : 'Upgrade to Unlimited — $5.99/month'}
          </button>

          <p className="billed-text">Cancel anytime • Monthly subscription</p>
        </div>
      </div>

      <div className="upgrade-footer">
        <p>Most students upgrade when preparing for tests or during busy weeks</p>
      </div>
    </div>
  );
}

// Simple SVG Check Icon (Professional & clean)
const CheckIcon = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="#10b981" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    style={{ marginRight: '10px', flexShrink: 0 }}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);