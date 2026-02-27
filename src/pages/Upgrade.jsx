// src/pages/Upgrade.jsx
import React, { useState } from 'react';

export default function Upgrade() {
  const [billing, setBilling] = useState('monthly');

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

        {/* Pro */}
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
          <button className="plan-cta primary">Upgrade to Pro</button>
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
          <button className="plan-cta">Upgrade to Premium</button>
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