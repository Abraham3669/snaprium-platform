// src/App.jsx
import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Home from "./pages/Home";
import FeedHome, { FeedSkeleton } from "./pages/FeedHome";
import PostPage from "./pages/PostPage";
import AuthorPage from "./pages/AuthorPage";
import Community from "./pages/Community";
import Admin from "./pages/Admin";
import CameraInput from "./components/CameraInput";
import CropperModal from "./components/CropperModal";
import ResultPanel from "./components/ResultPanel";
import Dashboard from "./components/Dashboard";
import UpgradeModal from "./components/UpgradeModal";
import WelcomeModal from "./components/WelcomeModal";
import CommunityDetail from "./pages/CommunityDetail";
import CommunityChat from "./pages/CommunityChat";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import MessagesPage from "./pages/MessagesPage";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Upgrade from "./pages/Upgrade";
import Refund from "./pages/Refund";
import Checkout from "./pages/Checkout";
import CheckoutReturn from "./pages/CheckoutReturn";

import StudyLobby from "./pages/StudyLobby";
import StudyRoom from "./pages/StudyRoom";

import { postAPI } from "./utils/apiClient";
import {
  doc,
  updateDoc,
  setDoc,
  increment,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db, analytics, logEvent, setUserId } from "./lib/firebase";
import { useAuth } from "./context/AuthContext";
import ErrorBanner from "./components/ErrorBanner";
import { showAppError } from "./utils/errorReporter";
import BottomNav from "./components/BottomNav";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import useNotifications from "./lib/useNotifications";
import PushPrompt from "./components/PushPrompt";
import { useInbox } from "./lib/dms";
import { useMessageAlerts } from "./lib/alerts";
import { useFriendships } from "./lib/friends";
import { syncPush, clearDeliveredPush } from "./lib/push";
import { publishPublicProfile } from "./lib/publicProfile";
import { clearReturn, peekReturn } from "./lib/returnTo";
import "./styles/social.css";

const GUEST_SOLVE_LIMIT = 3;
const FREE_DAILY_LIMIT = 10;
const isNativeApp = Capacitor.isNativePlatform();
const getToday = () => new Date().toISOString().split("T")[0];

