// src/components/feed/SignInGate.jsx
// What a signed-out visitor sees when they try to do something that needs an account.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { rememberReturn } from "../../lib/returnTo";

export const GATE_TEXT = {
  spark: "Sign in to Spark posts that helped you.",
  reply: "Sign in to join the conversation.",
  follow: "Sign in to follow people and see their posts first.",
  save: "Sign in to save posts and find them later.",
  post: "Sign in to share what you're learning.",
  ask: "Sign in to ask a question and get help.",
  default: "Sign in to take part.",
};

export function useGoAuth() {
  const navigate = useNavigate();
  return (to) => {
    rememberReturn(window.location.pathname + window.location.search);
    navigate(to);
  };
}

export default function SignInGate({ action, onClose }) {
  const goAuth = useGoAuth();
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return createPortal(
    <div className="fd-modal-back center" onClick={onClose}>
      <div className="fd-dialog" role="dialog" aria-modal="true" aria-labelledby="fd-gate-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="fd-gate-title">Join Snaprium</h3>
        <p>{GATE_TEXT[action] || GATE_TEXT.default}</p>
        <div className="fd-dialog-actions stack">
          <button type="button" className="fd-btn primary" onClick={() => goAuth("/signup")}>Create account</button>
          <button type="button" className="fd-btn" onClick={() => goAuth("/login")}>Log in</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// A compact banner for the top of the feed (phone) and the side column (computer).
export function GuestBanner({ compact = false }) {
  const goAuth = useGoAuth();
  return (
    <section className={`fd-guest ${compact ? "compact" : ""}`} aria-label="Join Snaprium">
      <h3>Learn together on Snaprium</h3>
      <p>Ask questions, share what you learn and join circles of people learning the same things.</p>
      <div className="fd-guest-actions">
        <button type="button" className="fd-btn primary" onClick={() => goAuth("/signup")}>Sign up</button>
        <button type="button" className="fd-btn" onClick={() => goAuth("/login")}>Log in</button>
      </div>
    </section>
  );
}