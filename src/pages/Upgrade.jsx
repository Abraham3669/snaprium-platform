import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePaddle } from '../context/PaddleContext';

export default function Upgrade() {
  const { user } = useAuth();
  const { openCheckout } = usePaddle();

  const [upgrading, setUpgrading] = useState(null);
  const [successPlan, setSuccessPlan] = useState(null); // For nice success UI

  // Watch for plan change after checkout
  useEffect(() => {
    if (successPlan && user?.plan && (user.plan === 'pro' || user.plan === 'premium')) {
      if (user.plan === successPlan) {
        // Plan successfully updated via real-time listener
        setSuccessPlan(null);
      }
    }
  }, [user?.plan, successPlan]);

  const PRO_PRICE_ID = 'pri_01knfpxnmh74xf080p5z07x05j';
  const PREMIUM_PRICE_ID = 'pri_01knfqbp8r1yqn4wrvq2xjh76p';

  const handleUpgrade = (plan) => {
    if (!user?.uid) {
      alert("Please sign in to upgrade.");
      return;
    }

    const priceId = plan === 'pro' ? PRO_PRICE_ID : PREMIUM_PRICE_ID;
    setUpgrading(plan);
    setSuccessPlan(null);

    openCheckout(priceId, user, () => {
      // This callback fires when Paddle checkout UI closes successfully
      setUpgrading(null);
      setSuccessPlan(plan); // Show nice success message while waiting for webhook

      console.log(`[Upgrade] Checkout completed for ${plan}. Waiting for webhook...`);
    });
  };

  // Show success state if plan just upgraded
  const isNowPremium = user?.plan === 'premium' || user?.plan === 'pro';

  return (
    <div className="upgrade-page">
      <div className="upgrade-header">
        <h2>Choose Your Plan</h2>
        <p>Get more high-quality, exam-ready step-by-step solutions every month.</p>
        <p style={{ color: '#e67e22', fontWeight: 'bold' }}>
          🧪 SANDBOX TEST MODE
        </p>
      </div>

      <div className="pricing-grid">
        <div className="pricing-card">
          <h3>Free</h3>
          <div className="plan-price">$0 <span>per month</span></div>
          <button className="plan-cta disabled">
            {isNowPremium ? 'Downgrade not available' : 'Current Plan'}
          </button>
        </div>

        <div className="pricing-card pro">
          <div className="popular-badge">MOST POPULAR</div>
          <h3>Pro</h3>
          <div className="plan-price">$9.99 <span>per month</span></div>
          <button 
            className="plan-cta primary"
            onClick={() => handleUpgrade('pro')}
            disabled={upgrading === 'pro' || (user?.plan === 'pro')}
          >
            {upgrading === 'pro' 
              ? 'Processing...' 
              : user?.plan === 'pro' 
                ? '✅ Active' 
                : 'Get Pro Access'}
          </button>
        </div>

        <div className="pricing-card premium">
          <h3>Premium</h3>
          <div className="plan-price">$14.99 <span>per month</span></div>
          <button 
            className="plan-cta primary"
            onClick={() => handleUpgrade('premium')}
            disabled={upgrading === 'premium' || (user?.plan === 'premium')}
          >
            {upgrading === 'premium' 
              ? 'Processing...' 
              : user?.plan === 'premium' 
                ? '✅ Active' 
                : 'Unlock Premium'}
          </button>
        </div>
      </div>

      {/* Success overlay / message */}
      {successPlan && (
        <div className="success-overlay">
          <div className="success-content">
            <h3>🎉 Payment Successful!</h3>
            <p>Activating your <strong>{successPlan.toUpperCase()}</strong> plan...</p>
            <p>This usually takes a few seconds.</p>
            <div className="spinner" />
            <p style={{ fontSize: '0.9rem', marginTop: '20px' }}>
              Check the console for real-time updates.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}