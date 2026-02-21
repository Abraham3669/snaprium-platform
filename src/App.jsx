import { useState } from "react";
import CameraInput from "./components/CameraInput";
import CropperModal from "./components/CropperModal";
import ResultPanel from "./components/ResultPanel";
import Dashboard from "./components/Dashboard";

function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [cropData, setCropData] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  // Theme toggle
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  return (
    <div className="App">
      <Dashboard 
        isOpen={isDashboardOpen} 
        onClose={() => setIsDashboardOpen(false)} 
        toggleTheme={toggleTheme} 
        theme={theme}
      />

      <CameraInput
        onFileSelected={(file) => setCropData(file)}
        openCropper={() => setIsCropperOpen(true)}
        openDashboard={() => setIsDashboardOpen(true)}
      />

      <CropperModal
        file={cropData}
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
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
    </div>
  );
}

export default App;