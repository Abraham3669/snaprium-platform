// src/components/Dashboard.jsx
import React from "react";

export default function Dashboard({ isOpen, onClose, toggleTheme, theme }) {
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
          <button className="signin-btn" onClick={() => (window.location.href = "/login")}>
            Sign In
          </button>
        </div>
      </aside>
    </>
  );
}