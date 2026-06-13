// src/App.jsx
import { useState, useRef, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

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

import { postAPI } from "./utils/apiClient";

import { doc, updateDoc, increment, serverTimestamp, getDoc } from "firebase/firestore";
import { auth, db, analytics, logEvent, setUserId } from "./lib/firebase";
import { useAuth } from "./context/AuthContext";
import Refund from "./pages/Refund";

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

  // FIXED Welcome Modal Logic - Updated for Unlimited plan
  useEffect(() => {
    if (!user?.uid || !user?.plan) {
      setShowWelcomeModal(false);
      return;
    }

    const isUnlimited = user.plan === 'unlimited' || user.plan === 'premium';

    if (!isUnlimited) {
      setShowWelcomeModal(false);
      return;
    }

    const welcomeKey = `welcome_shown_${user.uid}_${user.plan}`;
    const hasSeen = localStorage.getItem(welcomeKey);

    if (!hasSeen) {
      console.log(`[App] Showing welcome modal for ${user.plan} plan (first time)`);
      
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
        localStorage.setItem(welcomeKey, 'true');
        logEvent(analytics, "welcome_modal_shown", { plan: user.plan });
      }, 800);

      return () => clearTimeout(timer);
    } else {
      console.log(`[App] Welcome modal already shown for ${user.plan} - skipping`);
      setShowWelcomeModal(false);
    }
  }, [user?.uid, user?.plan]);

  useEffect(() => {
    if (user?.uid) {
      setUserId(analytics, user.uid);
      logEvent(analytics, "login", { method: user.providerData?.[0]?.providerId || "unknown" });
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






  const handleCropComplete = async (dataUrl) => {
  setCroppedImage(dataUrl);
  setIsCropperOpen(false);

  // Keep result panel open if already open
  setIsResultOpen(true);

  try {
    // CHECK LIMIT FIRST
    if (!(await checkSolveLimit())) {
      return;
    }

    // ONLY start loading if allowed
    setIsProcessing(true);
    setResultText("");

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

      await incrementSolveCount();
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
          uploadCount: increment(1),
          lastUpload: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("Process error:", err);
      setResultText("Failed to get solution – please try again");
      setIsProcessing(false);

      logEvent(analytics, "solution_generated", {
        success: false,
        error_message: err.message?.substring(0, 100) || "unknown_error",
      });
    }
  };

  // ==================== FIXED: Daily Limit Logic ====================
  const checkSolveLimit = async () => {
    if (!user) {
      let guestSolves = parseInt(localStorage.getItem('guestSolves') || '0', 10);
      if (guestSolves >= 2) {
        logEvent(analytics, "guest_limit_hit", { solves_attempted: guestSolves + 1 });

        toast(
  <div style={{ textAlign: 'center' }}>
    <p style={{ marginBottom: '12px', fontWeight: 500 }}>
      Sign in to unlock more expert solutions and unlimited access.
    </p>
    <button
      onClick={() => {
        navigate('/login');
        toast.dismiss();
      }}
      style={{
        background: 'var(--accent)',
        color: 'white',
        border: 'none',
        padding: '12px 28px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      Sign In Now
    </button>
  </div>,
  {
    position: "center",           // Best for important messages
    autoClose: false,             // Don't auto close important toast
    closeOnClick: false,
    pauseOnHover: true,
    className: 'guest-limit-toast',
  }
);
        return false;
      }
      return true;
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return true;

    const data = userSnap.data();
    const plan = data.plan || 'free';

    // Unlimited users have no limit
    if (plan === 'unlimited' || plan === 'premium') {
      return true;
    }

    // Free users: 10 solves per day
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastSolveDate = data.lastSolveDate || '';
    let dailySolves = data.dailySolves || 0;

    // Reset counter if it's a new day
    if (lastSolveDate !== today) {
      dailySolves = 0;
    }

    if (dailySolves >= 5) {
      logEvent(analytics, "upgrade_modal_shown", {
        plan: 'free',
        daily_solves: dailySolves,
        user_type: "registered",
      });

      setShowUpgradeModal(true);
      return false;
    }

    return true;
  };

  // ==================== FIXED: Daily Counter Increment ====================
  const incrementSolveCount = async () => {
    if (!user) {
      let guestSolves = parseInt(localStorage.getItem('guestSolves') || '0', 10);
      localStorage.setItem('guestSolves', guestSolves + 1);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const userRef = doc(db, "users", user.uid);

    await updateDoc(userRef, {
      dailySolves: increment(1),
      lastSolveDate: today,
      lastSolve: serverTimestamp(),
    });
  };

  return (
    <div className="App min-h-screen">
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
          {/* Left: Logo + Brand */}
          <div className="snaprium-brand">
            <img 
              src={new URL('./assets/logo.png', import.meta.url).href}
              alt="Snaprium Logo"
              className="snaprium-logo"
              width="32"
              height="32"
            />
            snaprium
          </div>

          {/* Right side: Plan Badge - Updated for Unlimited */}
          <div className="header-right">
            {/* Modern Subscriber Badge */}
{user && (user.plan === 'unlimited' || user.plan === 'premium') && (
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
                    logEvent(analytics, "camera_input_started", { user_type: user ? "registered" : "guest" });
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

{showUpgradeModal && <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />}
                
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      

      {/* Welcome Modal */}
      {showWelcomeModal && user && (
        <WelcomeModal
          plan={user.plan}
          onClose={() => setShowWelcomeModal(false)}
        />
      )}
    </div>
  );
}

export default App;