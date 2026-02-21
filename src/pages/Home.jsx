import React, { useState, useEffect } from "react";
import CameraInput from "../components/CameraInput";
import CropperModal from "../components/CropperModal";
import ResultPanel from "../components/ResultPanel";
import Dashboard from "../components/Dashboard";

export default function Home() {
  const [file, setFile] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [result, setResult] = useState(null);

  // Theme
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  // Dashboard
  const [isDashboardOpen, setDashboardOpen] = useState(false);

  const handleFileSelect = (selectedFile) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setShowCropper(true);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImageSrc(null);
  };

  const handleCropComplete = (croppedDataURL) => {
    setShowCropper(false);
    setImageSrc(croppedDataURL);
    setResult({ image: croppedDataURL, text: "Cropped result placeholder" });
  };

  const handleCloseResult = () => setResult(null);

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
          src={imageSrc}
          onCancel={handleCropCancel}
          onCrop={handleCropComplete}
        />
      )}
      <ResultPanel result={result} onClose={handleCloseResult} />
    </div>
  );
}