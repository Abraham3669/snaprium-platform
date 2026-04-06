import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePaddle } from '../context/PaddleContext';
import WelcomeModal from './WelcomeModal';   // adjust path if needed

export default function Upgrade() {
  const { user } = useAuth();
  const { openCheckout } = usePaddle();

  const [upgrading, setUpgrading] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [upgradedPlan, setUpgradedPlan] = useState(null);

  // Detect when plan actually changes to pro/premium
  useEffect(() => {
    if (upgradedPlan && user?.plan === upgradedPlan) {
      setShowWelcome(true);
      setUpgradedPlan(null); // reset so it doesn't re-trigger
    }
  }, [user?.plan, upgradedPlan]);

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
      setUpgradedPlan(plan);   // This will trigger WelcomeModal when real-time updates

      console.log(`[Upgrade] Checkout done for ${plan}. Waiting for Firestore update...`);
    });
  };

  const closeWelcome = () => {
    setShowWelcome(false);
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
        <div className="pricing-card">
          <h3>Free</h3>
          <div className="plan-price">$0 <span>per month</span></div>
          <button className="plan-cta disabled">Current Plan</button>
        </div>

        <div className="pricing-card pro">
          <div className="popular-badge">MOST POPULAR</div>
          <h3>Pro</h3>
          <div className="plan-price">$9.99 <span>per month</span></div>
          <button 
            className="plan-cta primary"
            onClick={() => handleUpgrade('pro')}
            disabled={upgrading === 'pro' || isPro}
          >
            {upgrading === 'pro' ? 'Processing...' : isPro ? '✅ Active' : 'Get Pro Access'}
          </button>
        </div>

        <div className="pricing-card premium">
          <h3>Premium</h3>
          <div className="plan-price">$14.99 <span>per month</span></div>
          <button 
            className="plan-cta primary"
            onClick={() => handleUpgrade('premium')}
            disabled={upgrading === 'premium' || isPremium}
          >
            {upgrading === 'premium' ? 'Processing...' : isPremium ? '✅ Active' : 'Unlock Premium'}
          </button>
        </div>
      </div>

      {/* Welcome Modal with Confetti */}
      {showWelcome && user && (
        <WelcomeModal 
          plan={user.plan} 
          onClose={closeWelcome} 
        />
      )}
    </div>
  );
}