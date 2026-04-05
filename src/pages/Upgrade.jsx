import React from 'react';
import { useAuth } from '../context/AuthContext';
import { usePaddle } from '../context/PaddleContext';

export default function Upgrade() {
  const { user } = useAuth();
  const { openCheckout } = usePaddle();

  // ← TODO: Replace these with your actual Paddle Price IDs from the dashboard
    // Using your Pro plan for testing
 const PRO_PRICE_ID = 'pri_01kne83es3jr15vm5hhv0v8rm3';     // ← Your Pro Monthly Price
  const PREMIUM_PRICE_ID = 'pri_XXXXXXXXXXXXXXXXXXXXXXXX';   // ← Replace when you create Premium price

  
  const handleUpgrade = (plan) => {
    if (!user?.email || !user?.uid) {
      alert('Please sign in to upgrade your plan.');
      return;
    }

    const priceId = plan === 'pro' ? PRO_PRICE_ID : PREMIUM_PRICE_ID;

    openCheckout(priceId, (data) => {
      alert(`🎉 Thank you! Your ${plan.toUpperCase()} plan has been activated successfully.`);
      // Optional: Redirect to dashboard after successful payment
      // window.location.href = '/dashboard';
    });
  };

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
            80 full step-by-step solutions monthly
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
            170 full step-by-step solutions monthly
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