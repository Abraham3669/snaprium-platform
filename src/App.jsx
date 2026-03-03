// src/App.jsx
import { useState, useRef, useEffect } from "react";  // Added useEffect
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";  // Added useLocation
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

import CameraInput from "./components/CameraInput";
import CropperModal from "./components/CropperModal";
import ResultPanel from "./components/ResultPanel";
import Dashboard from "./components/Dashboard";
import UpgradeModal from "./components/UpgradeModal";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Upgrade from "./pages/Upgrade";

import { postAPI } from "./utils/apiClient";

import { doc, updateDoc, increment, serverTimestamp, getDoc } from "firebase/firestore";
import { auth, db, analytics, logEvent, setUserId } from "./lib/firebase";  // Updated imports
import { useAuth } from "./context/AuthContext";

function App() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();  // For SPA page tracking

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [file, setFile] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [resultText, setResultText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Link Firebase Analytics user ID when authenticated (for cross-device tracking)
  useEffect(() => {
    if (user?.uid) {
      setUserId(analytics, user.uid);
      logEvent(analytics, "login", { method: user.providerData?.[0]?.providerId || "unknown" });
    }
  }, [user]);

  // Track page views on route changes (SPA-friendly)
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
    setIsResultOpen(true);
    setIsProcessing(true);
    setResultText("");

    // Log snap attempt / photo processed
    logEvent(analytics, "photo_processed", {
      user_type: user ? "registered" : "guest",
      image_size: dataUrl.length,  // rough base64 size indicator
    });

    try {
      if (!(await checkSolveLimit())) return;

      console.log("Sending to API...");
      const res = await postAPI("/api/process", {
        imageBase64: dataUrl.split(",")[1],
      });
      console.log("API response:", res);
      setResultText(res.answer || res.text || JSON.stringify(res) || "No answer received");

      setIsProcessing(false);

      // Log successful solution
      logEvent(analytics, "solution_generated", {
        success: true,
        user_type: user ? "registered" : "guest",
        // Add problem_type if your API returns it, e.g. res.subject
      });

      await incrementSolveCount();
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
          uploadCount: increment(1),
          lastUpload: serverTimestamp(),
        });
        console.log("Upload count incremented");
      }
    } catch (err) {
      console.error("Process error:", err);
      setResultText("Failed to get solution – please try again");
      setIsProcessing(false);

      // Log failure
      logEvent(analytics, "solution_generated", {
        success: false,
        error_message: err.message?.substring(0, 100) || "unknown_error",
      });
    }
  };

  const checkSolveLimit = async () => {
    if (!user) {
      let guestSolves = parseInt(localStorage.getItem('guestSolves') || '0', 10);
      if (guestSolves >= 2) {
        logEvent(analytics, "guest_limit_hit", {
          solves_attempted: guestSolves + 1,
        });

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
                padding: '10px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.95rem',
              }}
            >
              Sign In Now
            </button>
          </div>,
          {
            position: "bottom-center",
            autoClose: 10000,
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
    const plan = data.subscription || 'free';
    const solves = data.solves || 0;

    const limits = { free: 15, pro: 75, premium: 150 };
    const currentLimit = limits[plan] || Infinity;

    if (solves >= currentLimit) {
      logEvent(analytics, "upgrade_modal_shown", {
        plan,
        solves_used: solves,
        limit: currentLimit,
        user_type: "registered",
      });

      if (plan === 'free' || plan === 'pro') {
        setShowUpgradeModal(true);
      } else {
        toast.info(
          "You've reached the maximum solves available. Contact support@snaprium.com for more options.",
          {
            position: "bottom-center",
            autoClose: 8000,
          }
        );
      }
      return false;
    }

    return true;
  };

  const incrementSolveCount = async () => {
    if (!user) {
      let guestSolves = parseInt(localStorage.getItem('guestSolves') || '0', 10);
      localStorage.setItem('guestSolves', guestSolves + 1);
    } else {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        solves: increment(1),
        lastSolve: serverTimestamp(),
      });
    }
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

    {/* Middle: Plan Badge – ONLY for Pro or Premium logged-in users */}
    {user && (user.subscription === 'pro' || user.subscription === 'premium') && (
      <div className="plan-badge">
        <span className={`badge ${user.subscription}`}>
          {user.subscription === 'pro' ? 'Pro' : 'Premium'}
        </span>
      </div>
    )}

    {/* Right: Menu button */}
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
                    // Optional: log start of upload flow
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
              </>
            }
          />

          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/upgrade" element={<Upgrade />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Limit-hit modal */}
      {showUpgradeModal && <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />}
    </div>
  );
}

export default App;