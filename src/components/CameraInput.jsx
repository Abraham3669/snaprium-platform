// src/components/CameraInput.jsx
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import bannerImage from "../assets/banner.png";



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
  <span className="no-break">Solve Math & Physics</span> Instantly
</h1>
   

  

    

    {/* Camera & Gallery Buttons */}
<div className="camera-container container">

  {/* Camera - Mobile Only */}
  <div className="action-item mobile-camera">
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
    <span className="action-label">Take Photo</span>
  </div>

  {/* Gallery Upload */}
  <div className="action-item">
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
    <span className="action-label">Upload Image</span>
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










{/* What Snaprium Solves */}
<section className="subjects-section">
  <div className="container">
    <h2 className="section-heading">
      Snaprium solves <span className="hero-accent">Math (∫ √ π)</span> and
      <span className="hero-accent"> Physics (F=ma, E=mc²)</span>
    </h2>

    <p className="gallery-text">
  From algebra and calculus to mechanics and electricity and more — Snaprium breaks every problem into clear, step-by-step solutions.
</p>
  </div>
</section>




{/* Step-by-Step Solution Animation */}
<section className="solution-demo">
  <div className="solution-card">

  {/* Question preview area */}
  <div className="solution-question-card">
    <div className="solution-question-preview">
      {/* Can be an image or just a highlighted box */}
      <p className="solution-question">
        A particle has velocity v(t) = 3t² − 4t + 1. Find its displacement function s(t).
      </p>
    </div>
  </div>

  {/* Step-by-step solution */}
  <div className="solution-steps">

    <div className="solution-step">
      <div className="step-title">Use the relation between velocity and displacement</div>
      <div className="step-math">
        v(t) =
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


{/* Banner Section */}
<section className="banner-section">
   <div className="dual-banner">
      {/* Primary Banner */}
      <div className="banner-card primary">
        <h1 className="banner-title">Solve Math & Physics Instantly.</h1>
        <p className="banner-subtext">Built for learners everywhere.</p>
        <ul className="banner-list">
          <li>
            <svg className="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
              <path d="M20.285 6.709a1 1 0 0 0-1.414-1.418l-9.192 9.192-4.243-4.243a1 1 0 0 0-1.414 1.414l5 5a1 1 0 0 0 1.414 0l9.849-9.849z" />
            </svg>
            <span>Take a photo to solve instantly</span>
          </li>
          <li>
            <svg className="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
              <path d="M20.285 6.709a1 1 0 0 0-1.414-1.418l-9.192 9.192-4.243-4.243a1 1 0 0 0-1.414 1.414l5 5a1 1 0 0 0 1.414 0l9.849-9.849z" />
            </svg>
            <span>Step-by-step explanations</span>
          </li>
          <li>
            <svg className="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
              <path d="M20.285 6.709a1 1 0 0 0-1.414-1.418l-9.192 9.192-4.243-4.243a1 1 0 0 0-1.414 1.414l5 5a1 1 0 0 0 1.414 0l9.849-9.849z" />
            </svg>
            <span>High school and university problems solved</span>
          </li>
        </ul>
      </div>

      {/* Secondary Banner */}
      <div className="banner-card secondary">
        <h1 className="banner-title">Learn Smarter, Perform Better.</h1>
        <p className="banner-subtext">Confidence through clear solutions.</p>
        <ul className="banner-list">
          <li>
            <svg className="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
              <path d="M20.285 6.709a1 1 0 0 0-1.414-1.418l-9.192 9.192-4.243-4.243a1 1 0 0 0-1.414 1.414l5 5a1 1 0 0 0 1.414 0l9.849-9.849z" />
            </svg>
            <span>Step-by-step exam prep</span>
          </li>
          <li>
            <svg className="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
              <path d="M20.285 6.709a1 1 0 0 0-1.414-1.418l-9.192 9.192-4.243-4.243a1 1 0 0 0-1.414 1.414l5 5a1 1 0 0 0 1.414 0l9.849-9.849z" />
            </svg>
            <span>Personalized learning dashboard</span>
          </li>
          <li>
            <svg className="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
              <path d="M20.285 6.709a1 1 0 0 0-1.414-1.418l-9.192 9.192-4.243-4.243a1 1 0 0 0-1.414 1.414l5 5a1 1 0 0 0 1.414 0l9.849-9.849z" />
            </svg>
            <span>Trusted by learners worldwide</span>
          </li>
        </ul>
      </div>
    </div>
</section>





<section>
  
</section>


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
  <span className="footer-separator"> • </span>

  <Link to="/refunds">Refund Policy</Link>
  <span className="footer-separator"> • </span>

  <Link to="/upgrade">Pricing</Link>
</div>
  <p>© {new Date().getFullYear()} Snaprium. All rights reserved.</p>
</footer>

  </main>
);
}