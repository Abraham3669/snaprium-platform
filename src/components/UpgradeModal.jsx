// src/components/UpgradeModal.jsx
import React from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function UpgradeModal({
  isOpen,
  onClose,
  title = "Limit reached",
  subtitle = "You've reached the limit on the free plan. Upgrade to keep going.",
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const goToUpgradePage = () => {
    onClose();
    navigate("/upgrade");
  };

  return (
    <div className="upgrade-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <button className="upgrade-close" onClick={onClose} aria-label="Close">
          <X size={28} />
        </button>

        <div className="upgrade-header">
          <div className="limit-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>

          <h2 className="upgrade-title">{title}</h2>
          <p className="upgrade-subtitle">{subtitle}</p>
        </div>

        <div className="upgrade-body">
          <p className="upgrade-main-text">
            Unlimited gives you <strong>unlimited photo solves</strong>,{" "}
            <strong>longer live sessions with more people</strong>, and more boards and
            circles to run. Everyone in a session you host gets the longer time too.
          </p>
          {user?.email && (
            <p className="upgrade-subtitle" style={{ marginTop: 10 }}>
              Signed in as {user.email}
            </p>
          )}
        </div>

        <div className="upgrade-actions">
          <button className="upgrade-btn primary full-width" onClick={goToUpgradePage}>
            Upgrade to Unlimited
          </button>
        </div>
      </div>
    </div>
  );
}