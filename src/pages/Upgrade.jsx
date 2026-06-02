// src/pages/Upgrade.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePaddle } from '../context/PaddleContext';

export default function Upgrade() {
  const { user, loading: authLoading } = useAuth();
  const { openCheckout } = usePaddle();

  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState('');

  const UNLIMITED_PRICE_ID = 'pri_01kne83es3jr15vm5hhv0v8rm3';

  // Debug - Check what is happening
  useEffect(() => {
    console.log("🔍 [Upgrade Page] User State:", {
      hasUser: !!user,
      uid: user?.uid,
      email: user?.email,
      plan: user?.plan,
      isUnlimited: user?.isUnlimited,
      authLoading: authLoading
    });
  }, [user, authLoading]);

  const handleUpgrade = async () => {
    console.log("🚀 Upgrade button clicked");

    if (authLoading) {
      alert("Still loading your account. Please wait a moment.");
      return;
    }

    if (!user?.uid) {
      console.error("No user.uid found");
      alert("Please sign in to upgrade.");
      return;
    }

    setError('');
    setUpgrading(true);

    try {
      console.log("Opening Paddle checkout for user:", user.uid);
      
      await openCheckout({
        priceId: UNLIMITED_PRICE_ID,
        userId: user.uid,
        email: user.email,
      });
    } catch (err) {
      console.error("Checkout failed:", err);
      setError("Failed to open checkout. Please try again.");
    } finally {
      setUpgrading(false);
    }
  };

  const isUnlimited = user?.isUnlimited || user?.plan === 'unlimited';

  if (authLoading) {
    return (
      <div className="upgrade-page">
        <div className="upgrade-header">
          <h2>Loading your account...</h2>
          <p>Please wait</p>
        </div>
      </div>
    );
  }

  return (
    <div className="upgrade-page">
      <div className="upgrade-header">
        <h2>Upgrade to Unlimited</h2>
        <p>Solve Math and Physics problems without restrictions</p>
      </div>

      <div className="pricing-grid">
        {/* Free Plan */}
        <div className="pricing-card">
          <h3>Free</h3>
          <div className="plan-price">$0 <span>per month</span></div>
          <p className="plan-desc"><strong>10 solves per day</strong></p>
          <p className="plan-detail">
            Great for occasional help and trying out the app
          </p>
          <button className="plan-cta disabled">Current Plan</button>
        </div>

        {/* Unlimited Plan */}
        <div className="pricing-card premium">
          <div className="popular-badge">RECOMMENDED</div>
          
          <h3>Unlimited</h3>
          <div className="plan-price">
            $5.99 <span>per month</span>
          </div>

          <p className="plan-desc">Solve as many problems as you need</p>

          <ul className="plan-features">
            <li><CheckIcon /> Solve anytime, anywhere — no daily limits</li>
            <li><CheckIcon /> Perfect for heavy study sessions and exam preparation</li>
            <li><CheckIcon /> Full step-by-step explanations for Math & Physics</li>
            <li><CheckIcon /> Continue learning without interruptions</li>
          </ul>

          <button 
            className="plan-cta primary"
            onClick={handleUpgrade}
            disabled={upgrading || isUnlimited}
          >
            {upgrading 
              ? 'Processing...' 
              : isUnlimited 
                ? '✅ Unlimited Active' 
                : 'Upgrade to Unlimited'}
          </button>

          <p className="billed-text">Cancel anytime • Monthly subscription</p>
        </div>
      </div>

      {error && <p className="error-message" style={{ textAlign: 'center', marginTop: '20px', color: 'red' }}>{error}</p>}
    </div>
  );
}

// Simple SVG Check Icon
const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" 
       strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);