// src/pages/Upgrade.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // assuming you have this

export default function Upgrade() {
  const { user } = useAuth(); // get current user (email & uid)
  const [billing, setBilling] = useState('monthly');

  // Replace these with your REAL Lemon Squeezy checkout links
  const PRO_CHECKOUT_URL = 'https://snaprium.lemonsqueezy.com/checkout/buy/0ff0290f-5155-451a-9821-6c9d7de658c3'; // Pro monthly
  const PREMIUM_CHECKOUT_URL = 'https://snaprium.lemonsqueezy.com/checkout/buy/8dda82b4-5cef-451f-be8d-da5a0c0099c4'; // Premium monthly

  // Optional: yearly variants if you created separate products
  // const PRO_YEARLY_URL = 'https://...';
  // const PREMIUM_YEARLY_URL = 'https://...';

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

    // Add custom fields: pre-fill email + send user_id for webhook
    const finalUrl = `${checkoutUrl}?checkout[email]=${encodeURIComponent(user.email)}&checkout[custom][user_id]=${encodeURIComponent(user.uid)}`;

    window.location.href = finalUrl;
  };

  const proPrice = billing === 'monthly' ? '9.99' : '99.99';
  const premiumPrice = billing === 'monthly' ? '14.99' : '149.99';

  return (
    <div className="upgrade-page">
      <div className="upgrade-header">
        <h2>Choose Your Plan</h2>
        <p>Get more high-quality, exam-ready step-by-step solutions every month.</p>

        {/* Billing Toggle */}
        <div className="billing-toggle">
          <button 
            className={billing === 'monthly' ? 'active' : ''} 
            onClick={() => setBilling('monthly')}
          >
            Monthly
          </button>
          <button 
            className={billing === 'yearly' ? 'active' : ''} 
            onClick={() => setBilling('yearly')}
          >
            Yearly <span className="save-badge">Save 20%</span>
          </button>
        </div>
      </div>

      <div className="pricing-grid">
        {/* Free */}
        <div className="pricing-card">
          <h3>Free</h3>
          <div className="plan-price">$0 <span>per month</span></div>
          <p className="plan-desc">15 solutions per month</p>
          <ul className="plan-features">
            <li>Basic step-by-step solutions</li>
            <li>Quick homework help</li>
            <li>Limited advanced topics</li>
          </ul>
          <button className="plan-cta disabled">Current Plan</button>
        </div>

        {/* Pro – MOST POPULAR */}
        <div className="pricing-card pro">
          <div className="popular-badge">MOST POPULAR</div>
          <h3>Pro</h3>
          <div className="plan-price">
            ${proPrice} <span>per {billing === 'monthly' ? 'month' : 'year'}</span>
          </div>
          <p className="plan-desc">75 expert solutions per month</p>
          <ul className="plan-features">
            <li>Full expert step-by-step solutions</li>
            <li>Priority processing</li>
            <li>Advanced math, physics & chemistry</li>
            <li>Exam prep tools</li>
          </ul>
          <button 
            className="plan-cta primary"
            onClick={() => handleUpgrade('pro')}
          >
            Upgrade to Pro
          </button>
        </div>

        {/* Premium */}
        <div className="pricing-card premium">
          <h3>Premium</h3>
          <div className="plan-price">
            ${premiumPrice} <span>per {billing === 'monthly' ? 'month' : 'year'}</span>
          </div>
          <p className="plan-desc">150 advanced solutions per month</p>
          <ul className="plan-features">
            <li>Unlimited expert solutions</li>
            <li>Fastest priority processing</li>
            <li>All subjects + advanced topics</li>
            <li>Priority support</li>
            <li>Early access to new features</li>
          </ul>
          <button 
            className="plan-cta"
            onClick={() => handleUpgrade('premium')}
          >
            Upgrade to Premium
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