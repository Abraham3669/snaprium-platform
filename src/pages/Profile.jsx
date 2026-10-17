// src/pages/Profile.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { useAuth } from "../context/AuthContext";
import { auth, db } from "../lib/firebase";
import "../styles/profile.css";

function compressImage(file, max = 400, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l2-2h6l2 2h3v11H4V8z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4L12 3z" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function readTheme() {
  return (
    localStorage.getItem("theme") ||
    document.documentElement.getAttribute("data-theme") ||
    "light"
  );
}

export default function Profile() {
  const { user, loading, refreshUser, signOutUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState("");
  const [theme, setTheme] = useState(readTheme);
  const [portalLoading, setPortalLoading] = useState(false);
  const isApp = Capacitor.isNativePlatform();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    setName(user.displayName || "");
    if (user.photoURL) setPreview(user.photoURL);
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="pf-page">
        <p className="pf-loading">Loading profile…</p>
      </div>
    );
  }

  if (!user) return null;

  const shownName = user.displayName || user.email?.split("@")[0] || "Your profile";
  const banned = user.banned === true || user.isBanned === true;
  const dirty = name.trim() !== (user.displayName || "");
  const isSubscribed =
    user.subscription === "pro" ||
    user.subscription === "premium" ||
    user.plan === "unlimited" ||
    user.plan === "premium" ||
    user.subscriptionStatus === "active";

  const toggleThemeLocal = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
    // Keep in sync if App also listens for storage/theme events
    window.dispatchEvent(new CustomEvent("snaprium-theme", { detail: next }));
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const apiBase = (import.meta.env.VITE_API_URL || "https://snaprium.com").replace(/\/$/, "");
      const response = await fetch(`${apiBase}/api/customer-portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await response.json();
      if (!data.url) {
        toast.error(data.error || "Unable to open management portal.");
        return;
      }
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: data.url });
      } else {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error("Something went wrong. Please try again later.");
    } finally {
      setPortalLoading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    const clean = name.trim().slice(0, 40);
    if (!clean) {
      toast.warning("Enter a display name");
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: clean,
          email: user.email || auth.currentUser?.email || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: clean });
      }
      await refreshUser?.();
      toast.success("Profile updated");
    } catch (err) {
      console.error("[profile] save", err);
      toast.error("Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSaving(true);
    try {
      const photoURL = await compressImage(file);
      setPreview(photoURL);
      await setDoc(
  doc(db, "users", user.uid),
  { photoURL, updatedAt: serverTimestamp() },
  { merge: true }
);
await refreshUser?.();
setPreview(photoURL);
      toast.success("Photo updated");
    } catch (err) {
      console.error(err);
      toast.error("Could not update photo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pf-page">
      {banned && (
        <div className="pf-banner-warn" role="alert">
          This account is restricted. Contact support if you think this is a mistake.
        </div>
      )}

      <section className="pf-hero">
        <div className="pf-cover" aria-hidden="true" />
        <div className="pf-hero-body">
          <button
            type="button"
            className="pf-avatar"
            onClick={() => fileRef.current?.click()}
            disabled={saving}
            aria-label="Change photo"
          >
            {preview ? <img src={preview} alt="" /> : shownName.slice(0, 1).toUpperCase()}
            <span className="pf-avatar-badge">
              <CameraIcon />
            </span>
          </button>
          <div className="pf-who">
            <h1 className="pf-name">{shownName}</h1>
            <p className="pf-email">{user.email}</p>
            <p className="pf-signin-note">Signed in with Google</p>
          </div>
        </div>
      </section>

      <div className="pf-grid">
        <form className="pf-card" onSubmit={save}>
          <div className="pf-card-head">
            <h2>Account</h2>
            <p>This name and photo show in circles.</p>
          </div>
          <label className="pf-field">
            <span>Display name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Your name"
              autoComplete="name"
            />
            <small>{name.length}/40</small>
          </label>
          <button
            type="submit"
            className="pf-btn pf-btn-primary"
            disabled={saving || !dirty || !name.trim()}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        <aside className="pf-side">
          <div className="pf-card pf-links">
            <button type="button" className="pf-link" onClick={() => navigate("/community")}>
              <span className="pf-link-icon"><UsersIcon /></span>
              <span className="pf-link-text">
                <strong>My circles</strong>
                <small>Study groups you've joined</small>
              </span>
              <ChevronIcon />
            </button>

            {!isApp && (
              <button type="button" className="pf-link" onClick={() => navigate("/")}>
                <span className="pf-link-icon"><HomeIcon /></span>
                <span className="pf-link-text">
                  <strong>Home</strong>
                  <small>Back to the solver</small>
                </span>
                <ChevronIcon />
              </button>
            )}

            <button type="button" className="pf-link" onClick={toggleThemeLocal}>
              <span className="pf-link-icon"><ThemeIcon /></span>
              <span className="pf-link-text">
                <strong>{theme === "dark" ? "Light mode" : "Dark mode"}</strong>
                <small>Appearance</small>
              </span>
              <ChevronIcon />
            </button>

            {isSubscribed ? (
              <button
                type="button"
                className="pf-link"
                onClick={handleManageSubscription}
                disabled={portalLoading}
              >
                <span className="pf-link-icon"><CardIcon /></span>
                <span className="pf-link-text">
                  <strong>{portalLoading ? "Opening…" : "Manage subscription"}</strong>
                  <small>Billing and plan</small>
                </span>
                <ChevronIcon />
              </button>
            ) : (
              <button type="button" className="pf-link" onClick={() => navigate("/upgrade")}>
                <span className="pf-link-icon pf-link-icon-accent"><SparkIcon /></span>
                <span className="pf-link-text">
                  <strong>Upgrade plan</strong>
                  <small>Unlimited solves and more</small>
                </span>
                <ChevronIcon />
              </button>
            )}

            {isSubscribed && (
              <button type="button" className="pf-link" onClick={() => navigate("/refunds")}>
                <span className="pf-link-icon"><InfoIcon /></span>
                <span className="pf-link-text">
                  <strong>Request refund</strong>
                  <small>Billing help</small>
                </span>
                <ChevronIcon />
              </button>
            )}
          </div>

          <button
            type="button"
            className="pf-btn pf-btn-out"
            onClick={async () => {
              await signOutUser();
              navigate("/");
            }}
          >
            Sign out
          </button>
        </aside>
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
    </div>
  );
}