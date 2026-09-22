import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { isStandaloneApp } from "../lib/firebase";
const isNative = Capacitor.isNativePlatform() || isStandaloneApp();

function IconSolo() {
  return (
    <svg className="hub-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="15" rx="3.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 10.4v1.6l1.2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconFriends() {
  return (
    <svg className="hub-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 19.2c.5-3 2.9-4.8 5.5-4.8s5 1.8 5.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17.2" cy="8.8" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16.2 14.6c2.2.3 3.9 1.8 4.4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconCommunity() {
  return (
    <svg className="hub-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18M12 3c2.7 2.5 4.1 5.6 4.1 9S14.7 18.5 12 21c-2.7-2.5-4.1-5.6-4.1-9S9.3 5.5 12 3z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="hub-page">
      <header className="hub-top">
        <h1 className="hub-title">How do you want to study?</h1>
        <p className="hub-sub">Snap. Solve. Study together.</p>
      </header>

      <div className="hub-grid">
        <button type="button" className="hub-card" onClick={() => navigate("/solo")}>
          <span className="hub-icon-wrap">
            <IconSolo />
          </span>
          <div className="hub-card-copy">
            <h2>Solo study</h2>
            <p>Snap. Solve. Understand.</p>
          </div>
        </button>

        <button type="button" className="hub-card" onClick={() => navigate("/study")}>
          <span className="hub-icon-wrap">
            <IconFriends />
          </span>
          <div className="hub-card-copy">
            <h2>Study with friends</h2>
            <p>Private room. Invite only.</p>
          </div>
        </button>

        <button
          type="button"
          className="hub-card hub-card-wide"
          onClick={() => navigate("/community")}
        >
          <span className="hub-icon-wrap">
            <IconCommunity />
          </span>
          <div className="hub-card-copy">
            <h2>Communities</h2>
            <p>Public or private groups.</p>
          </div>
        </button>
      </div>

      {!isNative && (
  <footer className="hub-legal">
    <Link to="/terms">Terms</Link>
    <span>·</span>
    <Link to="/privacy">Privacy</Link>
    <span>·</span>
    <Link to="/refunds">Refunds</Link>
    <span>·</span>
    <Link to="/upgrade">Pricing</Link>
  </footer>
)}
    </div>
  );
}