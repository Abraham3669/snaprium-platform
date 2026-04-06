// src/pages/Upgrade.jsx   (or wherever your Upgrade component lives)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePaddle } from '../context/PaddleContext';
import WelcomeModal from '../components/WelcomeModal';   // Correct relative path

export default function Upgrade() {
  const { user } = useAuth();
  const { openCheckout } = usePaddle();

  const [upgrading, setUpgrading] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);

  // Trigger modal only when plan actually becomes pro/premium
  useEffect(() => {
    const currentPlan = user?.plan;
    if ((currentPlan === 'pro' || currentPlan === 'premium') && !showWelcome) {
      // Small delay to let real-time update settle
      const timeout = setTimeout(() => {
        setShowWelcome(true);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [user?.plan, showWelcome]);

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
      console.log(`[Upgrade] Paddle checkout closed for ${plan}. Waiting for Firestore...`);
    });
  };

  const closeWelcome = () => setShowWelcome(false);

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

      {/* Welcome Modal */}
      {showWelcome && (
        <WelcomeModal plan={currentPlan} onClose={closeWelcome} />
      )}
    </div>
  );
}