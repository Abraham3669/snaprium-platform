import { useRef } from "react";

export default function CameraInput({ onFileSelected, openCropper, openDashboard }) {
  const fileInputRef = useRef();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileSelected(file);
      openCropper();
      e.target.value = "";
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