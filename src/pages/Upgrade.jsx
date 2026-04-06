import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePaddle } from '../context/PaddleContext';

export default function Upgrade() {
  const { user } = useAuth();
  const { openCheckout, loading, error } = usePaddle();

  const [upgrading, setUpgrading] = useState(null);

  const PRO_PRICE_ID = 'pri_01knfpxnmh74xf080p5z07x05j';
  const PREMIUM_PRICE_ID = 'pri_01knfqbp8r1yqn4wrvq2xjh76p';

  const handleUpgrade = (plan) => {
    if (!user?.uid) {
      alert("Please sign in to upgrade your plan.");
      return;
    }

    const priceId = plan === 'pro' ? PRO_PRICE_ID : PREMIUM_PRICE_ID;
    setUpgrading(plan);

    openCheckout(priceId, user, (data) => {
      setUpgrading(null);
      
      alert(`🎉 Congratulations! Your ${plan.toUpperCase()} plan has been activated successfully!`);

      // Auto redirect to dashboard after success
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    });
  };

  return (
    <div className="upgrade-page">
      <div className="upgrade-header">
        <h2>Choose Your Plan</h2>
        <p>Get more high-quality, exam-ready step-by-step solutions every month.</p>
        <p style={{ color: '#e67e22', fontWeight: 'bold' }}>
          🧪 Currently in SANDBOX TEST MODE — No real money will be charged
        </p>
      </div>

      <div className="pricing-grid">
        {/* Free */}
        <div className="pricing-card">
          <h3>Free</h3>
          <div className="plan-price">$0 <span>per month</span></div>
          <p className="plan-desc">15 full step-by-step solutions monthly</p>
          <button className="plan-cta disabled">Current Plan</button>
        </div>

        {/* Pro */}
        <div className="pricing-card pro">
          <div className="popular-badge">MOST POPULAR</div>
          <h3>Pro</h3>
          <div className="plan-price">$9.99 <span>per month</span></div>
          <p className="plan-desc">80 full step-by-step solutions monthly</p>
          <button 
            className="plan-cta primary"
            onClick={() => handleUpgrade('pro')}
            disabled={upgrading === 'pro'}
          >
            {upgrading === 'pro' ? 'Processing...' : 'Get Pro Access (Test)'}
          </button>
        </div>

        {/* Premium */}
        <div className="pricing-card premium">
          <h3>Premium</h3>
          <div className="plan-price">$14.99 <span>per month</span></div>
          <p className="plan-desc">170 full step-by-step solutions monthly</p>
          <button 
            className="plan-cta primary"
            onClick={() => handleUpgrade('premium')}
            disabled={upgrading === 'premium'}
          >
            {upgrading === 'premium' ? 'Processing...' : 'Unlock Maximum Access (Test)'}
          </button>
        </div>
      </div>
    </div>
  );
}