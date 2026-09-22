// src/pages/Upgrade.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { usePaddle } from "../context/PaddleContext";
import { Capacitor } from "@capacitor/core";
import { analytics, logEvent } from "../lib/firebase";
import { iapConfigured, purchaseUnlimited, restoreUnlimited } from "../lib/iap";

export default function Upgrade() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const { openCheckout, isReady: paddleReady } = usePaddle();

  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);

  const UNLIMITED_PRICE_ID = "pri_01ktdn3fppsgkgjhm8xm5ha015";
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    logEvent(analytics, "upgrade_page_opened", {
      plan: user?.plan || "free",
    });
  }, [user]);

  const handleUpgrade = async () => {
    if (authLoading) {
      alert("Please wait while we load your account...");
      return;
    }
    if (!user?.uid) {
      alert("Please sign in to upgrade.");
      return;
    }

    setError("");
    setUpgrading(true);
    logEvent(analytics, "checkout_started", {
      platform: isNative ? "native" : "web",
    });

    try {
      if (isNative) {
        await purchaseUnlimited(user.uid);
        await refreshUser?.();
        return;
      }

      if (!paddleReady) {
        alert("Paddle is still loading. Please refresh the page.");
        return;
      }

      setShowCheckout(true);
      await new Promise((r) => setTimeout(r, 100));
      await openCheckout({
        priceId: UNLIMITED_PRICE_ID,
        userId: user.uid,
        email: user.email,
        successUrl: "https://snaprium.com/checkout-return",
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to start checkout. Please try again.");
      setShowCheckout(false);
    } finally {
      setUpgrading(false);
    }
  };

  const handleRestore = async () => {
    if (!user?.uid) return;
    setError("");
    setUpgrading(true);
    try {
      await restoreUnlimited(user.uid);
      await refreshUser?.();
    } catch (err) {
      setError(err.message || "Could not restore purchases.");
    } finally {
      setUpgrading(false);
    }
  };

  const isUnlimited = user?.isUnlimited || user?.plan === "unlimited";

  if (authLoading) {
    return <div className="upgrade-page">Loading your account...</div>;
  }

  return (
    <div className="upgrade-page">
      <div className="upgrade-header">
        <h2>Upgrade to Unlimited</h2>
        <p>Solve freely. Study with friends. Keep going when it matters.</p>
      </div>

      {!showCheckout && (
        <div className="pricing-grid">
          <div className="pricing-card">
            <h3>Free</h3>
            <div className="plan-price">
              $0 <span>per month</span>
            </div>
            <p className="plan-desc">
              <strong>5 home solves / day</strong>
            </p>
            <p className="plan-detail">
              Try the solver, join study rooms, and use 5 group AI asks per day.
            </p>
            <button className="plan-cta disabled">Current Plan</button>
          </div>

          <div className="pricing-card premium">
            <div className="popular-badge">RECOMMENDED</div>
            <h3>Unlimited</h3>
            <div className="plan-price">
              $14.99 <span>per month</span>
            </div>
            <p className="plan-desc">For students who study every day</p>
            <ul className="plan-features">
              <li><CheckIcon /> Unlimited photo solves on the home screen</li>
              <li><CheckIcon /> More follow-up questions on every solution</li>
              <li><CheckIcon /> Study rooms stay included — video, screen share, and shared questions</li>
              <li><CheckIcon /> Communities and group AI for real study sessions</li>
              <li><CheckIcon /> Built for exam nights and long study sessions</li>
            </ul>
            <button
              className="plan-cta primary"
              onClick={handleUpgrade}
              disabled={upgrading || isUnlimited}
            >
              {upgrading
                ? isNative ? "Starting store…" : "Opening Checkout..."
                : isUnlimited
                ? "✅ Unlimited Active"
                : "Upgrade to Unlimited"}
            </button>
            {isNative && !isUnlimited && (
              <button
                type="button"
                className="back-button"
                onClick={handleRestore}
                disabled={upgrading}
                style={{ marginTop: 12 }}
              >
                Restore purchases
              </button>
            )}
            <p className="billed-text">
              {isNative
                ? "Billed by Apple or Google • Cancel anytime"
                : "Cancel anytime • Monthly subscription"}
            </p>
            {isNative && !iapConfigured() && (
              <p className="plan-detail">Store product is not live yet. Add RevenueCat keys after the subscription exists in App Store Connect / Play.</p>
            )}
          </div>
        </div>
      )}

      {showCheckout && !isNative && (
        <div className="paddle-checkout-wrapper">
          <h3 className="checkout-title">Complete Your Upgrade</h3>
          <div id="paddle-checkout-container" className="my-8 paddle-checkout-frame" />
          <button className="back-button" onClick={() => setShowCheckout(false)} style={{ marginTop: "24px" }}>
            ← Back to Plans
          </button>
        </div>
      )}

      {error && (
        <p className="error-message" style={{ textAlign: "center", marginTop: 20, color: "red" }}>
          {error}
        </p>
      )}
    </div>
  );
}

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);