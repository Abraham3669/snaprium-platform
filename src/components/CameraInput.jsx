import { useRef, useState } from "react";
// import { postAPI } from "../utils/apiClient"; // ← not used here

export default function CameraInput({ onFileSelect, onOpenDashboard }) {
  const cameraInputRef = useRef();
  const galleryInputRef = useRef();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onFileSelect(file);
    e.target.value = ""; // reset
  };

  const handleCameraClick = () => {
    const input = cameraInputRef.current;
    if (input) {
      if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        input.setAttribute("capture", "environment");
      } else {
        input.removeAttribute("capture");
      }
      input.click();
    }
  };

  const handleGalleryClick = () => {
    const input = galleryInputRef.current;
    if (input) {
      input.removeAttribute("capture");
      input.click();
    }
  };

  return (
    <main>
      <div className="camera-container" style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px", // more height to accommodate bigger camera
        padding: "40px 20px",
      }}>
        
        {/* Really Big Camera Button – always visible, centered */}
        <div
          onClick={handleCameraClick}
          style={{
            cursor: "pointer",
            textAlign: "center",
            marginBottom: "40px", // generous space before gallery
            padding: "20px", // larger tap area
            borderRadius: "20px", // optional: soft rounded feel
            transition: "transform 0.15s ease",
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.95)"}
          onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
          onTouchStart={(e) => e.currentTarget.style.transform = "scale(0.95)"}
          onTouchEnd={(e) => e.currentTarget.style.transform = "scale(1)"}
        >
          <svg
            id="cameraBtn"
            className="camera-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            style={{
              width: "160px",    // ← really big now – try 180px or 200px if still too small
              height: "160px",
              color: "#0066ff",  // ← made it blue (change hex if you want different shade)
            }}
          >
            <path d="M20 5h-3.17l-1.84-2H8.99L7.17 5H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm-8 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
          </svg>
          <p style={{ 
            marginTop: "16px", 
            fontSize: "20px", 
            fontWeight: "600",
            color: "#333",
          }}>
            Take Photo
          </p>
        </div>

        {/* Small Gallery Button – only on mobile, below camera */}
        <div
          className="gallery-btn-mobile-only"
          onClick={handleGalleryClick}
          style={{
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          <svg
            id="galleryBtn"
            className="gallery-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            style={{
              width: "40px",
              height: "40px",
              color: "#555",
            }}
          >
            <path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4 2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/>
          </svg>
          <p style={{ 
            marginTop: "6px", 
            fontSize: "13px", 
            opacity: 0.8 
          }}>
            Gallery
          </p>
        </div>

      </div>



      {/* Hidden inputs */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        ref={cameraInputRef}
        onChange={handleFileChange}
      />

      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        ref={galleryInputRef}
        onChange={handleFileChange}
      />
    </main>
  );
}