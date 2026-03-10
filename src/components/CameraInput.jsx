// src/components/CameraInput.jsx
import { useRef, useState } from "react";
import { Link } from "react-router-dom";




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
  <div className="container text-center">
    <h1 className="hero-title">
      Master Any Problem — <span className="hero-accent">Just Snap It.</span>
    </h1>
    <p className="hero-subtitle">
      Turn any problem into a solution with a single snap.
    </p>

    {/* Subject / Topic Badges */}
<div className="subject-badges flex justify-center flex-wrap gap-3 mt-4">
  <span className="badge">Math</span>
  <span className="badge">Physics</span>
  <span className="badge">Algebra</span>
  <span className="badge">Mechanics</span>
  <span className="badge">Calculus</span>
  <span className="badge">Electricity</span>
  <span className="badge badge-accent">+ More</span>
</div>
  </div>
</section>
    

    {/* Camera & Gallery Buttons */}
    <div className="camera-container container">
      <div onClick={handleCameraClick} className="camera-btn">
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

      <div className="gallery-btn" onClick={handleGalleryClick}>
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

    {/* Hidden inputs (UNCHANGED) */}
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

    {/* Why Section */}
    <section>
      <div className="container">
        <h2 className="section-heading">
         Build Confidence in Learning
        </h2>

        <div className="gallery-text">
          Snap your question and get <strong>step-by-step, exam-ready solutions</strong> instantly — no confusion, no messy answers.
        </div>
      </div>
    </section>

    {/* Demo animation (wrapped only) */}
    <div className="demo-animation container">
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

    {/* CTA Section */}
    <section>
      <div className="container">
        <h2 className="cta-heading">
          Study Smarter. Perform Better.
        </h2>

        <div className="post-animation-text">
    Level up your math and physics skills with Snaprium — <strong>study smarter, score higher</strong>.
        </div>
      </div>
    </section>

    <footer className="footer">
  <div className="footer-links">
    <Link to="/terms">Terms of Service</Link>
    <span className="footer-separator"> • </span>
    <Link to="/privacy">Privacy Policy</Link>
  </div>
  <p>© {new Date().getFullYear()} Snaprium. All rights reserved.</p>
</footer>

  </main>
);
}