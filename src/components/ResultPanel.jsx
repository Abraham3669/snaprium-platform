// src/components/ResultPanel.jsx

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
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
>
  {sanitizeLatex(formatMath(result.text || 'No solution available yet.'))}
</ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------
   Helper: Format LaTeX (brackets, fractions, ASCII)
------------------------------------------- */
function formatMath(text) {
  if (!text) return '';

  // Convert 3/4 → \frac{3}{4}
  text = text.replace(/(\b\d+)\s*\/\s*(\d+\b)/g, '\\\\frac{$1}{$2}');

  // Convert [ ... ] or ( ... ) → $$ ... $$
  text = text.replace(/[\[\(]\s*([\s\S]*?)\s*[\]\)]/g, (_, mathContent) => {
    const singleLine = mathContent.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    return `$$${singleLine}$$`;
  });

  // Convert ASCII-style fractions
  text = text.replace(/(\d+)\s*\n\s*_{2,}\s*\n\s*(\d+)/g, '\\\\frac{$1}{$2}');

  return text;
}

/* ------------------------------------------
   Helper: Sanitize LaTeX for KaTeX rendering
------------------------------------------- */
function sanitizeLatex(text) {
  if (!text) return '';

  // Remove extra spaces inside display math $$ ... $$
  text = text.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, '$$$1$$');

  // Normalize spaces for inline math $ ... $
  text = text.replace(/\$\s*([^\$]+?)\s*\$/g, '$$$1$');

  return text;
}