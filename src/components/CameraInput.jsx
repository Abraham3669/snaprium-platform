// src/components/CameraInput.jsx
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

export default function CameraInput({ onFileSelect }) {
  const cameraInputRef = useRef();
  const galleryInputRef = useRef();
  const dropZoneRef = useRef();
  const [isDragging, setIsDragging] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onFileSelect(file);
    e.target.value = "";
  };

  const handleCameraClick = () => {
    const input = cameraInputRef.current;
    if (!input) return;
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      input.setAttribute("capture", "environment");
    } else {
      input.removeAttribute("capture");
    }
    input.click();
  };

  const handleGalleryClick = () => {
    const input = galleryInputRef.current;
    if (!input) return;
    input.removeAttribute("capture");
    input.click();
  };

  // ─── Drag & Drop handlers (desktop) ───
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZoneRef.current?.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onFileSelect(file);
    }
  };

  return (
    <main className="camera-main">
      {/* ─── Always visible (app + browser) ─── */}
      <section className="hero">
        {/*
<div className="hero-symbols" aria-hidden="true">
  <span>π</span>
  <span>∫</span>
  <span>Δ</span>
  <span>√</span>
  <span>τ</span>
  <span>Ω</span>
  <span>Σ</span>
  <span>λ</span>
</div>
*/}

        <div className="container text-center">
          <h1
            className={`hero-title${!isNative ? " hero-title-web" : ""}`}
            style={
              !isNative
                ? {
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    textAlign: "center",
                    paddingLeft: 16,
                    paddingRight: 16,
                  }
                : undefined
            }
          >
            <span className="no-break">Understand Math & Physics </span>
            step by step
          </h1>

          <div className="camera-container container">
            {/* Camera */}
            <div className="action-item mobile-camera">
              <div onClick={handleCameraClick} className="camera-btn">
                <svg
                  className="camera-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 5h-3.17l-1.84-2H8.99L7.17 5H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm-8 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
                </svg>
              </div>
              <span className="action-label">Take Photo</span>
            </div>

            {/* Gallery – mobile only */}
            {/* Gallery – mobile only (modern card) */}
<div className="action-item mobile-gallery">
  <div className="gallery-card" onClick={handleGalleryClick}>
    <div className="gallery-card-icon">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
        />
      </svg>
    </div>
    <div className="gallery-card-text">
      <span className="gallery-card-title">Upload Image</span>
      <span className="gallery-card-sub">From gallery</span>
    </div>
  </div>
</div>

            {/* Desktop Drop Zone */}
            <div
              ref={dropZoneRef}
              className={`desktop-dropzone ${isDragging ? "dragging" : ""}`}
              onClick={handleGalleryClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="dropzone-content">
                <svg
                  className="dropzone-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <div className="dropzone-text">
                  <span className="dropzone-main">
                    {isDragging ? "Drop image here" : "Drag & drop an image"}
                  </span>
                  <span className="dropzone-sub">or click to upload</span>
                </div>
              </div>
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

          {/* Desktop */}
          <div className="subject-badges subject-badges-desktop">
            <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.95rem", fontWeight: 600, padding: "10px 16px" }}>
              <span style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1, color: "var(--accent)" }}>π</span>
              Math
            </span>
            <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.95rem", fontWeight: 600, padding: "10px 16px" }}>
              <span style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1, color: "var(--accent)" }}>Δ</span>
              Physics
            </span>
            <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.95rem", fontWeight: 600, padding: "10px 16px" }}>
              <span style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1, color: "var(--accent)" }}>√</span>
              Algebra
            </span>
            <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.95rem", fontWeight: 600, padding: "10px 16px" }}>
              <span style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1, color: "var(--accent)" }}>τ</span>
              Mechanics
            </span>
            <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.95rem", fontWeight: 600, padding: "10px 16px" }}>
              <span style={{ fontSize: "1.85rem", fontWeight: 700, lineHeight: 1, color: "var(--accent)" }}>∫</span>
              Calculus
            </span>
            <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.95rem", fontWeight: 600, padding: "10px 16px" }}>
              <span style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1, color: "var(--accent)" }}>Ω</span>
              Electricity
            </span>
            <span className="badge badge-accent" style={{ display: "inline-flex", alignItems: "center", fontSize: "0.95rem", fontWeight: 600, padding: "10px 16px" }}>
              + More
            </span>
          </div>

          {/* Phone + phone browser */}
          <div className="subject-badges subject-badges-mobile">
            {[
              ["π", "Math"],
              ["Δ", "Physics"],
              ["√", "Algebra"],
              ["τ", "Mechanics"],
              ["∫", "Calculus"],
              ["Ω", "Electricity"],
            ].map(([symbol, label]) => (
              <span
                key={label}
                className="badge"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  padding: "6px 10px",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>
                  {symbol}
                </span>
                {label}
              </span>
            ))}
            <span className="badge badge-accent" style={{ display: "inline-flex", alignItems: "center", fontSize: "0.8rem", fontWeight: 600, padding: "6px 10px", whiteSpace: "nowrap" }}>
              + More
            </span>
          </div>
        </div>
      </section>

      {/* ─── Browser only (marketing website look) ─── */}
      {!isNative && (
        <>
          <section>
            <div className="container">
              <h2 className="section-heading">Build Confidence in Learning</h2>
              <div className="gallery-text">
                Snap your question and get{" "}
                <strong>step-by-step, exam-ready solutions</strong> instantly —
                no confusion, no messy answers.
              </div>
            </div>
          </section>

          <div className="demo-animation container">
            <div className="phone">
              <div className="screen">
                <div className="question-card">
                  <p className="question">∫ (2x³ - 5x² + 4) dx = ?</p>
                  <div className="scan-line"></div>
                </div>
              </div>
            </div>
          </div>

          <section className="subjects-section">
            <div className="container">
              <h2 className="section-heading">
                Snaprium solves <span className="hero-accent">Math (∫ √ π)</span>{" "}
                and <span className="hero-accent">Physics (F=ma, E=mc²)</span>
              </h2>
              <p className="gallery-text">
                From algebra and calculus to mechanics and electricity and more —
                Snaprium breaks every problem into clear, step-by-step solutions.
              </p>
            </div>
          </section>

          <section className="solution-demo">
            <div className="solution-card">
              <div className="solution-question-card">
                <div className="solution-question-preview">
                  <p className="solution-question">
                    A particle has velocity v(t) = 3t² − 4t + 1. Find its
                    displacement function s(t).
                  </p>
                </div>
              </div>
              <div className="solution-steps">
                <div className="solution-step">
                  <div className="step-title">
                    Use the relation between velocity and displacement
                  </div>
                  <div className="step-math">
                    v(t) ={" "}
                    <span className="frac">
                      <span className="top">ds</span>
                      <span className="bottom">dt</span>
                    </span>
                  </div>
                </div>
                <div className="solution-step">
                  <div className="step-title">Integrate the velocity function</div>
                  <div className="step-math">s(t) = ∫ (3t² − 4t + 1) dt</div>
                </div>
                <div className="solution-final">
                  <div className="step-title">Final Answer</div>
                  <div className="step-math">s(t) = t³ − 2t² + t + C</div>
                </div>
              </div>
            </div>
          </section>

          <section className="banner-section">
            <div className="dual-banner">
              <div className="banner-card primary">
                <h1 className="banner-title">Solve Math & Physics Instantly.</h1>
                <p className="banner-subtext">Built for learners everywhere.</p>
                <ul className="banner-list">
                  <li>
                    <span>Take a photo to solve instantly</span>
                  </li>
                  <li>
                    <span>Step-by-step Math & Physics solutions</span>
                  </li>
                  <li>
                    <span>High school and university problems solved</span>
                  </li>
                </ul>
              </div>
              <div className="banner-card secondary">
                <h1 className="banner-title">Learn Smarter, Perform Better.</h1>
                <p className="banner-subtext">Confidence through clear solutions.</p>
                <ul className="banner-list">
                  <li>
                    <span>Clear explanations for every solution</span>
                  </li>
                  <li>
                    <span>Solve problems with confidence</span>
                  </li>
                  <li>
                    <span>Designed for effective learning</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <div className="container">
              <h2 className="cta-heading">Study Smarter. Perform Better.</h2>
              <div className="post-animation-text">
                Level up your math and physics skills with Snaprium —{" "}
                <strong>study smarter, score higher</strong>.
              </div>
            </div>
          </section>

          <footer className="footer">
            <div className="footer-links">
              <Link to="/terms">Terms of Service</Link>
              <span className="footer-separator"> • </span>
              <Link to="/privacy">Privacy Policy</Link>
              <span className="footer-separator"> • </span>
              <Link to="/refunds">Refund Policy</Link>
              <span className="footer-separator"> • </span>
              <Link to="/upgrade">Pricing</Link>
            </div>
            <p>© {new Date().getFullYear()} Snaprium. All rights reserved.</p>
          </footer>
        </>
      )}
    </main>
  );
}