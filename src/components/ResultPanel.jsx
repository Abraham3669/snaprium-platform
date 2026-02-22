// src/components/ResultPanel.jsx

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ResultPanel({ result, loading, onClose }) {

  const [feedback, setFeedback] = React.useState(null);

  const handleFeedback = (type) => {
    setFeedback(type);

    // Later you can send to backend here
    // fetch('/api/feedback', { method: 'POST', body: JSON.stringify({ type }) })
  };


  if (!result?.image) return null;

  return (
    <div className="result-panel">
      <div className="result-panel-header">
        <h2>Solution</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="result-panel-content">
        {/* Image Section */}
        <div className="image-wrapper">
          <img
            className="result-image"
            src={result.image}
            alt="Cropped preview"
          />
          {loading && (
            <div className="scan-overlay">
              <div className="scan-line"></div>
            </div>
          )}
        </div>

        {/* Solution Section */}
<div className="solution-area">
 <ReactMarkdown
  remarkPlugins={[remarkMath]}
  rehypePlugins={[rehypeKatex]}
>
  {prepareMathForKaTeX(result.text || '')}
</ReactMarkdown>


{!loading && result?.text && (
  <div className="feedback-bar">
    <button
      className={`feedback-btn ${feedback === 'up' ? 'active' : ''}`}
      onClick={() => handleFeedback('up')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M14 9V5a3 3 0 0 0-6 0v4H5v11h14V9h-5z"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      Helpful
    </button>

    <button
      className={`feedback-btn ${feedback === 'down' ? 'active' : ''}`}
      onClick={() => handleFeedback('down')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M10 15v4a3 3 0 0 0 6 0v-4h3V4H5v11h5z"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      Not Helpful
    </button>
  </div>
)}


</div>
      </div>
    </div>
  );
}

// Helper: Prepare text so KaTeX renders nicely
function prepareMathForKaTeX(rawText) {
  if (!rawText) return '';

  let text = rawText;

  // 1. Convert plain ASCII fractions 3/4 → \frac{3}{4}  (only when it looks safe)
  text = text.replace(
    /(\b\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?\b)(?!\s*\/)/g,
    '\\frac{$1}{$2}'
  );

  // 2. Convert ugly ASCII stacked fractions (common in some model outputs)
  text = text.replace(
    /(\d+)\s*\n\s*_{2,}\s*\n\s*(\d+)/g,
    '\\frac{$1}{$2}'
  );

  // 3. Fix common model mistakes: single $ delimiters that should be display
  //    We keep inline $…$ as inline, only force display when it makes sense
  //    But most math tutors output display math with $$ already — so we preserve them

  // Optional: If you *really* want ALL math blocks to be display math:
  // text = text.replace(/\$([^\$]+)\$/g, '$$$$$1$$$$');

  // But better: only upgrade when it contains \frac, \sqrt, sum, etc.
  text = text.replace(
    /\$([^$]*?(?:\\frac|\\sqrt|\\sum|\\int|\\lim)[^$]*?)\$/g,
    '$$$$$1$$$$'
  );

  // 4. Clean up extra spaces inside delimiters (helps KaTeX sometimes)
  text = text.replace(/\$\$[\s\n]+/g, '$$').replace(/[\s\n]+\$\$/g, '$$');

  // 5. Replace any stray \[ \] delimiters with $$ (some models use them)
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  return text;
}