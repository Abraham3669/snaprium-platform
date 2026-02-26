// src/components/CameraInput.jsx
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
    <main className="camera-main">
      {/* Hero Section */}
      <section className="hero">
        <h1 className="hero-title">
          Master Any Problem —
          <span className="hero-accent"> Just Snap It.</span>
        </h1>

        <p className="hero-subtitle">
          Turn any problem into a solution with a single snap.
        </p>
      </section>

      {/* Camera & Gallery Buttons */}
      <div className="camera-container">
        {/* Main camera button */}
        <div
          onClick={handleCameraClick}
          className="camera-btn"
        >
          <svg
            id="cameraBtn"
            className="camera-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M20 5h-3.17l-1.84-2H8.99L7.17 5H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm-8 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
          </svg>
        </div>

        {/* Gallery button */}
        <div
          className="gallery-btn"
          onClick={handleGalleryClick}
        >
          <svg
            id="galleryBtn"
            className="gallery-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
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


     <h2 className="section-heading">
  Why Students Love Snaprium
</h2>



      {/* Gallery text */}
      <div className="gallery-text">
        Snap your question and get <strong>step-by-step, exam-ready solutions</strong> instantly — no confusion, no messy answers.
      </div>

      {/* Demo animation */}
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

  <h2 className="cta-heading">
  Study Smarter. Perform Better.
</h2>




      {/* Post-animation text */}
      <div className="post-animation-text">
        Join thousands of students mastering math, physics, and chemistry with Snaprium — <strong>study smarter, not harder</strong>.
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-links">
          <a href="/terms">Terms of Service</a>
          <a href="/privacy">Privacy Policy</a>
        </div>
        <p>© {new Date().getFullYear()} Snaprium. All rights reserved.</p>
      </footer>
    </main>
  );
}