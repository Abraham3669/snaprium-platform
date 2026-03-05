// src/components/ResultPanel.jsx

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ResultPanel({ result, loading, onClose }) {
  const [showSteps, setShowSteps] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleFeedback = (type) => {
    setFeedback(type);
    // Later: send to backend
    // fetch('/api/feedback', { method: 'POST', body: JSON.stringify({ type }) })
  };

  if (!result?.image) return null;

  // Extract final answer (heuristic – last display math or last equation-like line)
  const extractFinalAnswer = (text) => {
    if (!text) return 'Solution ready – check steps below';
    
    const displayMathMatches = [...text.matchAll(/\$\$([\s\S]*?)\$\$/g)];
    if (displayMathMatches.length > 0) {
      return `$$${displayMathMatches[displayMathMatches.length - 1][1]}$$`;
    }
    
    const lines = text.split('\n').filter(l => l.trim());
    const lastLine = lines[lines.length - 1] || '';
    if (lastLine.includes('=') || lastLine.match(/^\s*[a-zA-Z0-9]+\s*=/)) {
      return lastLine;
    }
    
    return 'Final result computed – see steps';
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
                  w-full py-3.5 px-5 mb-5 font-medium text-white rounded-xl shadow-md
                  bg-[var(--accent)] hover:bg-[var(--accent-dark)] 
                  transition-[var(--transition)] flex items-center justify-center gap-2.5
                  active:scale-[0.98]
                `}
              >
                {showSteps ? 'Hide Step-by-Step' : 'Show Step-by-Step'}
                <span className="text-xl leading-none">
                  {showSteps ? '▲' : '▼'}
                </span>
              </button>

              {/* Expandable Steps */}
              <div
                className={`
                  steps-section overflow-hidden transition-all duration-500
                  ${showSteps ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}
                `}
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
              <div className="feedback-bar mt-6 flex justify-center gap-4">
                <button
                  className={`feedback-btn flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border)] transition-[var(--transition)] ${
                    feedback === 'up' ? 'bg-[var(--accent-glow)] text-[var(--accent-dark)]' : 'hover:bg-[var(--icon-bg)]'
                  }`}
                  onClick={() => handleFeedback('up')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 9V5a3 3 0 0 0-6 0v4H5v11h14V9h-5z" />
                  </svg>
                  Helpful
                </button>

                <button
                  className={`feedback-btn flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border)] transition-[var(--transition)] ${
                    feedback === 'down' ? 'bg-[var(--accent-glow)] text-[var(--accent-dark)]' : 'hover:bg-[var(--icon-bg)]'
                  }`}
                  onClick={() => handleFeedback('down')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 15v4a3 3 0 0 0 6 0v-4h3V4H5v11h5z" />
                  </svg>
                  Not Helpful
                </button>
              </div>
            </>
          )}

          {loading && (
            <div className="text-center py-10 text-[var(--text-secondary)]">
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

  text = text.replace(
    /(\b\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?\b)(?!\s*\/)/g,
    '\\frac{$1}{$2}'
  );

  text = text.replace(
    /(\d+)\s*\n\s*_{2,}\s*\n\s*(\d+)/g,
    '\\frac{$1}{$2}'
  );

  text = text.replace(
    /\$([^$]*?(?:derivative|rule|product rule|quotient|chain|integral|limit|sum|equals|therefore)[^$]*?)\$/gi,
    '$$$$$1$$$$'
  );

  text = text.replace(/\$\$[\s\n]+/g, '$$').replace(/[\s\n]+\$\$/g, '$$');

  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  return text;
}