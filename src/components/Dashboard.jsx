// src/components/Dashboard.jsx
import React from "react";
import { useAuth } from "../context/AuthContext.jsx"; // ← add this import

export default function Dashboard({ isOpen, onClose, toggleTheme, theme }) {
  const { user, signOutUser } = useAuth(); // ← use auth context

  if (!isOpen) return null;

  return (
    <>
      <div className="overlay" onClick={onClose}></div>

      <aside className="dashboard-panel open">
        <div className="dashboard-header">
          <h2>Dashboard</h2>
          <button onClick={onClose} className="nav-icon">✕</button>
        </div>

        <div className="dashboard-content">
          <button className="theme-btn" onClick={toggleTheme}>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>

          {user ? (
            <div className="user-section">
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="user-avatar"
                  width={32}
                  height={32}
                  style={{ borderRadius: "50%" }}
                />
              )}
              <span className="user-name">
                {user.displayName || user.email}
              </span>
              <button className="signout-btn" onClick={signOutUser}>
                Sign Out
              </button>
            </div>
          ) : (
            <button
              className="signin-btn"
              onClick={() => (window.location.href = "/login")}
            >
              Sign In
            </button>
          )}
        </div>
      </aside>
    </>
  );
}