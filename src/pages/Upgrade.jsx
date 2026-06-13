// src/pages/Upgrade.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePaddle } from '../context/PaddleContext';

export default function Upgrade() {
  const { user, loading: authLoading } = useAuth();
  const { openCheckout, isReady: paddleReady } = usePaddle();

  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);   // ← Renamed for clarity

  const UNLIMITED_PRICE_ID = 'pri_01ktdn3fppsgkgjhm8xm5ha015';

  // Debug logs
  useEffect(() => {
    console.log("🔍 [Upgrade Page] State:", {
      hasUser: !!user,
      uid: user?.uid,
      plan: user?.plan,
      isUnlimited: user?.isUnlimited,
      authLoading,
      paddleReady,
      showCheckout
    });
  }, [user, authLoading, paddleReady, showCheckout]);

  const handleUpgrade = async () => {
    if (authLoading) {
      alert("Please wait while we load your account...");
      return;
    }

    if (!user?.uid) {
      alert("Please sign in to upgrade.");
      return;
    }

    if (!paddleReady) {
      alert("Paddle is still loading. Please refresh the page.");
      return;
    }

    setError('');
    setUpgrading(true);

    try {
      console.log("🚀 Showing checkout container and opening Paddle...");

      // Step 1: Show the container FIRST
      setShowCheckout(true);

      // Step 2: Small delay to let React render the div
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 3: Now open the checkout
      await openCheckout({
        priceId: UNLIMITED_PRICE_ID,
        userId: user.uid,
        email: user.email,
      });

      console.log("✅ Paddle Checkout opened successfully");
    } catch (err) {
      console.error("❌ Checkout Error:", err);
      setError("Failed to open checkout. Please try again.");
      setShowCheckout(false); // Hide container on error
    } finally {
      setUpgrading(false);
    }
  };

  const isUnlimited = user?.isUnlimited || user?.plan === 'unlimited';

  if (authLoading) {
    return <div className="upgrade-page">Loading your account...</div>;
  }

  return (
    <div className="upgrade-page">
      <div className="upgrade-header">
        <h2>Upgrade to Unlimited</h2>
        <p>Solve Math and Physics problems without restrictions</p>
      </div>

      {/* Pricing Cards - Hide when checkout is visible */}
      {!showCheckout && (
        <div className="pricing-grid">
          {/* Free Plan */}
          <div className="pricing-card">
            <h3>Free</h3>
            <div className="plan-price">$0 <span>per month</span></div>
            <p className="plan-desc"><strong>5 solves per day</strong></p>
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
                ? 'Opening Checkout...' 
                : isUnlimited 
                  ? '✅ Unlimited Active' 
                  : 'Upgrade to Unlimited'}
            </button>

            <p className="billed-text">Cancel anytime • Monthly subscription</p>
          </div>
        </div>
      )}

      {/* Paddle Inline Checkout Container */}
      {showCheckout && (
        <div className="paddle-checkout-wrapper">
          <h3 className="checkout-title">Complete Your Upgrade</h3>
          
          <div 
            id="paddle-checkout-container" 
            className="my-8 paddle-checkout-frame"
          />
          
          <button 
            className="back-button"
            onClick={() => setShowCheckout(false)}
            style={{ marginTop: '24px' }}
          >
            ← Back to Plans
          </button>
        </div>
      )}

      {error && (
        <p className="error-message" style={{ textAlign: 'center', marginTop: '20px', color: 'red' }}>
          {error}
        </p>
      )}
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