import React, { useState } from "react";
import CameraInput from "../components/CameraInput";
import CropperModal from "../components/CropperModal";
import ResultPanel from "../components/ResultPanel";
import Dashboard from "../components/Dashboard";

import { postAPI } from "../utils/apiClient";

export default function Home() {
  const [file, setFile] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false); // ✅ loading for API

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [isDashboardOpen, setDashboardOpen] = useState(false);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setShowCropper(true);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setFile(null);
  };

  const handleCloseResult = () => setResult(null);

  // ✅ Must be inside component
  const handleCropComplete = async (croppedDataURL) => {
    setShowCropper(false);
    setResult({ image: croppedDataURL, text: "" });
    setLoading(true);

    try {
      console.log("Sending image to API...");
      const res = await postAPI("/api/process", {
        imageBase64: croppedDataURL.split(",")[1],
      });
      console.log("API response:", res);
      setResult({ image: croppedDataURL, text: res.answer });
    } catch (err) {
      console.error(err);
      setResult({ image: croppedDataURL, text: "Failed to process image" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Dashboard
        isOpen={isDashboardOpen}
        onClose={() => setDashboardOpen(false)}
        toggleTheme={toggleTheme}
        theme={theme}
      />
      <CameraInput
        onFileSelect={handleFileSelect}
        onOpenDashboard={() => setDashboardOpen(true)}
      />
      {showCropper && (
        <CropperModal
          file={file}
          isOpen={showCropper}
          onClose={handleCropCancel}
          onCrop={handleCropComplete}
        />
      )}
      <ResultPanel result={result} loading={loading} onClose={handleCloseResult} />
    </div>
  );
}