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

  // ────────────────────────────────────────────────
  // Extract final answer — improved to handle full content
  // ────────────────────────────────────────────────
  const finalAnswerRaw = extractFinalAnswer(fullText);

  // Debug: see exactly what we're trying to render in final answer
  console.log('Final Answer RAW extracted:', finalAnswerRaw);
  console.log('Full result.text length:', fullText.length);
  console.log('Full result.text last 300 chars:', fullText.slice(-300));

  // Safety wrap: if it looks like math but isn't wrapped, add display math
  let finalAnswerContent = finalAnswerRaw.trim();
  if (
    finalAnswerContent &&
    !finalAnswerContent.startsWith('$') &&
    !finalAnswerContent.startsWith('$$') &&
    !finalAnswerContent.startsWith('\\[') &&
    (finalAnswerContent.includes('\\') || finalAnswerContent.match(/[=≈√π∫∑^⁄]/))
  ) {
    finalAnswerContent = `$$${finalAnswerContent}$$`;
  }

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
              {/* Final Answer Block */}
              <div
                className="final-answer mb-6 p-6 md:p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] text-center overflow-hidden"
                style={{ background: 'linear-gradient(135deg, var(--accent-glow), transparent 70%)' }}
              >
                <h3 className="text-2xl font-bold text-[var(--text-secondary)] mb-4 tracking-tight">
                  Final Answer
                </h3>

                <div
                  className="text-3xl md:text-5xl font-extrabold text-[var(--text-primary)] leading-tight min-h-[6rem] flex items-center justify-center overflow-x-auto px-4 py-4"
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
                          ? (
                            <div
                              className="katex-display-final mx-auto text-center my-4"
                              style={{ fontSize: '1.6em', lineHeight: 1.25 }}
                              {...props}
                            >
                              {children}
                            </div>
                          )
                          : <div {...props}>{children}</div>,
                    }}
                  >
                    {finalAnswerContent || '\\text{No final answer detected}'}
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
                      {preparedSteps}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Feedback */}
              <div className="feedback-bar mt-6 flex justify-center gap-4">
                {/* ... your feedback buttons unchanged ... */}
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

// Improved extraction — grabs full boxed content, even multi-line
function extractFinalAnswer(rawText) {
  if (!rawText) return '';

  // 1. Try to capture the LAST \boxed{...} with everything inside (multi-line ok)
  const boxedRegex = /\\boxed\{([\s\S]*?)\}(?![^]*?\\boxed)/;
  const boxedMatch = rawText.match(boxedRegex);
  if (boxedMatch && boxedMatch[1]) {
    const content = boxedMatch[1].trim();
    console.log('Extracted from \\boxed:', content);
    return content;
  }

  // 2. Fallback: last 1–3 lines that look like the conclusion
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';

  // Look backward for lines with math indicators
  let candidate = '';
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 4); i--) {
    const line = lines[i];
    if (line.match(/[=≈≈√∫∑π\\frac\\boxed]/) || line.match(/^\s*[-−]?\d+(\.\d+)?\s*$/)) {
      candidate = line + (candidate ? '\n' + candidate : '');
    }
  }

  if (candidate) {
    console.log('Fallback multi-line candidate:', candidate);
    return candidate;
  }

  // Last resort: very last non-empty line, cleaned
  let last = lines[lines.length - 1];
  last = last.replace(/^(Final answer|Answer|Result|So|Therefore|Hence|Thus|We have|Equals?):\s*/i, '').trim();
  console.log('Last line fallback:', last);
  return last;
}

// Your original prepare function (unchanged)
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