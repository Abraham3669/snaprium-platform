// src/components/BottomNav.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function BottomNav({ toggleTheme, theme }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Only show on main app pages, not on login/signup etc.
  const hideOn = ["/login", "/signup", "/forgot-password", "/terms", "/privacy", "/upgrade", "/refunds"];
  if (hideOn.includes(location.pathname)) return null;

  const isHome = location.pathname === "/";

  return (
    <nav className="bottom-nav">
      {/* Home */}
      <button
        className={`bottom-nav-item ${isHome ? "active" : ""}`}
        onClick={() => navigate("/")}
        aria-label="Home"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
          <path d="M9 21V12h6v9" />
        </svg>
        <span>Home</span>
      </button>

      {/* Theme */}
      <button
        className="bottom-nav-item"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {theme === "dark" ? (
          // Sun icon
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          // Moon icon
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
        <span>{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
    </nav>
  );
}