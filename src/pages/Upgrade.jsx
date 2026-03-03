// src/pages/Upgrade.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Upgrade() {
  const { user } = useAuth();

  // Fixed monthly checkout links
  const PRO_CHECKOUT_URL = 'https://snaprium.lemonsqueezy.com/checkout/buy/0ff0290f-5155-451a-9821-6c9d7de658c3';
  const PREMIUM_CHECKOUT_URL = 'https://snaprium.lemonsqueezy.com/checkout/buy/8dda82b4-5cef-451f-be8d-da5a0c0099c4';

  const handleUpgrade = (plan) => {
    if (!user?.email || !user?.uid) {
      alert('Please sign in to upgrade');
      return;
    }

    let checkoutUrl = '';
    if (plan === 'pro') {
      checkoutUrl = PRO_CHECKOUT_URL;
    } else if (plan === 'premium') {
      checkoutUrl = PREMIUM_CHECKOUT_URL;
    }

    const finalUrl = `${checkoutUrl}?checkout[email]=${encodeURIComponent(user.email)}&checkout[custom][user_id]=${encodeURIComponent(user.uid)}`;

    window.location.href = finalUrl;
  };

  // Fixed monthly prices
  const proPrice = '9.99';
  const premiumPrice = '14.99';

  return (
    <div className="upgrade-page">
      <div className="upgrade-header">
        <h2>Choose Your Plan</h2>
        <p>Get more high-quality, exam-ready step-by-step solutions every month.</p>
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
    ${proPrice} <span>per month</span>
  </div>
  <p className="plan-desc">
    75 full step-by-step solutions monthly
  </p>
  <p className="plan-detail">
    Ideal for consistent practice, assignments, and weekly exam prep.
  </p>
  <button 
    className="plan-cta primary"
    onClick={() => handleUpgrade('pro')}
  >
    Get Pro Access
  </button>
</div>

        {/* Premium */}
        <div className="pricing-card premium">
  <h3>Premium</h3>
  <div className="plan-price">
    ${premiumPrice} <span>per month</span>
  </div>
  <p className="plan-desc">
    150 full step-by-step solutions monthly
  </p>
  <p className="plan-detail">
    Built for intensive revision, past questions, and heavy coursework.
  </p>
  <button 
    className="plan-cta primary"
    onClick={() => handleUpgrade('premium')}
  >
    Unlock Maximum Access
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