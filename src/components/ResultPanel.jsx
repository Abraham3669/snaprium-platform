// src/components/ResultPanel.jsx

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ResultPanel({ result, loading, onClose }) {
  const [showSteps, setShowSteps] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [loadingPhase, setLoadingPhase] = useState(0); // 0: scanning, 1: first msg, 2: second msg

  const stepsRef = useRef(null);
  const timeoutRef1 = useRef(null);
  const timeoutRef2 = useRef(null);

  const handleFeedback = (type) => {
    setFeedback(type);
    // Later: send to backend
  };

  useEffect(() => {
    if (!loading) {
      setLoadingPhase(0);
      if (timeoutRef1.current) clearTimeout(timeoutRef1.current);
      if (timeoutRef2.current) clearTimeout(timeoutRef2.current);
      return;
    }

    setLoadingPhase(0);

    // Show first message sooner (~1.5s after loading starts)
    timeoutRef1.current = setTimeout(() => {
      setLoadingPhase(1);
      // Second message after +3s from first
      timeoutRef2.current = setTimeout(() => {
        setLoadingPhase(2);
      }, 3000);
    }, 1500); // <-- Reduced for quicker feedback

    return () => {
      if (timeoutRef1.current) clearTimeout(timeoutRef1.current);
      if (timeoutRef2.current) clearTimeout(timeoutRef2.current);
    };
  }, [loading]);

  if (!result?.image) return null;

  const fullText = result.text || '';
  const preparedSteps = prepareMathForKaTeX(fullText);
  const finalAnswerRaw = extractFinalAnswer(fullText);

  console.log('Final Answer RAW extracted:', finalAnswerRaw);
  console.log('Full result.text length:', fullText.length);
  console.log('Full result.text last 400 chars:\n', fullText.slice(-400));

  let finalAnswerContent = finalAnswerRaw.trim();
  if (
    finalAnswerContent &&
    !finalAnswerContent.match(/^\$\$[\s\S]*\$\$|\$[\s\S]*\$|\\\[[\s\S]*\\\]/) &&
    (finalAnswerContent.includes('\\') || finalAnswerContent.match(/[=\-+*/^√π∫∑()[\]{}]/))
  ) {
    finalAnswerContent = `$$${finalAnswerContent}$$`;
  }

  const getLoadingMessage = () => {
    if (loadingPhase === 0) return "Scanning your problem...";
    if (loadingPhase === 1) return "Analyzing steps...";
    if (loadingPhase === 2) return "Preparing final solution... this may take a moment";
    return "Solving your problem...";
  };

  return (
    <div className="result-panel">
      <div className="result-panel-header">
        <h2>Solution</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="result-panel-content">
        <div className="image-wrapper relative">
          <img className="result-image" src={result.image} alt="Cropped preview" />

          {loading && (
            <div className="scan-overlay absolute inset-0 pointer-events-none">
              <div className="scan-grid absolute inset-0"></div>

              {/* Beam always during loading, but animation only once via CSS */}
              <div className="scan-line absolute"></div>

              <div className="scan-corners absolute inset-0">
                <span className="corner-tl"></span>
                <span className="corner-tr"></span>
                <span className="corner-bl"></span>
                <span className="corner-br"></span>
              </div>
            </div>
          )}
        </div>

        <div className="solution-area prose prose-lg dark:prose-invert max-w-none">
          {loading ? (
            <div className="loading-messages min-h-[180px] flex flex-col items-center justify-center py-12 px-6 text-center">
              <p
  className={`text-xl font-medium transition-all duration-700 ease-in-out transform
    ${loadingPhase >= 1 ? 'opacity-100 scale-100 visible-pulse' : 'opacity-0 scale-95'}`}
  style={{ color: loadingPhase === 2 ? '#111827' : '#4b5563' }} // darker for phase 2 emphasis
>
  {getLoadingMessage()}
</p>

              {loadingPhase === 2 && (
                <div className="mt-8">
                  <div className="w-10 h-10 border-4 border-gray-300 border-t-[var(--accent)] rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          ) : (
            result?.text && (
              // ... (your final answer card, toggle, steps, feedback - unchanged)
              <>
                <div className="final-answer mb-8 rounded-2xl border border-blue-200/30 dark:border-blue-800/30 bg-gradient-to-b from-blue-50/40 to-indigo-50/30 dark:from-blue-950/30 dark:to-indigo-950/20 shadow-xl overflow-hidden">
                  <h3 className="final-answer-header px-6 py-4 text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    Final Answer
                  </h3>
                  <div
                    className="massive-answer-container katex-display-final-container p-8 pb-10 flex justify-center items-center min-h-[220px]"
                    style={{ fontSize: "64px", lineHeight: 1.2 }}
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
                      }}
                    >
                      {finalAnswerContent || '\\text{-}'}
                    </ReactMarkdown>
                  </div>
                </div>

                <button
                  onClick={() => setShowSteps(!showSteps)}
                  className="w-full py-3.5 px-5 mb-5 bg-[var(--accent)] hover:bg-[var(--accent-dark)] text-white font-medium rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {showSteps ? 'Hide Step-by-Step' : 'Show Step-by-Step'}
                  <span className="text-xl transition-transform duration-300">
                    {showSteps ? '▲' : '▼'}
                  </span>
                </button>

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
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Helper functions unchanged...
// (extractFinalAnswer, fallbackLastLines, prepareMathForKaTeX - copy from your original)
// ────────────────────────────────────────────────
// Your existing helper functions (unchanged)
function extractFinalAnswer(rawText) {
  if (!rawText) return '';

  let lastStart = -1;
  let pos = 0;

  while ((pos = rawText.indexOf('\\boxed{', pos)) !== -1) {
    lastStart = pos;
    pos += 7;
  }

  if (lastStart === -1) {
    console.log('No \\boxed found → fallback');
    return fallbackLastLines(rawText);
  }

  const startIndex = lastStart + 7;
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

  content = content.slice(0, -1).trim();

  console.log('Extracted last boxed:', content);
  return content;
}

function fallbackLastLines(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 1) return '';

  let candidate = '';
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
    let line = lines[i];
    line = line.replace(/^(Final answer|Answer|Result|So|Therefore|Hence|Thus):?\s*/i, '').trim();
    if (line) candidate = line + (candidate ? '\n' + candidate : '');
    if (line.includes('=') || line.includes('\\frac') || /^\s*[-−]?\d+(\.\d+)?\s*$/.test(line)) break;
  }

  console.log('Fallback:', candidate);
  return candidate || lines[lines.length - 1];
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