import React, { useState } from "react";
import CameraInput from "../components/CameraInput";
import CropperModal from "../components/CropperModal";
import ResultPanel from "../components/ResultPanel";
import Dashboard from "../components/Dashboard";

export default function Home() {
  const [file, setFile] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [result, setResult] = useState(null);

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

  const handleCropComplete = (croppedDataURL) => {
    setShowCropper(false);
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
          file={file}
          isOpen={showCropper}
          onClose={handleCropCancel}
          onCrop={handleCropComplete}
        />
      )}
      <ResultPanel result={result} onClose={handleCloseResult} />
    </div>
  );
}



return <h1 style={{ color: "red" }}>Home Loaded</h1>;