function App() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  // Notifications (bell + page) and iPhone push
  const notifications = useNotifications(user?.uid);

  // Friends badge (bottom bar): unread chats plus friend requests waiting for you
  const { list: inboxList, unread: unreadChats } = useInbox(user?.uid);
  const { incoming: friendRequests } = useFriendships(user?.uid);
  const socialBadge = unreadChats + friendRequests.length;

  // Sound (on by default) and desktop pop-ups for new messages while the tab is open
  useMessageAlerts({ me: user?.uid || "", inbox: inboxList, items: notifications.items, pathname: location.pathname, navigate });

  useEffect(() => {
    syncPush(user?.uid, (url) => navigate(url));
  }, [user?.uid]);

  // While the app is still signing you in (after a refresh) show a small spinner where "Sign in" would be,
  // so it never looks like you were logged out. If it takes unusually long, show the normal button again.
  const [authSlow, setAuthSlow] = useState(false);
  const signingIn = !!authLoading && !user && !authSlow;
  useEffect(() => {
    if (!authLoading || user) {
      setAuthSlow(false);
      return undefined;
    }
    const t = setTimeout(() => setAuthSlow(true), 8000);
    return () => clearTimeout(t);
  }, [authLoading, user]);

  // Page content always starts exactly below the real header height (it changes with the bell,
  // small phones, wrapped buttons and the iPhone notch), so nothing hides underneath it.
  useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector(".snaprium-header");
    if (!header) {
      root.style.removeProperty("--snaprium-header-h");
      root.style.removeProperty("--snaprium-main-pad");
      return undefined;
    }
    const apply = () => {
      root.style.setProperty("--snaprium-header-h", `${Math.ceil(header.getBoundingClientRect().height)}px`);
      // How much space the page wrapper already leaves for the header (differs between setups)
      const main = document.querySelector("main");
      const pad = main ? parseFloat(getComputedStyle(main).paddingTop) || 0 : 0;
      root.style.setProperty("--snaprium-main-pad", `${Math.round(pad)}px`);
    };
    apply();
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(apply);
      ro.observe(header);
    }
    window.addEventListener("resize", apply);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [location.pathname, user?.uid]);

  // A signed-out visitor tapped Spark / Reply / Follow, signed in, and should land back where they were.
  useEffect(() => {
    if (!user?.uid) return;
    if (!["/", "/login", "/signup"].includes(location.pathname)) return;
    const back = peekReturn();
    if (!back) return;
    clearReturn();
    if (back !== location.pathname) navigate(back, { replace: true });
  }, [user?.uid, location.pathname, navigate]);

  // Public name + photo card (publicProfiles/{uid}). Other people read it to show your CURRENT name and
  // photo in chat, questions and notifications, so changing your profile updates it everywhere.
  useEffect(() => {
    publishPublicProfile(user).catch(() => {});
  }, [user?.uid, user?.displayName, user?.photoURL, user?.profileLoaded]);

  // Profile's theme switch tells the app, so toasts and the status bar follow it
  useEffect(() => {
    const onTheme = (e) => {
      if (e?.detail === "dark" || e?.detail === "light") setTheme(e.detail);
    };
    window.addEventListener("snaprium-theme", onTheme);
    return () => window.removeEventListener("snaprium-theme", onTheme);
  }, []);

  // Coming back to the app clears old alerts from the lock screen and resets the badge.
  useEffect(() => {
    if (!isNativeApp) return undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") clearDeliveredPush();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

useEffect(() => {
  document.documentElement.setAttribute("data-theme", theme);
  if (isNativeApp) {
    document.documentElement.classList.add("native-app");
    StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light }).catch(() => {});
  }
}, [theme]);

  const [file, setFile] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [resultText, setResultText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    if (!user?.uid || !user?.plan) {
      setShowWelcomeModal(false);
      return;
    }

    const isUnlimited = user.plan === "unlimited" || user.plan === "premium";
    if (!isUnlimited) {
      setShowWelcomeModal(false);
      return;
    }

    const welcomeKey = `welcome_shown_${user.uid}_${user.plan}`;
    const hasSeen = localStorage.getItem(welcomeKey);

    if (!hasSeen) {
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
        localStorage.setItem(welcomeKey, "true");
        logEvent(analytics, "welcome_modal_shown", { plan: user.plan });
      }, 800);
      return () => clearTimeout(timer);
    }

    setShowWelcomeModal(false);
  }, [user?.uid, user?.plan]);

  useEffect(() => {
    if (user?.uid) {
      setUserId(analytics, user.uid);
      logEvent(analytics, "login", {
        method: user.providerData?.[0]?.providerId || "unknown",
      });
    }
  }, [user]);

  useEffect(() => {
    logEvent(analytics, "page_view", {
      page_path: location.pathname + location.search,
      page_title: document.title || "Snaprium",
      page_location: window.location.href,
    });
  }, [location]);

 const toggleTheme = () => {
  const nextTheme = theme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
  localStorage.setItem("theme", nextTheme);
};

  const checkSolveLimit = async () => {
    if (!user) {
      const guestSolves = parseInt(localStorage.getItem("guestSolves") || "0", 10);
      if (guestSolves >= GUEST_SOLVE_LIMIT) {
        logEvent(analytics, "guest_limit_hit", {
          solves_attempted: guestSolves + 1,
        });
        toast(
          <div style={{ textAlign: "center" }}>
            <p style={{ marginBottom: "12px", fontWeight: 500 }}>
              Sign in to unlock more expert solutions and continue solving.
            </p>
            <button
              onClick={() => {
                navigate("/login");
                toast.dismiss();
              }}
              style={{
                background: "var(--accent)",
                color: "white",
                border: "none",
                padding: "10px 24px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              Sign In Now
            </button>
          </div>,
          {
            position: "top-center",
            autoClose: false,
            closeOnClick: false,
            pauseOnHover: true,
            className: "guest-limit-toast",
          }
        );
        return false;
      }
      return true;
    }

    const plan = user.plan || "free";
    if (plan === "unlimited" || plan === "premium") return true;

    const today = getToday();
    let dailySolves = user.dailySolves || 0;
    let lastSolveDate = user.lastSolveDate || "";

    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        dailySolves = data.dailySolves || 0;
        lastSolveDate = data.lastSolveDate || "";
      }
    } catch (err) {
      console.warn("[Limit] using cached user data", err?.message);
    }

    if (lastSolveDate !== today) dailySolves = 0;

    if (dailySolves >= FREE_DAILY_LIMIT) {
      logEvent(analytics, "upgrade_modal_shown", {
        plan: "free",
        daily_solves: dailySolves,
        user_type: "registered",
      });
      setShowUpgradeModal(true);
      return false;
    }

    return true;
  };

  const incrementSolveCount = async () => {
    if (!user) {
      const guestSolves = parseInt(localStorage.getItem("guestSolves") || "0", 10);
      localStorage.setItem("guestSolves", String(guestSolves + 1));
      return;
    }

    const today = getToday();
    const userRef = doc(db, "users", user.uid);

    let dailySolves = user.dailySolves || 0;
    let lastSolveDate = user.lastSolveDate || "";

    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        dailySolves = snap.data().dailySolves || 0;
        lastSolveDate = snap.data().lastSolveDate || "";
      }
    } catch (_) {}

    const nextCount = lastSolveDate === today ? dailySolves + 1 : 1;

    const payload = {
      dailySolves: nextCount,
      lastSolveDate: today,
      lastSolve: serverTimestamp(),
      uploadCount: increment(1),
      lastUpload: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDoc(userRef, payload);
    } catch (err) {
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email || "",
          plan: user.plan || "free",
          dailySolves: nextCount,
          lastSolveDate: today,
          lastSolve: serverTimestamp(),
          uploadCount: 1,
          lastUpload: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.warn("[Increment] used setDoc fallback", err?.message);
    }
  };

  const handleCropComplete = async (dataUrl) => {
    setCroppedImage(dataUrl);
    setIsCropperOpen(false);
    setIsResultOpen(true);
    setResultText("");
    setIsProcessing(true);

    try {
      if (!(await checkSolveLimit())) {
        setIsResultOpen(false);
        setIsProcessing(false);
        return;
      }

      const res = await postAPI("/api/process", {
        imageBase64: dataUrl.split(",")[1],
      });

      setResultText(
        res.answer || res.text || JSON.stringify(res) || "No answer received"
      );
      setIsProcessing(false);

      logEvent(analytics, "photo_processed", {
        user_type: user ? "registered" : "guest",
        image_size: dataUrl.length,
      });

      logEvent(analytics, "solution_generated", {
        success: true,
        user_type: user ? "registered" : "guest",
      });

      incrementSolveCount().catch((e) => {
        console.warn("[post-solve] background update failed:", e);
      });
    } catch (err) {
      showAppError("Process Image", err);
      setResultText("Failed to get solution – please try again");
      logEvent(analytics, "solution_generated", {
        success: false,
        error_message: err.message?.substring(0, 100) || "unknown_error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Full-screen pages (study room, solo, circle chat, circle page, messages and friends) have their own top bar.
  const hideChrome =
    location.pathname.startsWith("/study") ||
    location.pathname.includes("/chat") ||
    location.pathname === "/solo" ||
    location.pathname.startsWith("/messages") ||
    location.pathname === "/friends" ||
    /^\/community\/[^/]+$/.test(location.pathname);

  return (
  <div className="App min-h-screen">
    <ErrorBanner />
    <PushPrompt user={user} />
    <ToastContainer
      position="bottom-center"
      autoClose={5000}
      hideProgressBar
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={theme}
    />

    {!hideChrome && (
  <header className="snaprium-header">
      <div className="snaprium-header-inner">
                <button
          type="button"
          className="snaprium-brand"
          onClick={() => navigate("/")}
          aria-label="Go to home"
        >
          <img
            src={new URL("./assets/logo.png", import.meta.url).href}
            alt=""
            className="snaprium-logo"
            width="32"
            height="32"
          />
          snaprium
        </button>

        <div className="header-right">
{user && (user.plan === "unlimited" || user.plan === "premium") && (
  <span className="plan-crown" title="Unlimited plan" aria-label="Unlimited plan">
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <defs>
        <linearGradient id="crownGold" x1="3" y1="5" x2="21" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8E19A" />
          <stop offset="0.5" stopColor="#E2B340" />
          <stop offset="1" stopColor="#B8860B" />
        </linearGradient>
      </defs>
      {/* peaks */}
      <path
        fill="url(#crownGold)"
        d="M4 17.5 5.2 9.2l3.9 3.3L12 6.5l2.9 6 3.9-3.3L20 17.5H4z"
      />
      {/* band */}
      <rect x="4" y="17.2" width="16" height="3.2" rx="1" fill="url(#crownGold)" />
    </svg>
  </span>
)}

          {!isNativeApp && !user && (
          <button
            type="button"
            className="snaprium-menu-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          )}

          {user && (
            <button
              type="button"
              className="snaprium-menu-btn header-bell-btn"
              onClick={() => navigate("/notifications")}
              aria-label={
                notifications.unread > 0
                  ? `Notifications, ${notifications.unread} new`
                  : "Notifications"
              }
              title="Notifications"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {notifications.unread > 0 && (
                <span className="header-bell-badge">
                  {notifications.unread > 9 ? "9+" : notifications.unread}
                </span>
              )}
            </button>
          )}

          {user ? (
            <button
              type="button"
              className="header-avatar-btn"
              onClick={() => navigate("/profile")}
              aria-label="Profile"
              title="Profile"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="header-avatar-img" />
              ) : (
                <span className="header-avatar-fallback">
                  {(user.displayName || user.email || "U").slice(0, 1).toUpperCase()}
                </span>
              )}
            </button>
          ) : signingIn ? (
            <span className="header-auth-wait" role="status" aria-live="polite">
              <span className="header-auth-spin" aria-hidden="true" />
              <span className="header-auth-text">Signing you in…</span>
            </span>
          ) : (
            <button
              type="button"
              className="header-signin-btn"
              onClick={() => navigate("/login")}
            >
              Sign in
            </button>
          )}
        </div>
      </div>
      </header>
)}

    {/* Dashboard drawer disabled — actions live on Profile + header
    <Dashboard
      isOpen={isDashboardOpen}
      onClose={() => setIsDashboardOpen(false)}
      toggleTheme={toggleTheme}
      theme={theme}
    />
    */}

    {/* Single Routes — no conflict */}
    <Routes>
      {/* Study Room needs full control of the screen */}
      <Route path="/study/:roomId" element={<StudyRoom />} />

      {/* Everything else stays in the normal padded layout */}
      <Route
        path="*"
        element={
          <main className="pt-16">
            <Routes>
              {/* The feed for everyone. Signed-out visitors can read it; Spark, reply, follow and post ask them to sign in. While we are still checking, a skeleton, so nobody sees the wrong page flash by. */}
              <Route
                path="/"
                element={
                  !user && authLoading && !authSlow ? (
                    <FeedSkeleton />
                  ) : (
                    <FeedHome user={user || null} unread={notifications.unread} social={socialBadge} />
                  )
                }
              />
              {/* The old home page (the tools hub) stays available here. */}
              <Route path="/home" element={<Home />} />
              <Route path="/post/:postId" element={<PostPage />} />
              <Route path="/u/:uid" element={<AuthorPage />} />

<Route
  path="/solo"
  element={
    <>
      <button
        type="button"
        className="hub-back"
        onClick={() => navigate("/")}
      >
        ← Home
      </button>
      <CameraInput
        onFileSelect={(selectedFile) => {
          setFile(selectedFile);
          setIsCropperOpen(true);
          logEvent(analytics, "camera_input_started", {
            user_type: user ? "registered" : "guest",
          });
        }}
             onOpenDashboard={() => navigate("/profile")}
      />

      <CropperModal
        file={file}
        isOpen={isCropperOpen}
        onClose={() => {
          setIsCropperOpen(false);
          setFile(null);
        }}
        onCrop={handleCropComplete}
      />

      {isResultOpen && (
        <ResultPanel
          result={{ image: croppedImage, text: resultText }}
          loading={isProcessing}
          onClose={() => setIsResultOpen(false)}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </>
  }
/>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/upgrade" element={<Upgrade />} />
              <Route path="/refunds" element={<Refund />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/checkout-return" element={<CheckoutReturn />} />
              <Route path="/study" element={<StudyLobby />} />
              <Route path="/community" element={<Community />} />
              <Route path="*" element={<Navigate to="/" replace />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/community/:communityId" element={<CommunityDetail />} />
              <Route path="/community/:communityId/chat" element={<CommunityChat />} />
<Route path="/community/:communityId" element={<CommunityDetail />} />
<Route path="/community/:communityId/chat" element={<CommunityChat />} />
<Route path="/profile" element={<Profile />} />
<Route path="/messages" element={<MessagesPage />} />
<Route path="/messages/:uid" element={<MessagesPage />} />
<Route path="/friends" element={<MessagesPage />} />
<Route
  path="/notifications"
  element={
    <Notifications
      items={notifications.items}
      loading={notifications.loading}
      unread={notifications.unread}
      markRead={notifications.markRead}
      markAllRead={notifications.markAllRead}
    />
  }
/>
            </Routes>
          </main>
        }
      />
    </Routes>

    {showWelcomeModal && user && (
      <WelcomeModal
        plan={user.plan}
        onClose={() => setShowWelcomeModal(false)}
      />
    )}

      {!hideChrome && (
  <BottomNav
    toggleTheme={toggleTheme}
    theme={theme}
    isResultOpen={isResultOpen}
    socialBadge={socialBadge}
      />
    )}
  </div>

  );
}

export default App;