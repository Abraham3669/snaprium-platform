// src/pages/Upgrade.jsx
import React from 'react';

export default function Upgrade() {
  return (
    <div className="upgrade-page">
      <div className="upgrade-header">
        <h2>Choose Your Plan</h2>
        <p>Get more expert-level solutions every month.</p>
      </div>

      <div className="pricing-grid">
        <div className="pricing-card">
          <h3>Free</h3>
          <p className="price">$0</p>
          <p>15 solutions/month</p>
          <p>Perfect for light study and quick homework help.</p>
          <button disabled>Current Plan</button>
        </div>

        <div className="pricing-card pro">
          <div className="popular-badge">MOST POPULAR</div>
          <h3>Pro</h3>
          <p className="price">$9.99/mo</p>
          <p>75 expert solutions/month</p>
          <p>Built for serious students who solve consistently and prepare with confidence.</p>
          <button className="plan-cta primary">Upgrade to Pro</button>
        </div>

        <div className="pricing-card">
          <h3>Premium</h3>
          <p className="price">$14.99/mo</p>
          <p>150 advanced solutions/month</p>
          <p>Maximum solving power for exam season and heavy coursework.</p>
          <button className="plan-cta">Upgrade to Premium</button>
        </div>
      </div>
    </div>
  );
}