// src/components/BottomNav.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

export default function BottomNav({ toggleTheme, theme, isResultOpen }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  if (isResultOpen) {
    return null;
  }

  const path = location.pathname;
  const isHome = path === "/";
  const isStudy = path.startsWith("/study");
  const isCommunity = path.startsWith("/community");

  return (
    <nav className="bottom-nav">
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

      <button
        className={`bottom-nav-item ${isStudy ? "active" : ""}`}
        onClick={() => navigate("/study")}
        aria-label="Study with friends"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span>Friends</span>
      </button>

      <button
        className={`bottom-nav-item ${isCommunity ? "active" : ""}`}
        onClick={() => navigate("/community")}
        aria-label="Communities"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>Community</span>
      </button>

      <button
        className="bottom-nav-item"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {theme === "dark" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
        <span>{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
    </nav>
  );
}