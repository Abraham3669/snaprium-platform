// src/App.jsx
import { useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

import CameraInput from "./components/CameraInput";
import CropperModal from "./components/CropperModal";
import ResultPanel from "./components/ResultPanel";
import Dashboard from "./components/Dashboard";
import UpgradeModal from "./components/UpgradeModal"; // limit popup

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Upgrade from "./pages/Upgrade"; // full upgrade page

import { postAPI } from "./utils/apiClient";

import { doc, updateDoc, increment, serverTimestamp, getDoc } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { useAuth } from "./context/AuthContext";

function App() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [file, setFile] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [resultText, setResultText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false); // only for limit popup

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

    try {
  if (!(await checkSolveLimit())) return;

  console.log("Sending to API...");
  const res = await postAPI("/api/process", {
    imageBase64: dataUrl.split(",")[1],
  });
  console.log("API response:", res);
  setResultText(res.answer || res.text || JSON.stringify(res) || "No answer received");

  // Stop loading animation IMMEDIATELY after response
  setIsProcessing(false);  // ← moved here

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
  setIsProcessing(false);  // still here for error case
}
  };

  const checkSolveLimit = async () => {
    if (!user) {
      let guestSolves = parseInt(localStorage.getItem('guestSolves') || '0', 10);
      if (guestSolves >= 2) {
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
      // Modal only for free and pro
      if (plan === 'free' || plan === 'pro') {
        setShowUpgradeModal(true);
      } else {
        // Premium - just toast
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
          <div className="snaprium-brand">snaprium</div>
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
          <Route path="/upgrade" element={<Upgrade />} /> {/* full upgrade page */}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Limit-hit modal – only for free (15) and pro (75) */}
      {showUpgradeModal && <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />}
    </div>
  );
}

export default App;