import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePaddle } from '../context/PaddleContext';

export default function Upgrade() {
  const { user } = useAuth();
  const { openCheckout, loading, error } = usePaddle();

  const [upgradingPlan, setUpgradingPlan] = useState(null);

  const PRO_PRICE_ID = 'pri_01knfpxnmh74xf080p5z07x05j';
  const PREMIUM_PRICE_ID = 'pri_01knfqbp8r1yqn4wrvq2xjh76p';

  const handleUpgrade = (plan) => {
    if (!user?.email || !user?.uid) {
      alert('Please sign in to upgrade your plan.');
      return;
    }

    if (error) {
      alert(`Payment system error: ${error}`);
      return;
    }

    if (loading) {
      alert('Payment system is still loading. Please wait.');
      return;
    }

    const priceId = plan === 'pro' ? PRO_PRICE_ID : PREMIUM_PRICE_ID;

    setUpgradingPlan(plan);

    openCheckout(priceId, user, (data) => {
      setUpgradingPlan(null);

      // Success message + confetti spot
      alert(`🎉 Congratulations! Your ${plan.toUpperCase()} plan has been activated successfully!`);

      // ← ADD YOUR CONFETTI HERE IF YOU WANT
      // import confetti from 'canvas-confetti';
      // confetti({ particleCount: 200, spread: 80 });

      // Auto redirect to dashboard after 1.5 seconds
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    });
  };

  const proPrice = '9.99';
  const premiumPrice = '14.99';

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
          <p className="plan-detail">Perfect for light homework help and quick checks.</p>
          <button className="plan-cta disabled">Current Plan</button>
        </div>

        {/* Pro */}
        <div className="pricing-card pro">
          <div className="popular-badge">MOST POPULAR</div>
          <h3>Pro</h3>
          <div className="plan-price">${proPrice} <span>per month</span></div>
          <p className="plan-desc">80 full step-by-step solutions monthly</p>
          <p className="plan-detail">Ideal for consistent practice, assignments, and weekly exam prep.</p>
          <button 
            className="plan-cta primary"
            onClick={() => handleUpgrade('pro')}
            disabled={upgradingPlan === 'pro'}
          >
            {upgradingPlan === 'pro' ? 'Processing...' : 'Get Pro Access (Test)'}
          </button>
        </div>

        {/* Premium */}
        <div className="pricing-card premium">
          <h3>Premium</h3>
          <div className="plan-price">${premiumPrice} <span>per month</span></div>
          <p className="plan-desc">170 full step-by-step solutions monthly</p>
          <p className="plan-detail">Built for intensive revision, past questions, and heavy coursework.</p>
          <button 
            className="plan-cta primary"
            onClick={() => handleUpgrade('premium')}
            disabled={upgradingPlan === 'premium'}
          >
            {upgradingPlan === 'premium' ? 'Processing...' : 'Unlock Maximum Access (Test)'}
          </button>
        </div>
      </div>

      <div className="upgrade-faq">
        <h3>Frequently Asked Questions</h3>
        <p>Have questions? <a href="mailto:support@snaprium.com">Contact support</a>.</p>
      </div>
    </div>
  );
}