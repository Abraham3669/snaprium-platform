import { useState } from "react";
import CameraInput from "./components/CameraInput";
import CropperModal from "./components/CropperModal";
import ResultPanel from "./components/ResultPanel";
import Dashboard from "./components/Dashboard";

function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [file, setFile] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
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

      {/* Main content – pushed down so it's not hidden under fixed header */}
      <main className="pt-16">






        

        <Dashboard
          isOpen={isDashboardOpen}
          onClose={() => setIsDashboardOpen(false)}
          toggleTheme={toggleTheme}
          theme={theme}
        />

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
          onCrop={(dataUrl) => {
            setCroppedImage(dataUrl);
            setIsResultOpen(true);
          }}
        />

        <ResultPanel
          isOpen={isResultOpen}
          image={croppedImage}
          onClose={() => setIsResultOpen(false)}
        />

      </main>

    </div>
  );
}

export default App;