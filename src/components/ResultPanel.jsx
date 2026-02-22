// src/components/ResultPanel.jsx

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

export default function ResultPanel({ result, loading, onClose }) {
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
          {loading ? (
            <p className="processing-text">Analyzing...</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
              rehypeRaw={true}
            >
              {formatMath(result.text || 'No solution available yet.')}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------
   Auto-format helper (IMPORTANT)
   Converts bad fractions like 3/4 → \frac{3}{4}
------------------------------------------- */
function formatMath(text) {
  if (!text) return '';

  // Convert simple fractions like 3/4 into \frac{3}{4}
  const fractionRegex = /(\b\d+)\s*\/\s*(\d+\b)/g;
  text = text.replace(fractionRegex, '\\\\frac{$1}{$2}');

  return text;
}