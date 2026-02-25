// src/components/Dashboard.jsx
import React from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function Dashboard({ isOpen, onClose, toggleTheme, theme }) {
  const { user, signOutUser } = useAuth();

  // Debug log – shows every time the dashboard opens / re-renders
  console.log('Dashboard rendering - current user:', user ? user.uid : 'none');

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
            <div
              className="user-section"
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginTop: "16px",
                padding: "12px 0",
              }}
            >
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="user-avatar"
                  width={40}
                  height={40}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                />
              )}
              <span
                className="user-name"
                style={{
                  fontWeight: "500",
                  fontSize: "16px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "180px",
                }}
              >
                {user.displayName || user.email}
              </span>
              <button
                className="signout-btn"
                onClick={signOutUser}
                style={{
                  background: "rgba(255, 68, 68, 0.1)",
                  color: "#ff4444",
                  border: "1px solid #ff4444",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              className="signin-btn"
              onClick={() => (window.location.href = "/login")}
              style={{
                width: "100%",
                marginTop: "16px",
                padding: "12px",
                background: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "16px",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </aside>
    </>
  );
}