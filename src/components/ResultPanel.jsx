// src/components/ResultPanel.jsx

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ResultPanel({ result, loading, onClose, onNewSnap }) {  // ← new prop for callback
  const [feedback, setFeedback] = React.useState(null);

  const handleFeedback = (type) => {
    setFeedback(type);
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
        <div 
          className="image-wrapper"
          key={loading ? 'loading' : 'loaded'}
        >
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

        {/* Small Camera + Gallery Buttons – horizontal, centered, at bottom */}
<div className="result-snap-box">
  <div className="snap-btn camera" onClick={() => onNewSnap('camera')}>
    <svg className="snap-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 5h-3.17l-1.84-2H8.99L7.17 5H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm-8 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
    </svg>
  </div>

  <div className="snap-btn gallery" onClick={() => onNewSnap('gallery')}>
    <svg className="snap-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4 2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/>
    </svg>
  </div>
</div>
      </div>
    </div>
  );
}

// Helper unchanged
function prepareMathForKaTeX(rawText) {
  if (!rawText) return '';

  let text = rawText;

  text = text.replace(
    /(\b\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?\b)(?!\s*\/)/g,
    '\\frac{$1}{$2}'
  );

  text = text.replace(
    /(\d+)\s*\n\s*_{2,}\s*\n\s*(\d+)/g,
    '\\frac{$1}{$2}'
  );

  text = text.replace(
    /\$([^$]*?(?:\\frac|\\sqrt|\\sum|\\int|\\lim)[^$]*?)\$/g,
    '$$$$$1$$$$'
  );

  text = text.replace(/\$\$[\s\n]+/g, '$$').replace(/[\s\n]+\$\$/g, '$$');

  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  return text;
}