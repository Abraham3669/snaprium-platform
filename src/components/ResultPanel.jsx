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

  // 1. Convert plain ASCII fractions
  text = text.replace(
    /(\b\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?\b)(?!\s*\/)/g,
    '\\frac{$1}{$2}'
  );

  // 2. Convert stacked ASCII fractions
  text = text.replace(
    /(\d+)\s*\n\s*_{2,}\s*\n\s*(\d+)/g,
    '\\frac{$1}{$2}'
  );

  // 3. Upgrade inline complex math to display $$
  text = text.replace(
    /\$([^$]*?(?:\\frac|\\sqrt|\\sum|\\int|\\lim)[^$]*?)\$/g,
    '$$$$$1$$$$'
  );

  // 4. Clean extra spaces inside delimiters
  text = text.replace(/\$\$[\s\n]+/g, '$$').replace(/[\s\n]+\$\$/g, '$$');

  // 5. Replace \[ \] with $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  // FIX A: Convert ( math ) to $math$ – safe match for math-like content
  text = text.replace(
    /\(\s*([^)]*?(?:=|\^|_|\\frac|\\sqrt|\\int|\\sum|\\lim|\\sin|\\cos|\\tan|\\sec|\\csc|\\cot|\\sinh|\\cosh|\\tanh|\\log|\\ln|\\exp|\\theta|\\phi|\\pi|\\infty|\\approx|\\neq|\\leq|\\geq|\\mathrm{d}|\\mathrm{d}x|\\partial)[^)]*?)\s*\)/g,
    (match, inner) => `$${inner.trim()}$`
  );

  // FIX B: Fix broken/mixed delimiters like $\frac{...}$$ or $...$$
  text = text.replace(/\$([^$]*?)\$\$/g, '$$$$$1$$$$');
  text = text.replace(/\$\$([^$]*?)\$/g, '$$$$$1$$$$');
  text = text.replace(/\$([^$]*?)\$/g, '$$$$$1$$$$'); // force display for safety

  // FIX C: Remove duplicates like u=tanθu=tanθ
  text = text.replace(/([a-zA-Z0-9=\\]+)(?=\1)/g, '$1');

  // FIX D: Clean trailing junk
  text = text.replace(/\$\$?\s*\$f'\(x\)\$\$?\.?/gi, '');
  text = text.replace(/\$\$?\s*\$\s*\$/g, '');
  text = text.replace(/\s*\.\s*$/, '');
  text = text.replace(/\s{2,}/g, ' ');
  text = text.trim();

  return text;
}