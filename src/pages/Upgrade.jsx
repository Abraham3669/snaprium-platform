// src/pages/Upgrade.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePaddle } from '../context/PaddleContext';

export default function Upgrade() {
  const { user } = useAuth();
  const { openCheckout } = usePaddle();

  const [upgrading, setUpgrading] = useState(null);

  const PRO_PRICE_ID = 'pri_01knfpxnmh74xf080p5z07x05j';
  const PREMIUM_PRICE_ID = 'pri_01knfqbp8r1yqn4wrvq2xjh76p';

  const handleUpgrade = (plan) => {
    if (!user?.uid) {
      alert("Please sign in to upgrade.");
      return;
    }

    const priceId = plan === 'pro' ? PRO_PRICE_ID : PREMIUM_PRICE_ID;
    setUpgrading(plan);

    openCheckout(priceId, user, () => {
      setUpgrading(null);
      console.log(`[Upgrade] Paddle checkout completed for ${plan}. Firestore real-time update will handle success UI.`);
      
      // No more local welcome modal here - App.jsx now handles it cleanly
      // This prevents double modals and repeating confetti
    });
  };

  const currentPlan = user?.plan || 'free';
  const isPro = currentPlan === 'pro';
  const isPremium = currentPlan === 'premium';

  return (
    <div className="upgrade-page">
      <div className="upgrade-header">
        <h2>Choose Your Plan</h2>
        <p>Get more high-quality, exam-ready step-by-step solutions every month.</p>
        <p style={{ color: '#e67e22', fontWeight: 'bold' }}>🧪 SANDBOX TEST MODE</p>
      </div>

      <div className="pricing-grid">
        {/* Free */}
        <div className="pricing-card">
          <h3>Free</h3>
          <div className="plan-price">$0 <span>per month</span></div>
          <p className="plan-desc">
            15 full step-by-step solutions monthly
          </p>
          <p className="plan-detail">
            Perfect for light homework help and quick checks.
          </p>
          <button className="plan-cta disabled">Current Plan</button>
        </div>

        {/* Pro – MOST POPULAR */}
        <div className="pricing-card pro">
          <div className="popular-badge">MOST POPULAR</div>
          <h3>Pro</h3>
          <div className="plan-price">
            $9.99 <span>per month</span>
          </div>
          <p className="plan-desc">
            80 full step-by-step solutions monthly
          </p>
          <p className="plan-detail">
            Ideal for consistent practice, assignments, and weekly exam prep.
          </p>
          <button 
            className="plan-cta primary"
            onClick={() => handleUpgrade('pro')}
            disabled={upgrading === 'pro' || isPro}
          >
            {upgrading === 'pro' ? 'Processing...' : isPro ? '✅ Active' : 'Get Pro Access'}
          </button>
        </div>

        {/* Premium */}
        <div className="pricing-card premium">
          <h3>Premium</h3>
          <div className="plan-price">
            $14.99 <span>per month</span>
          </div>
          <p className="plan-desc">
            170 full step-by-step solutions monthly
          </p>
          <p className="plan-detail">
            Built for intensive revision, past questions, and heavy coursework.
          </p>
          <button 
            className="plan-cta primary"
            onClick={() => handleUpgrade('premium')}
            disabled={upgrading === 'premium' || isPremium}
          >
            {upgrading === 'premium' ? 'Processing...' : isPremium ? '✅ Active' : 'Unlock Maximum Access'}
          </button>
        </div>
      </div>

      {/* FAQ section */}
      <div className="upgrade-faq">
        <h3>Frequently Asked Questions</h3>
        <p>Have questions? <a href="mailto:support@snaprium.com">Contact support</a>.</p>
      </div>
    </div>
  );
}