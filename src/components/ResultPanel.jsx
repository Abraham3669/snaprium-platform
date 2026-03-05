// src/components/ResultPanel.jsx

import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ResultPanel({ result, loading, onClose }) {
  const [showSteps, setShowSteps] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Ref to measure the real height of the content for smooth animation
  const stepsRef = useRef(null);

  const handleFeedback = (type) => {
    setFeedback(type);
    // Later: send to backend
    // fetch('/api/feedback', { method: 'POST', body: JSON.stringify({ type }) })
  };

  if (!result?.image) return null;

  // Improved extraction: more robust for common solver outputs
  const extractFinalAnswer = (text) => {
    if (!text) return 'See steps below';

    // Clean text: remove extra newlines/spaces
    const cleaned = text.trim().replace(/\n+/g, '\n');

    // Priority 1: Look for \boxed{} (common in math solvers)
    const boxedMatch = cleaned.match(/\\boxed\{([^}]*)\}/);
    if (boxedMatch) return `$$${boxedMatch[1]}$$`;

    // Priority 2: "Final answer:" or similar keyword + following content
    const finalKeywordMatch = cleaned.match(/(?:final answer|answer|result|solution|therefore|thus|so)(?::|\s*=\s*)?([\s\S]*)$/i);
    if (finalKeywordMatch) {
      const answerPart = finalKeywordMatch[1].trim();
      // If it's math, wrap in $$
      return answerPart.match(/[\d=+-/*^()]/) ? `$$${answerPart}$$` : answerPart;
    }

    // Priority 3: Last display math $$...$$
    const displayMathMatches = [...cleaned.matchAll(/\$\$([\s\S]*?)\$\$/g)];
    if (displayMathMatches.length > 0) {
      return `$$${displayMathMatches[displayMathMatches.length - 1][1].trim()}$$`;
    }

    // Priority 4: Last line that looks like an equation (has = or simplified expr)
    const lines = cleaned.split('\n').filter(l => l.trim());
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.includes('=') || line.match(/^[\d\w\s+-/*^()=]+$/)) {
        return line.match(/[\d=+-/*^()]/) ? `$$${line}$$` : line;
      }
    }

    // Fallback: last non-empty line
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1].trim();
      return lastLine.match(/[\d=+-/*^()]/) ? `$$${lastLine}$$` : lastLine;
    }

    return 'See steps below';
  };

  const finalAnswer = extractFinalAnswer(result.text || '');

  return (
    <div className="result-panel">
      <div className="result-panel-header">
        <h2>Solution</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="result-panel-content">
        {/* Image preview – unchanged */}
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

        {/* Solution area */}
        <div className="solution-area prose prose-lg dark:prose-invert max-w-none">
          {!loading && result?.text && (
            <>
              {/* Big Final Answer – visible immediately */}
              <div 
                className="final-answer mb-6 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)] text-center transition-[var(--transition)]"
                style={{ background: 'linear-gradient(135deg, var(--accent-glow), transparent)' }}
              >
                <h3 className="text-xl font-semibold text-[var(--text-secondary)] mb-3">
                  Final Answer
                </h3>
                <div className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] tracking-tight">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {finalAnswer}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Toggle Steps Button */}
              <button
                onClick={() => setShowSteps(!showSteps)}
                className={`
                  w-full py-3.5 px-5 mb-5 bg-[var(--accent)] hover:bg-[var(--accent-dark)] 
                  text-white font-medium rounded-lg shadow-md transition-all flex items-center justify-center gap-2
                `}
              >
                {showSteps ? 'Hide Step-by-Step' : 'Show Step-by-Step'}
                <span className="text-xl transition-transform duration-300">
                  {showSteps ? '▲' : '▼'}
                </span>
              </button>

              {/* Expandable Steps – now using dynamic height */}
              <div
                ref={stepsRef}
                className="overflow-hidden transition-all duration-500 ease-in-out"
                style={{
                  maxHeight: showSteps
                    ? `${stepsRef.current?.scrollHeight || 2000}px`
                    : '0px',
                  opacity: showSteps ? 1 : 0,
                }}
              >
                <div className="pt-1 pb-6 px-1">
                  <h4 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    Solving Steps
                  </h4>
                  
                  <div className="prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)]">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {prepareMathForKaTeX(result.text || '')}
                    </ReactMarkdown>
                  </div>

                  {/* Repeated final answer at bottom */}
                  <div 
                    className="mt-10 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-center"
                  >
                    <h5 className="text-lg font-medium text-[var(--text-secondary)] mb-2">
                      Final Result
                    </h5>
                    <div className="text-3xl font-bold text-[var(--text-primary)]">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {finalAnswer}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feedback – always visible */}
              <div className="feedback-bar mt-6">
                <button
                  className={`feedback-btn ${feedback === 'up' ? 'active' : ''}`}
                  onClick={() => handleFeedback('up')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path 
                      d="M14 9V5a3 3 0 0 0-6 0v4H5v11h14V9h-5z"
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
                    <path 
                      d="M10 15v4a3 3 0 0 0 6 0v-4h3V4H5v11h5z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                  Not Helpful
                </button>
              </div>
            </>
          )}

          {loading && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Solving your problem...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Your existing prepareMathForKaTeX helper – unchanged
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

  // Upgrade inline math → display math for explanatory sentences
  text = text.replace(
    /\$([^$]*?(?:derivative|rule|product rule|quotient|chain|integral|limit|sum|equals|therefore)[^$]*?)\$/gi,
    '$$$$$1$$$$'
  );

  // 4. Clean up extra spaces inside delimiters
  text = text.replace(/\$\$[\s\n]+/g, '$$').replace(/[\s\n]+\$\$/g, '$$');

  // 5. Replace any stray \[ \] delimiters with $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  return text;
}