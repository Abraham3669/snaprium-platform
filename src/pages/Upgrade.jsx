// src/pages/Upgrade.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { usePaddle } from "../context/PaddleContext";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

export default function Upgrade() {
  const { user, loading: authLoading } = useAuth();
  const { openCheckout, isReady: paddleReady } = usePaddle();

  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);

  const UNLIMITED_PRICE_ID = "pri_01ktdn3fppsgkgjhm8xm5ha015";

  useEffect(() => {
    console.log("[Upgrade]", {
      uid: user?.uid,
      plan: user?.plan,
      paddleReady,
      native: Capacitor.isNativePlatform(),
    });
  }, [user, paddleReady]);

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

    try {
      // ─── APK: open clean checkout page in system browser ───
      if (Capacitor.isNativePlatform()) {
        const params = new URLSearchParams({
          userId: user.uid,
          email: user.email || "",
          priceId: UNLIMITED_PRICE_ID,
        });

        // This page ONLY starts Paddle — no second upgrade UI
        const checkoutUrl = `https://snaprium.com/checkout?${params.toString()}`;

        console.log("Opening:", checkoutUrl);
        await Browser.open({
          url: checkoutUrl,
          presentationStyle: "popover",
        });
        return;
      }

      // ─── WEB: same as before ───
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
      setError("Failed to open checkout. Please try again.");
      setShowCheckout(false);
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
        <p>Study Math and Physics without limits</p>
      </div>

      {!showCheckout && (
        <div className="pricing-grid">
          <div className="pricing-card">
            <h3>Free</h3>
            <div className="plan-price">
              $0 <span>per month</span>
            </div>
            <p className="plan-desc">
              <strong>5 solves per day</strong>
            </p>
            <p className="plan-detail">Great for occasional help and trying out the app</p>
            <button className="plan-cta disabled">Current Plan</button>
          </div>

          <div className="pricing-card premium">
            <div className="popular-badge">RECOMMENDED</div>
            <h3>Unlimited</h3>
            <div className="plan-price">
              $5.99 <span>per month</span>
            </div>
            <p className="plan-desc">Solve as many problems as you need</p>
            <ul className="plan-features">
              <li><CheckIcon /> Ask more follow-up questions to fully understand every solution</li>
              <li><CheckIcon /> Study whenever you need — no daily limits</li>
              <li><CheckIcon /> Perfect for heavy study sessions and exam preparation</li>
              
              <li><CheckIcon /> Continue learning without interruptions</li>
            </ul>
            <button
              className="plan-cta primary"
              onClick={handleUpgrade}
              disabled={upgrading || isUnlimited}
            >
              {upgrading
                ? "Opening Checkout..."
                : isUnlimited
                ? "✅ Unlimited Active"
                : "Upgrade to Unlimited"}
            </button>
            <p className="billed-text">Cancel anytime • Monthly subscription</p>
          </div>
        </div>
      )}

      {showCheckout && !Capacitor.isNativePlatform() && (
        <div className="paddle-checkout-wrapper">
          <h3 className="checkout-title">Complete Your Upgrade</h3>
          <div id="paddle-checkout-container" className="my-8 paddle-checkout-frame" />
          <button
            className="back-button"
            onClick={() => setShowCheckout(false)}
            style={{ marginTop: "24px" }}
          >
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
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#10b981"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ marginRight: 10, flexShrink: 0 }}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);