// src/App.jsx
import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import CameraInput from "./components/CameraInput";
import CropperModal from "./components/CropperModal";
import ResultPanel from "./components/ResultPanel";
import Dashboard from "./components/Dashboard";

import Login from "./pages/Login";
import Signup from "./pages/Signup";

import { postAPI } from "./utils/apiClient";

// Firestore & auth imports for upload count increment
import { doc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./lib/firebase";  // ← FIXED: added db here

import ForgotPassword from "./pages/ForgotPassword";



function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [file, setFile] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [resultText, setResultText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

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
    setResultText(""); // reset previous result

    try {
      console.log("Sending to API...");
      const res = await postAPI("/api/process", {
        imageBase64: dataUrl.split(",")[1],
      });
      console.log("API response:", res);
      setResultText(res.answer || res.text || JSON.stringify(res) || "No answer received");

      // NEW: Increment upload count in Firestore after successful process
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
          uploadCount: increment(1),
          lastUpload: serverTimestamp(),
        });
        console.log("Upload count incremented for user:", currentUser.uid);
      }
    } catch (err) {
      console.error("Process error:", err);
      setResultText("Failed to get solution – please try again");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="App min-h-screen">
      {/* Fixed header – always visible */}
      <header className="snaprium-header">
        <div className="snaprium-header-inner">
          {/* Brand */}
          <div className="snaprium-brand">snaprium</div>

          {/* Dashboard Button */}
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

      {/* Main content with routes */}
      <main className="pt-16">
        <Dashboard
          isOpen={isDashboardOpen}
          onClose={() => setIsDashboardOpen(false)}
          toggleTheme={toggleTheme}
          theme={theme}
        />

        <Routes>
          {/* Home route: camera + result flow */}
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
                    onClose={() => {
                      setIsResultOpen(false);
                      // Optional: uncomment if you want to clear old data when closing
                      // setCroppedImage(null);
                      // setResultText("");
                    }}
                  />
                )}
              </>
            }
          />

          {/* Login & Signup pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />  {/* ← add this */}

          {/* Catch-all: redirect unknown paths to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;