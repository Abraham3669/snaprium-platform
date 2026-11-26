// src/pages/Upgrade.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { usePaddle } from "../context/PaddleContext";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { analytics, logEvent } from "../lib/firebase";
import { iapConfigured, purchaseUnlimited, restoreUnlimited, getUnlimitedPrice } from "../lib/iap";

export default function Upgrade() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const { openCheckout, isReady: paddleReady } = usePaddle();

  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [storePrice, setStorePrice] = useState("");
  const [success, setSuccess] = useState("");

  const UNLIMITED_PRICE_ID = "pri_01ktdn3fppsgkgjhm8xm5ha015";
  const isNative = Capacitor.isNativePlatform();
  const TERMS_URL = "https://snaprium.com/terms";
  const PRIVACY_URL = "https://snaprium.com/privacy";

  // inside the app, open links in the in-app browser
  const openLink = (e, url) => {
    if (!isNative) return;
    e.preventDefault();
    Browser.open({ url }).catch(() => {});
  };

  useEffect(() => {
    logEvent(analytics, "upgrade_page_opened", {
      plan: user?.plan || "free",
    });
  }, [user]);

  // in the app, show the price the store charges (local currency)
  useEffect(() => {
    if (!isNative || !user?.uid) return undefined;
    let cancelled = false;
    getUnlimitedPrice(user.uid)
      .then((price) => {
        if (!cancelled && price) setStorePrice(price);
      })
      .catch((err) => console.error("Could not load store price", err));
    return () => {
      cancelled = true;
    };
  }, [isNative, user?.uid]);

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
        setSuccess("Orbit is active. Longer live sessions and more circles are ready to use.");
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
      setSuccess("Your purchase was restored. Orbit is active.");
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
        <h2>Upgrade to Orbit</h2>
        <p>Build more circles. Stay in longer live sessions when it matters.</p>
      </div>

      {!showCheckout && (
        <div className="pricing-grid">
          <div className="pricing-card">
            <h3>Free</h3>
            <div className="plan-price">
              $0 <span>per month</span>
            </div>
            <p className="plan-desc">
              <strong>Circles and live sessions</strong>
            </p>
            <p className="plan-detail">
              Join circles and host live sessions for up to 5 people, 40 minutes each.
            </p>
            <button className="plan-cta disabled">Current Plan</button>
          </div>

          <div className="pricing-card premium">
            <div className="popular-badge">RECOMMENDED</div>
            <h3>Orbit</h3>
            <div className="plan-price">
              {isNative ? storePrice || "…" : "$12.99"} <span>per month</span>
            </div>
            <p className="plan-desc">Give your circle room to grow</p>
            <ul className="plan-features">
              <li><CheckIcon /> Live sessions for up to 10 people, 2 hours each</li>
              <li><CheckIcon /> Camera and screen share: 1,000 video minutes a month, shared by everyone in your sessions, then audio-only</li>
              <li><CheckIcon /> Video calls with friends (voice calls are always free)</li>
              <li><CheckIcon /> Create more circles</li>
              <li><CheckIcon /> More boards in every circle you run</li>
            </ul>
            <button
              className="plan-cta primary"
              onClick={handleUpgrade}
              disabled={upgrading || isUnlimited}
            >
              {upgrading
                ? isNative ? "Starting store…" : "Opening Checkout..."
                : isUnlimited
                ? "✅ Orbit Active"
                : "Upgrade to Orbit"}
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
                ? Capacitor.getPlatform() === "ios"
                  ? "Billed to your Apple ID • Cancel anytime"
                  : "Billed by Google Play • Cancel anytime"
                : "Cancel anytime • Monthly subscription"}
            </p>
            {isNative && !iapConfigured() && (
              <p className="plan-detail">
                Purchases are not available right now. Please try again later.
              </p>
            )}
            {isNative && (
              <p className="plan-detail" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>
                Snaprium Orbit is a monthly subscription. It renews automatically each month
                unless you cancel at least 24 hours before the end of the current period. You can
                manage or cancel it anytime in{" "}
                {Capacitor.getPlatform() === "ios"
                  ? "Settings › Apple ID › Subscriptions"
                  : "Google Play › Subscriptions"}
                .{" "}
                <a
                  href={TERMS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => openLink(e, TERMS_URL)}
                >
                  Terms of Use
                </a>
                {" · "}
                <a
                  href={PRIVACY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => openLink(e, PRIVACY_URL)}
                >
                  Privacy Policy
                </a>
              </p>
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

      {success && (
        <p className="success-message" role="status" style={{ marginTop: 20 }}>
          {success}
        </p>
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