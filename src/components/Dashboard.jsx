// src/components/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { auth } from "../../lib/firebaseClient";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function Dashboard({ isOpen, onClose, toggleTheme, theme }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u); // u will be null if logged out
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="overlay" onClick={onClose}></div>

      {/* Dashboard Panel */}
      <aside className="dashboard-panel open">
        {/* Header */}
        <div className="dashboard-header">
          <h2>Dashboard</h2>
          <button onClick={onClose} className="nav-icon">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="dashboard-content">
          {/* Theme toggle */}
          <button className="theme-btn" onClick={toggleTheme}>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>

          {/* Sign In / Sign Out */}
          {user ? (
            <button
              className="signin-btn"
              onClick={async () => {
                await signOut(auth);
                navigate("/auth"); // redirect after logout
              }}
            >
              Sign Out
            </button>
          ) : (
            <button className="signin-btn" onClick={() => navigate("/auth")}>
              Sign In
            </button>
          )}
        </div>
      </aside>
    </>
  );
}