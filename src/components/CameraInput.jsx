// src/components/CameraInput.jsx
import { useLayoutEffect, useRef, useState } from "react";

export default function CameraInput({ onFileSelect }) {
  const cameraInputRef = useRef();
  const galleryInputRef = useRef();
  const dropZoneRef = useRef();
  const [isDragging, setIsDragging] = useState(false);
  const titleRef = useRef(null);
  const lineRef = useRef(null);

  // One title for every device (iPhone app, phone browser, tablet, PC): the CSS sets the size,
  // then this measures the first line on the real screen and shrinks it only if it would not fit.
  useLayoutEffect(() => {
    const fit = () => {
      const h = titleRef.current;
      const line = lineRef.current;
      if (!h || !line) return;
      h.style.removeProperty("font-size");
      const cs = window.getComputedStyle(h);
      const avail = h.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
      if (avail <= 0) return;
      let size = parseFloat(cs.fontSize) || 24;
      for (let i = 0; i < 8; i += 1) {
        const w = line.getBoundingClientRect().width;
        if (w <= avail) break;
        size = Math.floor(size * (avail / w) * 0.98 * 10) / 10;
        h.style.setProperty("font-size", `${size}px`, "important");
      }
    };
    fit();
    const raf = requestAnimationFrame(fit);
    const t = setTimeout(fit, 300);
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    if (document.fonts?.ready) document.fonts.ready.then(fit).catch(() => {});
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, []);

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
      <section className="hero">
        <div className="container text-center">
          <h1 ref={titleRef} className="snap-title">
            <span className="snap-title-line">
              <span ref={lineRef} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                Understand Math &amp; Physics
              </span>
            </span>
            step by step
          </h1>

          <div className="camera-container container">
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
    </main>
  );
}