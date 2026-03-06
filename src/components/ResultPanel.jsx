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

const extractFinalAnswer = (text) => {
  if (!text || !text.trim()) {
    return '$$\\text{No solution found}$$';
  }

  let cleaned = text
    .trim()
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+/g, '\n');

  let candidate = null;

  // 1. Last \boxed{} — best
  const boxed = [...cleaned.matchAll(/\\boxed\{([\s\S]*?)\}/g)];
  if (boxed.length) {
    candidate = boxed[boxed.length - 1][1].trim();
  }

  // 2. Keyword match
  if (!candidate) {
    const finalMatch = cleaned.match(
      /(final answer|answer|result|solution)[:=\s\-→]*([^\n]+)/i
    );
    if (finalMatch) {
      candidate = finalMatch[2].trim();
    }
  }

  // 3. Last display math
  if (!candidate) {
    const display = [...cleaned.matchAll(/\$\$([\s\S]*?)\$\$/g)];
    if (display.length) {
      candidate = display[display.length - 1][1].trim();
    }
  }

  // 4. Last equation-like line
  if (!candidate) {
    const lines = cleaned.split('\n').reverse();
    for (const line of lines) {
      const l = line.trim();
      if (!l) continue;
      if (
        l.includes('=') ||
        l.includes('\\frac') ||
        l.includes('^') ||
        l.includes('_')
      ) {
        candidate = l;
        break;
      }
    }
  }

  // 5. Plain fraction fallback
  if (!candidate) {
    const fraction = cleaned.match(/\d+\s*\/\s*\d+/);
    if (fraction) {
      candidate = fraction[0];
    }
  }

  if (!candidate) {
    return '$$\\text{No solution found}$$';
  }

  // Remove wrappers
  candidate = candidate
    .replace(/^\$+|\$+$/g, '')
    .replace(/^\\\[|\\\]$/g, '')
    .replace(/\\boxed\{([\s\S]*?)\}/g, '$1')
    .trim();

  // Repair and prepare
  candidate = repairLatex(candidate);
  candidate = prepareMathForKaTeX(candidate);

  // Safety net: fix obviously incomplete frac
  if (candidate.includes('\\frac') && !candidate.includes('}{')) {
    candidate = candidate.replace(/\\frac\{([^}]*)\}/g, '\\frac{$1}{?}');
    candidate = candidate.replace(/\\frac\{([^}]*)$/, '\\frac{$1}{?}');
  }

  // Final wrapping – SAFE concatenation only
  let wrapped;

  // Prefer inline for equations (looks best in your big font)
  if (candidate.includes('=')) {
    const parts = candidate.split('=');
    if (parts.length === 2) {
      const left = parts[0].trim();
      const right = parts[1].trim();
      wrapped = left + ' = $' + right + '$';
    } else {
      wrapped = '$' + candidate + '$';
    }
  } else {
    // Short non-equation → inline
    if (candidate.length < 60 && !candidate.includes('\\\\')) {
      wrapped = '$' + candidate + '$';
    } else {
      // Complex → display
      wrapped = '$$' + candidate + '$$';
    }
  }

  console.log("Final answer sent to ReactMarkdown:", wrapped);

  return wrapped;
};

  const finalAnswer = extractFinalAnswer(result.text || '');

  // Optional debug: uncomment to see what’s actually being rendered
   console.log("Final answer sent to ReactMarkdown:", finalAnswer);

  return (
    <div className="result-panel">
      <div className="result-panel-header">
        <h2>Solution</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="result-panel-content">
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

        <div className="solution-area prose prose-lg dark:prose-invert max-w-none">
          {!loading && result?.text && (
            <>
              {/* Final Answer Block */}
              <div
                className="final-answer mb-6 p-6 md:p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] text-center overflow-hidden"
                style={{ background: 'linear-gradient(135deg, var(--accent-glow), transparent 70%)' }}
              >
                <h3 className="text-2xl font-bold text-[var(--text-secondary)] mb-4 tracking-tight">
                  Final Answer
                </h3>

                <div
                  className="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)] leading-tight min-h-[4rem] flex items-center justify-center overflow-x-auto px-2"
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => (
                        <div className="inline-block text-center">{children}</div>
                      ),
                      div: ({ node, className, children, ...props }) =>
                        className?.includes('katex-display')
                          ? <div className="katex-display-final mx-auto text-center" {...props}>{children}</div>
                          : <div {...props}>{children}</div>,
                    }}
                  >
                    {finalAnswer}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Toggle Button */}
              <button
                onClick={() => setShowSteps(!showSteps)}
                className="w-full py-3.5 px-5 mb-5 bg-[var(--accent)] hover:bg-[var(--accent-dark)] text-white font-medium rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
              >
                {showSteps ? 'Hide Step-by-Step' : 'Show Step-by-Step'}
                <span className="text-xl transition-transform duration-300">
                  {showSteps ? '▲' : '▼'}
                </span>
              </button>

              {/* Steps Section */}
              <div
                ref={stepsRef}
                className="overflow-hidden transition-all duration-500 ease-in-out"
                style={{
                  maxHeight: showSteps ? `${stepsRef.current?.scrollHeight || 2000}px` : '0px',
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
              <div className="feedback-bar mt-6 flex justify-center gap-4">
                <button
                  className={`feedback-btn flex items-center gap-2 px-5 py-2.5 ${feedback === 'up' ? 'active' : ''}`}
                  onClick={() => handleFeedback('up')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M14 9V5a3 3 0 0 0-6 0v4H5v11h14V9h-5z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  Helpful
                </button>

                <button
                  className={`feedback-btn flex items-center gap-2 px-5 py-2.5 ${feedback === 'down' ? 'active' : ''}`}
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






function repairLatex(candidate) {
  if (!candidate) return candidate;

  let fixed = candidate.trim();

  // Fix missing \frac
  fixed = fixed.replace(/(^|[^\\])frac\{/g, '$1\\frac{');

  // Convert plain fractions 5/2 → \frac{5}{2}
  fixed = fixed.replace(
    /(\d+)\s*\/\s*(\d+)/g,
    '\\frac{$1}{$2}'
  );

  // Fix exponent like e^3 → e^{3}
  fixed = fixed.replace(/\^([a-zA-Z0-9]+)/g, '^{$1}');

  // Fix subscript like x_2 → x_{2}
  fixed = fixed.replace(/_([a-zA-Z0-9]+)/g, '_{$1}');

  // Fix incomplete \frac{a}
  fixed = fixed.replace(/\\frac\{([^}]*)\}(?!\{)/g, '\\frac{$1}{1}');

  // Fix incomplete \frac{a}{ }
  fixed = fixed.replace(/\\frac\{([^}]*)\}\{\}/g, '\\frac{$1}{1}');

  // Balance braces
  const open = (fixed.match(/\{/g) || []).length;
  const close = (fixed.match(/\}/g) || []).length;

  if (open > close) {
    fixed += '}'.repeat(open - close);
  }

  // Remove duplicated braces safely
  fixed = fixed
    .replace(/\{\s*\{/g, '{')
    .replace(/\}\s*\}/g, '}');

  return fixed.trim();
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


