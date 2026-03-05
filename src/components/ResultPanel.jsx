// src/components/ResultPanel.jsx

import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ResultPanel({ result, loading, onClose }) {
  const [showSteps, setShowSteps] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const stepsRef = useRef(null);

  const handleFeedback = (type) => {
    setFeedback(type);
    // Later: send to backend
    // fetch('/api/feedback', { method: 'POST', body: JSON.stringify({ type }) })
  };

  if (!result?.image) return null;

  // ────────────────────────────────────────────────
  // Cleaner final answer extraction + better math handling
  // ────────────────────────────────────────────────
  const extractFinalAnswer = (text) => {
    if (!text) return 'See steps below';

    let cleaned = text.trim().replace(/\n+/g, '\n');

    // 1. Most reliable: \boxed{...} pattern (very common in math solvers)
    const boxedMatch = cleaned.match(/\\boxed\{([^}]*)\}/);
    if (boxedMatch && boxedMatch[1].trim()) {
      let content = boxedMatch[1].trim();
      // If already has $$ or $, don't add again
      if (!content.includes('$$') && !content.startsWith('$')) {
        return `$$${content}$$`;
      }
      return content;
    }

    // 2. Look for last block of display math
    const displayMathMatches = [...cleaned.matchAll(/\$\$([\s\S]*?)\$\$/g)];
    if (displayMathMatches.length > 0) {
      const last = displayMathMatches[displayMathMatches.length - 1][1].trim();
      if (last) return `$$${last}$$`;
    }

    // 3. Keyword-based (final answer:, answer =, etc.)
    const finalKeywordMatch = cleaned.match(
      /(?:final answer|answer|result|solution|therefore|thus|conclusion|so|we get)(?::|\s*[=→]?\s*)([\s\S]*?)(?=\n\n|\n*$)/i
    );
    if (finalKeywordMatch) {
      let answerPart = finalKeywordMatch[1].trim();
      // Remove trailing punctuation junk sometimes left
      answerPart = answerPart.replace(/[.,;]$/, '').trim();

      // If it looks like math expression → force display math
      if (answerPart.match(/[\d=+\-*/^()\\{}[\]]/) || answerPart.includes('\\')) {
        // Clean up if it already has inline delimiters
        answerPart = answerPart.replace(/^\$|\$$/g, '').trim();
        return `$$${answerPart}$$`;
      }
      return answerPart;
    }

    // 4. Last meaningful math-looking line
    const lines = cleaned.split('\n').filter(l => l.trim());
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.includes('=') || line.match(/[\d\\{}[\]()]/)) {
        let cleanedLine = line
          .replace(/^[\[\$]+|[\]\$]+$/g, '')   // remove stray delimiters
          .trim();
        return `$$${cleanedLine}$$`;
      }
    }

    // Fallback: last non-empty line, forced to math if looks plausible
    if (lines.length > 0) {
      const last = lines[lines.length - 1].trim();
      if (last.match(/[\d=+\-*/^()\\]/)) {
        return `$$${last}$$`;
      }
      return last;
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
        {/* Image preview */}
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
              {/* ─── Big Final Answer (improved styling + guaranteed display math) ─── */}
              <div 
                className="final-answer mb-6 p-6 md:p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] text-center"
                style={{ background: 'linear-gradient(135deg, var(--accent-glow), transparent 70%)' }}
              >
                <h3 className="text-2xl font-bold text-[var(--text-secondary)] mb-4 tracking-tight">
                  Final Answer
                </h3>
                <div className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[var(--text-primary)] leading-tight min-h-[3rem] flex items-center justify-center">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({children}) => <div className="inline-block">{children}</div>,
                      // Make sure display math is centered and big
                      div: ({node, ...props}) => (
                        node.tagName === 'div' && props.className?.includes('katex-display')
                          ? <div className="katex-display-big" {...props} />
                          : <div {...props} />
                      )
                    }}
                  >
                    {finalAnswer}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Toggle Button */}
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

              {/* Expandable Steps – NO repeated final answer at bottom */}
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
                <div className="pt-1 pb-8 px-1">
                  <h4 className="text-xl font-semibold text-[var(--text-primary)] mb-5">
                    Step-by-Step Solution
                  </h4>
                  
                  <div className="prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-li:text-[var(--text-secondary)]">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {prepareMathForKaTeX(result.text || '')}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Feedback */}
              <div className="feedback-bar mt-6">
                <button
                  className={`feedback-btn ${feedback === 'up' ? 'active' : ''}`}
                  onClick={() => handleFeedback('up')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M14 9V5a3 3 0 0 0-6 0v4H5v11h14V9h-5z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  Helpful
                </button>

                <button
                  className={`feedback-btn ${feedback === 'down' ? 'active' : ''}`}
                  onClick={() => handleFeedback('down')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M10 15v4a3 3 0 0 0 6 0v-4h3V4H5v11h5z" stroke="currentColor" strokeWidth="2" />
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