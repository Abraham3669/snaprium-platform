import { useRef, useState } from "react";

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


<section className="hero">
  <h1 className="hero-title">
    Master Any Problem —
    <span className="hero-accent"> Just Snap It.</span>
  </h1>

  <p className="hero-subtitle">
     Turn any problem into a solution with a single snap.
  </p>
</section>




      <div
        className="camera-container"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          minHeight: "320px",           // reduced
        padding: "0px 20px 20px",         // reduced padding
          gap: "12px",                  // ← this controls the vertical distance
        }}
      >
        {/* Main camera button – size unchanged */}
        <div
          onClick={handleCameraClick}
          style={{
            cursor: "pointer",
            padding: "20px",
            borderRadius: "20px",
            transition: "transform 0.15s ease",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onTouchStart={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
          onTouchEnd={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <svg
            id="cameraBtn"
            className="camera-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            style={{
             width: "180px",
height: "180px",
              color: "var(--accent)",
            }}
          >
            <path d="M20 5h-3.17l-1.84-2H8.99L7.17 5H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm-8 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
          </svg>
        </div>

        {/* Gallery – much smaller, no label, very close to camera */}
        <div
          className="gallery-btn-mobile-only"
          onClick={handleGalleryClick}
          style={{
            cursor: "pointer",
            padding: "8px",
            borderRadius: "12px",
            transition: "transform 0.15s ease",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onTouchStart={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
          onTouchEnd={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <svg
            id="galleryBtn"
            className="gallery-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            style={{
              width: "24px",          // ← made significantly smaller
              height: "24px",
              color: "#555",
            }}
          >
            <path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4 2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/>
          </svg>
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



<div className="demo-animation">
  <div className="phone">
    <div className="screen">
      <div className="question-card">
        <p className="question">
          ∫ (2x³ - 5x² + 4) dx = ?
        </p>
        <div className="scan-line"></div> 
      </div>
    </div>
  </div>
</div>




    </main>
  );
}