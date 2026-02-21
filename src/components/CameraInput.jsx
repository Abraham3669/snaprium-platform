import { useRef, useState } from "react";
import { postAPI } from "../utils/apiClient"; // make sure you have this helper

export default function CameraInput({ onFileSelect, onOpenDashboard }) {
  const fileInputRef = useRef();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      // Convert file to Base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(",")[1]; // remove prefix
        // Send to backend process endpoint
        const res = await postAPI("/api/process", { imageBase64: base64 });
        // Return solution to parent
        onFileSelect(res.solution);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setError("Failed to process image. Try again.");
    } finally {
      setLoading(false);
      e.target.value = ""; // reset input
    }
  };

  const handleCameraClick = () => {
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      fileInputRef.current.setAttribute("capture", "environment");
    } else {
      fileInputRef.current.removeAttribute("capture");
    }
    fileInputRef.current.click();
  };

  return (
    <main>
      <div className="camera-container">
        <svg
          id="cameraBtn"
          className="camera-icon"
          onClick={handleCameraClick}
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M20 5h-3.17l-1.84-2H8.99L7.17 5H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm-8 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
        </svg>
        {loading && <p className="loading-text">Processing...</p>}
        {error && <p className="error-text">{error}</p>}
      </div>
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />
    </main>
  );
}