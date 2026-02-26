// src/components/Dashboard.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

export default function Dashboard({ isOpen, onClose, toggleTheme, theme }) {
  const { user, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (!isOpen) return null;

  const handleNavigate = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <>
      <div className="overlay active" onClick={onClose}></div>

      <aside className="dashboard-panel open" key={user ? user.uid : "guest"}>
        <div className="dashboard-header">
          <h2>Dashboard</h2>

          {/* Close Button */}
          <button id="closeDashboard" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="dashboard-content">
          {/* 1. User Section or Sign In */}
          {user ? (
            <div className="user-section">
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="user-avatar"
                  width={48}
                  height={48}
                />
              )}

              <div className="user-info">
                <span className="user-name">
                  {user.displayName || user.email}
                </span>

                <button
                  className="signout-btn dashboard-btn"
                  onClick={() => {
                    signOutUser();
                    onClose();
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <button
              className="signin-btn dashboard-btn"
              onClick={() => handleNavigate("/login")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Sign In
            </button>
          )}

          {/* Upgrade Plan – added right here, same style as others */}
          <button
            className="upgrade-btn dashboard-btn"
            onClick={() => setShowUpgrade(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            Upgrade Plan
          </button>

          {/* Home */}
          <button
            className="home-btn dashboard-btn"
            onClick={() => handleNavigate("/")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Home
          </button>

          {/* Theme Toggle */}
          <button
            className="theme-btn dashboard-btn"
            onClick={toggleTheme}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </aside>

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div className="upgrade-overlay" onClick={() => setShowUpgrade(false)}>
          <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
            <button className="upgrade-close" onClick={() => setShowUpgrade(false)}>
              ✕
            </button>

            <div className="upgrade-header">
              <h2 className="upgrade-title">Unlock More Expert-Level Solutions</h2>
              <p className="upgrade-subtitle">
                Get more high-quality, exam-ready step-by-step solutions every month.
              </p>
            </div>

            <div className="pricing-grid">
              {/* Free */}
              <div className="pricing-card free">
                <h3 className="plan-name">Free</h3>
                <p className="plan-desc">15 Solutions Every Month</p>
                <p className="plan-detail">
                  Perfect for light study and quick homework help.
                </p>
                <button className="plan-cta disabled">Current Plan</button>
              </div>

              {/* Pro – Highlighted */}
              <div className="pricing-card pro">
                <div className="popular-badge">MOST POPULAR</div>
                <h3 className="plan-name">Pro</h3>
                <p className="plan-desc">75 Expert-Level Solutions Every Month</p>
                <p className="plan-detail">
                  Built for serious students who solve consistently and prepare with confidence.
                </p>
                <button className="plan-cta primary">Upgrade to Pro</button>
              </div>

              {/* Premium */}
              <div className="pricing-card premium">
                <h3 className="plan-name">Premium</h3>
                <p className="plan-desc">150 Advanced Solutions Every Month</p>
                <p className="plan-detail">
                  Maximum solving power for exam season and heavy coursework.
                </p>
                <button className="plan-cta">Upgrade to Premium</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}