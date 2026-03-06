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
  };

  if (!result?.image) return null;

  const fullText = result.text || '';

  const preparedSteps = prepareMathForKaTeX(fullText);

  // Extract ALL boxed answers
  const allBoxedAnswers = extractAllBoxedAnswers(fullText);

  // Debug logs
  console.log('All extracted boxed answers:', allBoxedAnswers);
  console.log('Full text length:', fullText.length);
  console.log('Last 400 chars:\n', fullText.slice(-400));

  return (
    <div className="result-panel">
      <div className="result-panel-header">
        <h2>Solution</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="result-panel-content">
        <div className="image-wrapper">
          <img className="result-image" src={result.image} alt="Cropped preview" />
          {loading && (
            <div className="scan-overlay">
              <div className="scan-line"></div>
            </div>
          )}
        </div>

        <div className="solution-area prose prose-lg dark:prose-invert max-w-none">
          {!loading && result?.text && (
            <>
              {/* Final Answer Block – uniform size for all answers */}
              <div
                className="final-answer mb-6 p-6 md:p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] text-center overflow-hidden"
                style={{ background: 'linear-gradient(135deg, var(--accent-glow), transparent 70%)' }}
              >
                <h3 className="text-2xl font-bold text-[var(--text-secondary)] mb-6 tracking-tight">
                  Final Answer{allBoxedAnswers.length > 1 ? 's' : ''}
                </h3>

                <div className="space-y-8">
                  {allBoxedAnswers.length > 0 ? (
                    allBoxedAnswers.map((answer, index) => (
                      <div
                        key={index}
                        className="overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--accent)] scrollbar-track-transparent"
                      >
                        <div
                          className="flex items-center justify-center px-4 py-6 text-3xl md:text-5xl font-extrabold text-[var(--text-primary)] leading-tight min-h-[6rem]"
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              p: ({ children }) => (
                                <div className="inline-block text-center whitespace-nowrap min-w-fit">
                                  {children}
                                </div>
                              ),
                              div: ({ node, className, children, ...props }) =>
                                className?.includes('katex-display') ? (
                                  <div
                                    className="katex-display-final mx-auto text-center whitespace-nowrap"
                                    style={{
                                      fontSize: '1.65em',
                                      lineHeight: 1.3,
                                    }}
                                    {...props}
                                  >
                                    {children}
                                  </div>
                                ) : (
                                  <div {...props}>{children}</div>
                                ),
                            }}
                          >
                            {answer.startsWith('$$') || answer.startsWith('\\[')
                              ? answer
                              : `$$${answer}$$`}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] opacity-70 py-8">
                      No final answer detected
                    </div>
                  )}
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
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {preparedSteps}
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

// ────────────────────────────────────────────────
// Extract ALL boxed answers
function extractAllBoxedAnswers(rawText) {
  if (!rawText) return [];

  const answers = [];
  let pos = 0;

  while ((pos = rawText.indexOf('\\boxed{', pos)) !== -1) {
    const startIndex = pos + 7;
    let braceCount = 1;
    let i = startIndex;
    let content = '';

    while (i < rawText.length && braceCount > 0) {
      const char = rawText[i];
      content += char;
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      i++;
    }

    // Remove the trailing }
    content = content.slice(0, -1).trim();

    if (content) {
      answers.push(content);
    }

    pos = i;
  }

  console.log('Extracted boxed count:', answers.length);
  return answers;
}

// prepareMathForKaTeX
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