// src/App.jsx
import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import CameraInput from "./components/CameraInput";
import CropperModal from "./components/CropperModal";
import ResultPanel from "./components/ResultPanel";
import Dashboard from "./components/Dashboard";
import UpgradeModal from "./components/UpgradeModal";
import WelcomeModal from "./components/WelcomeModal";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Upgrade from "./pages/Upgrade";
import Refund from "./pages/Refund";
import Checkout from "./pages/Checkout";
import CheckoutReturn from "./pages/CheckoutReturn";

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

const GUEST_SOLVE_LIMIT = 3;
const FREE_DAILY_LIMIT = 5;
const getToday = () => new Date().toISOString().split("T")[0];

function App() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
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
    document.documentElement.setAttribute("data-theme", nextTheme);
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

  return (
    <div className="App min-h-screen">
      <ErrorBanner />
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

      <header className="snaprium-header">
        <div className="snaprium-header-inner">
          <div className="snaprium-brand">
            <img
              src={new URL("./assets/logo.png", import.meta.url).href}
              alt="Snaprium Logo"
              className="snaprium-logo"
              width="32"
              height="32"
            />
            snaprium
          </div>

          <div className="header-right">
            {user && (user.plan === "unlimited" || user.plan === "premium") && (
              <div className="plan-badge unlimited" title="Unlimited Plan Active">
                <span className="diamond-icon">◆</span>
                Unlimited
              </div>
            )}

            <button
              onClick={() => setIsDashboardOpen(true)}
              className="snaprium-menu-btn"
              aria-label="Open dashboard"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="pt-16">
        <Dashboard
          isOpen={isDashboardOpen}
          onClose={() => setIsDashboardOpen(false)}
          toggleTheme={toggleTheme}
          theme={theme}
        />

        <Routes>
          <Route
            path="/"
            element={
              <>
                <CameraInput
                  onFileSelect={(selectedFile) => {
                    setFile(selectedFile);
                    setIsCropperOpen(true);
                    logEvent(analytics, "camera_input_started", {
                      user_type: user ? "registered" : "guest",
                    });
                  }}
                  onOpenDashboard={() => setIsDashboardOpen(true)}
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {showWelcomeModal && user && (
        <WelcomeModal
          plan={user.plan}
          onClose={() => setShowWelcomeModal(false)}
        />
      )}

      <BottomNav
        toggleTheme={toggleTheme}
        theme={theme}
        isResultOpen={isResultOpen}
      />
    </div>
  );
}

export default App;