// src/pages/Settings.jsx  -  account settings (was the whole Profile page; /profile is now the profile itself)
import { setDesktopOn, setSoundOn, useAlertPrefs } from "../lib/alerts";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { useAuth } from "../context/AuthContext";
import { auth, db } from "../lib/firebase";
import { restoreUnlimited, syncSubscriptionQuietly } from "../lib/iap";
import { useBlocked } from "../lib/moderation";
import { isClean, FILTER_MESSAGE } from "../lib/contentFilter";
import { BIO_MAX, compressBanner, fetchProfileCard, saveProfileExtras } from "../lib/publicProfile";
import { useFriendships } from "../lib/friends";
import { useInbox } from "../lib/dms";
import ProfileStats from "../components/feed/ProfileStats";
import HandleSetting from "../components/feed/HandleSetting";
import { BackIcon } from "../components/feed/Icons";
import "../styles/profile.css";
import "../styles/profile-card.css";
import "../styles/feed.css";

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

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
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

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

function BlockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </svg>
  );
}

function SoloIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function FriendsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
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

export default function Settings() {
  const { user, loading, refreshUser, signOutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef(null);
  const bannerRef = useRef(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [savedBio, setSavedBio] = useState("");
  const [banner, setBanner] = useState("");
  const { friends: friendUids, incoming: friendRequests } = useFriendships(user?.uid);
  const { unread: unreadChats } = useInbox(user?.uid);

  // Friends and Messages are real pages now (/friends, /messages/<person>). Older links and
  // notifications that still point here (?friends=1, ?dm=<person>) are sent on to them.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("blocked") === "1") setBlockedOpen(true);
    const dm = q.get("dm");
    if (dm) navigate(`/messages/${dm}`, { replace: true });
    else if (q.get("friends") === "1") navigate("/friends", { replace: true });
  }, [location.search, navigate]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState("");
  const [theme, setTheme] = useState(readTheme);
  const alertPrefs = useAlertPrefs();
  const [portalLoading, setPortalLoading] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const { list: blockedList, unblock } = useBlocked(user?.uid);
  const isApp = Capacitor.isNativePlatform();
  const isIosApp = Capacitor.getPlatform() === "ios";

  // In the iPhone app, double-check the subscription with the server (renewals, cancellations, refunds).
  useEffect(() => {
    if (isIosApp && user?.uid) syncSubscriptionQuietly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Your bio and banner live on your public card.
  useEffect(() => {
    if (!user?.uid) return undefined;
    let cancelled = false;
    fetchProfileCard(user.uid).then((c) => {
      if (cancelled || !c) return;
      setBio(c.bio || "");
      setSavedBio(c.bio || "");
      setBanner(c.banner || "");
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

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
  const dirty = name.trim() !== (user.displayName || "") || bio.trim() !== savedBio.trim();
  // Same rule as the rest of the app (the premium icon, limits, Upgrade page): only the plan counts.
  // Old fields like subscription / subscriptionStatus can stay behind after a cancel, so they are not used.
  const isSubscribed = user.plan === "unlimited" || user.plan === "premium" || user.isUnlimited === true;

  const providerId = auth.currentUser?.providerData?.[0]?.providerId || "";
  const signInLabel =
    providerId === "apple.com"
      ? "Apple"
      : providerId === "google.com"
      ? "Google"
      : providerId === "password"
      ? "email"
      : "";

  const closeDelete = () => {
    if (deleting) return;
    setDelOpen(false);
    setDelText("");
  };

  const handleDelete = async () => {
    if (delText.trim().toUpperCase() !== "DELETE" || deleting) return;
    setDeleting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("not signed in");
      const apiBase = (import.meta.env.VITE_API_URL || "https://snaprium.com").replace(/\/$/, "");
      const response = await fetch(`${apiBase}/api/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        toast.error(data.error || "Could not delete your account. Please try again.");
        return;
      }
      setDelOpen(false);
      toast.success("Your account was deleted");
      try {
        await signOutUser();
      } catch {}
      navigate("/", { replace: true });
    } catch (err) {
      console.error("[profile] delete account", err);
      toast.error("Could not delete your account. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleThemeLocal = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
    // Keep in sync if App also listens for storage/theme events
    window.dispatchEvent(new CustomEvent("snaprium-theme", { detail: next }));
  };

  const handleManageSubscription = async () => {
    // iPhone app: subscriptions are managed by Apple, not the web billing portal
    if (isIosApp) {
      try {
        await Browser.open({ url: "https://apps.apple.com/account/subscriptions" });
      } catch (error) {
        console.error("Error opening Apple subscriptions:", error);
        toast.error("Open Settings > your name > Subscriptions to manage your plan.");
      }
      return;
    }
    setPortalLoading(true);
    try {
      const apiBase = (import.meta.env.VITE_API_URL || "https://snaprium.com").replace(/\/$/, "");
      const response = await fetch(`${apiBase}/api/customer-portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: await auth.currentUser.getIdToken() }),
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

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      await restoreUnlimited(user.uid);
      await refreshUser?.();
      toast.success("Your Unlimited plan is restored");
    } catch (err) {
      toast.error(err?.message || "Could not restore purchases. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  const openLegal = (path) => {
    if (isApp) {
      Browser.open({ url: `https://snaprium.com${path}` }).catch(() => {});
    } else {
      navigate(path);
    }
  };

  const handleRefund = async () => {
    // iPhone app: Apple handles refunds for App Store purchases
    if (isIosApp) {
      try {
        await Browser.open({ url: "https://reportaproblem.apple.com" });
      } catch {
        navigate("/refunds");
      }
      return;
    }
    navigate("/refunds");
  };

  const save = async (e) => {
    e.preventDefault();
    const clean = name.trim().slice(0, 40);
    if (!clean) {
      toast.warning("Enter a display name");
      return;
    }
    const cleanBio = bio.replace(/\s+/g, " ").trim().slice(0, BIO_MAX);
    if (!isClean(clean) || !isClean(cleanBio)) {
      toast.error(FILTER_MESSAGE);
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
      await saveProfileExtras({ ...user, displayName: clean }, { bio: cleanBio, displayName: clean });
      setBio(cleanBio);
      setSavedBio(cleanBio);
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

  const onBanner = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSaving(true);
    try {
      const img = await compressBanner(file);
      await saveProfileExtras(user, { banner: img });
      setBanner(img);
      toast.success("Banner updated");
    } catch (err) {
      console.error(err);
      toast.error("Could not update banner");
    } finally {
      setSaving(false);
    }
  };

  const removeBanner = async () => {
    setSaving(true);
    try {
      await saveProfileExtras(user, { banner: "" });
      setBanner("");
      toast.success("Banner removed");
    } catch {
      toast.error("Could not remove banner");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pf-page">
      <div className="pf-topbar" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button type="button" className="fd-back" style={{ marginLeft: 0 }} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/profile"))}><BackIcon /> Back</button>
        <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", textAlign: "left" }}>Settings</h1>
      </div>
      {banned && (
        <div className="pf-banner-warn" role="alert">
          This account is restricted. Contact support if you think this is a mistake.
        </div>
      )}

      <section className="pf-hero">
        <div className="pf-cover">
          {banner ? <img className="pf-cover-img" src={banner} alt="" /> : null}
          <div className="pf-cover-tools">
            <button type="button" className="pf-cover-btn" onClick={() => bannerRef.current?.click()} disabled={saving}>
              <CameraIcon />
              {banner ? "Change banner" : "Add banner"}
            </button>
            {banner && (
              <button type="button" className="pf-cover-btn" onClick={removeBanner} disabled={saving}>
                Remove
              </button>
            )}
          </div>
        </div>
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
            {savedBio ? <p className="pf-bio">{savedBio}</p> : null}
            <HandleSetting user={user} />
<ProfileStats uid={user.uid} />
            <div className="pf-chips">
              <span className={isSubscribed ? "pf-chip pf-chip-pro" : "pf-chip"}>
                {isSubscribed ? "Unlimited plan" : "Free plan"}
              </span>
              {signInLabel && <span className="pf-chip">Signed in with {signInLabel}</span>}
            </div>
          </div>
        </div>
      </section>

      <section className="pf-social" aria-label="Friends and messages">
        <button type="button" className="pf-social-tile" onClick={() => navigate("/friends")}>
          <span className="pf-social-icon"><FriendsIcon /></span>
          <span className="pf-social-text">
            <strong>Friends</strong>
            <small>
              {friendRequests.length > 0
                ? `${friendRequests.length} new request${friendRequests.length === 1 ? "" : "s"}`
                : friendUids.length > 0
                ? `${friendUids.length} friend${friendUids.length === 1 ? "" : "s"}`
                : "Add people you study with"}
            </small>
          </span>
          {friendRequests.length > 0 && <span className="pf-social-badge">{friendRequests.length}</span>}
          <ChevronIcon />
        </button>
        <button type="button" className="pf-social-tile" onClick={() => navigate("/messages")}>
          <span className="pf-social-icon"><MessageIcon /></span>
          <span className="pf-social-text">
            <strong>Messages</strong>
            <small>{unreadChats > 0 ? `${unreadChats} unread` : "Chat privately with friends"}</small>
          </span>
          {unreadChats > 0 && <span className="pf-social-badge">{unreadChats}</span>}
          <ChevronIcon />
        </button>
      </section>

      <div className="pf-grid">
        <form className="pf-card" onSubmit={save}>
          <div className="pf-card-head">
            <h2>Account</h2>
            <p>Your name, photo, banner and bio show when someone opens your profile.</p>
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
          <label className="pf-field">
            <span>Bio</span>
            <textarea
              className="pf-bio-input"
              value={bio}
              onChange={(e) => setBio(e.target.value.replace(/\n/g, " "))}
              maxLength={BIO_MAX}
              rows={3}
              placeholder="What are you studying? (optional)"
            />
            <small>{bio.length}/{BIO_MAX}</small>
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

            <button type="button" className="pf-link" onClick={() => navigate("/solo")}>
              <span className="pf-link-icon"><SoloIcon /></span>
              <span className="pf-link-text">
                <strong>Solo study</strong>
                <small>Snap a homework problem for a step-by-step solution</small>
              </span>
              <ChevronIcon />
            </button>

            {!isApp && (
              <button type="button" className="pf-link" onClick={() => navigate("/")}>
                <span className="pf-link-icon"><HomeIcon /></span>
                <span className="pf-link-text">
                  <strong>Home</strong>
                  <small>Back to your feed</small>
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

            <button type="button" className="pf-link" onClick={() => setSoundOn(!alertPrefs.sound)} role="switch" aria-checked={alertPrefs.sound}>
              <span className="pf-link-icon"><BellIcon /></span>
              <span className="pf-link-text">
                <strong>Message sounds</strong>
                <small>{alertPrefs.sound ? "On: a chime plays for new messages while Snaprium is open" : "Off"}</small>
              </span>
              <span className="pf-link-state" style={{ marginLeft: "auto", fontSize: "0.82rem", fontWeight: 700, color: alertPrefs.sound ? "var(--accent)" : "var(--text-secondary)" }}>{alertPrefs.sound ? "On" : "Off"}</span>
            </button>

            {alertPrefs.desktopSupported && (
              <button
                type="button"
                className="pf-link"
                disabled={alertPrefs.denied}
                onClick={() => setDesktopOn(!alertPrefs.desktop)}
                role="switch"
                aria-checked={alertPrefs.desktop}
              >
                <span className="pf-link-icon"><BellIcon /></span>
                <span className="pf-link-text">
                  <strong>Desktop alerts</strong>
                  <small>{alertPrefs.denied ? "Blocked in your browser settings" : alertPrefs.desktop ? "On: a pop-up when this tab is in the background" : "Off"}</small>
                </span>
                <span className="pf-link-state" style={{ marginLeft: "auto", fontSize: "0.82rem", fontWeight: 700, color: alertPrefs.desktop ? "var(--accent)" : "var(--text-secondary)" }}>{alertPrefs.desktop ? "On" : "Off"}</span>
              </button>
            )}

            <button type="button" className="pf-link" onClick={() => setBlockedOpen(true)}>
              <span className="pf-link-icon"><BlockIcon /></span>
              <span className="pf-link-text">
                <strong>Blocked users</strong>
                <small>{blockedList.length > 0 ? `${blockedList.length} blocked` : "People you've blocked"}</small>
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

            {isIosApp && (
              <button
                type="button"
                className="pf-link"
                onClick={handleRestore}
                disabled={restoring}
              >
                <span className="pf-link-icon"><CardIcon /></span>
                <span className="pf-link-text">
                  <strong>{restoring ? "Restoring…" : "Restore purchases"}</strong>
                  <small>Already subscribed? Get your plan back</small>
                </span>
                <ChevronIcon />
              </button>
            )}

            {isSubscribed && (
              <button type="button" className="pf-link" onClick={handleRefund}>
                <span className="pf-link-icon"><InfoIcon /></span>
                <span className="pf-link-text">
                  <strong>Request refund</strong>
                  <small>{isIosApp ? "Handled by Apple" : "Billing help"}</small>
                </span>
                <ChevronIcon />
              </button>
            )}
          </div>

          <div className="pf-card pf-links">
            <button type="button" className="pf-link" onClick={() => openLegal("/terms")}>
              <span className="pf-link-icon"><FileIcon /></span>
              <span className="pf-link-text">
                <strong>Terms of Use</strong>
                <small>The rules for using Snaprium</small>
              </span>
              <ChevronIcon />
            </button>
            <button type="button" className="pf-link" onClick={() => openLegal("/privacy")}>
              <span className="pf-link-icon"><ShieldIcon /></span>
              <span className="pf-link-text">
                <strong>Privacy Policy</strong>
                <small>How we handle your data</small>
              </span>
              <ChevronIcon />
            </button>
            <button
              type="button"
              className="pf-link"
              onClick={() => {
                window.location.href = "mailto:support@snaprium.com";
              }}
            >
              <span className="pf-link-icon"><MailIcon /></span>
              <span className="pf-link-text">
                <strong>Contact support</strong>
                <small>support@snaprium.com</small>
              </span>
              <ChevronIcon />
            </button>
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

          <button type="button" className="pf-delete" onClick={() => setDelOpen(true)}>
            Delete account
          </button>
        </aside>
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
      <input ref={bannerRef} type="file" accept="image/*" hidden onChange={onBanner} />

      {blockedOpen && (
        <div className="pf-modal" onClick={() => setBlockedOpen(false)}>
          <div
            className="pf-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pf-blk-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pf-blk-title">Blocked users</h2>
            {blockedList.length === 0 ? (
              <p className="pf-blocked-empty">You haven't blocked anyone.</p>
            ) : (
              <ul className="pf-blocked-list">
                {blockedList.map((b) => (
                  <li key={b.uid} className="pf-blocked-row">
                    <span className="pf-blocked-av">
                      {b.photo ? <img src={b.photo} alt="" /> : (b.name || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="pf-blocked-name">{b.name || "Member"}</span>
                    <button
                      type="button"
                      className="pf-btn pf-btn-out"
                      onClick={() =>
                        unblock(b.uid)
                          .then(() => toast.success("Unblocked"))
                          .catch(() => toast.error("Could not unblock"))
                      }
                    >
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="pf-modal-actions">
              <button type="button" className="pf-btn pf-btn-out" onClick={() => setBlockedOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {delOpen && (
        <div className="pf-modal" onClick={closeDelete}>
          <div
            className="pf-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pf-del-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pf-del-title">Delete your account?</h2>
            <p>
              This permanently deletes your profile, your posts, messages and questions, and removes you
              from your circles. It can't be undone.
            </p>
            {isSubscribed && (
              <p className="pf-modal-note">
                Deleting your account does not cancel your subscription. Cancel it first
                {Capacitor.getPlatform() === "ios"
                  ? " in Settings > your name > Subscriptions."
                  : " from Manage subscription."}
              </p>
            )}
            <label className="pf-field">
              <span>Type DELETE to confirm</span>
              <input
                value={delText}
                onChange={(e) => setDelText(e.target.value)}
                placeholder="DELETE"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <div className="pf-modal-actions">
              <button type="button" className="pf-btn pf-btn-out" onClick={closeDelete} disabled={deleting}>
                Cancel
              </button>
              <button
                type="button"
                className="pf-btn pf-btn-danger"
                onClick={handleDelete}
                disabled={deleting || delText.trim().toUpperCase() !== "DELETE"}
              >
                {deleting ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}