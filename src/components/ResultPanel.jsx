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
  const preparedSteps = prepareMathForKaTeX(fullText); // improved below

  const finalAnswerRaw = extractFinalAnswer(fullText);

  // Debug (you can remove later)
  console.log('Final Answer RAW:', finalAnswerRaw);
  console.log('Full text last 400:', fullText.slice(-400));

  let finalAnswerContent = finalAnswerRaw.trim();
  if (
    finalAnswerContent &&
    !finalAnswerContent.match(/^\$\$[\s\S]*\$\$|\$[\s\S]*\$|\\\[[\s\S]*\\\]/) &&
    (finalAnswerContent.includes('\\') || finalAnswerContent.match(/[=\-+*/^√π∫∑()[\]{}]/))
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
              {/* Final Answer Block – improved horizontal scroll */}
              <div
                className="final-answer mb-6 p-6 md:p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] text-center overflow-hidden"
                style={{ background: 'linear-gradient(135deg, var(--accent-glow), transparent 70%)' }}
              >
                <h3 className="text-2xl font-bold text-[var(--text-secondary)] mb-4 tracking-tight">
                  Final Answer
                </h3>

                <div
                  className="text-3xl md:text-5xl font-extrabold text-[var(--text-primary)] leading-tight min-h-[6rem] flex items-center justify-center overflow-x-auto px-4 py-6 scrollbar-thin scrollbar-thumb-[var(--accent)] scrollbar-track-transparent"
                  // ────── Key improvements ──────
                  style={{
                    maxWidth: '100%',
                    WebkitOverflowScrolling: 'touch', // smooth scroll on mobile
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => <div className="inline-block text-center min-w-fit">{children}</div>,
                      div: ({ node, className, children, ...props }) =>
                        className?.includes('katex-display')
                          ? (
                            <div
                              className="katex-display-final mx-auto text-center my-4 whitespace-nowrap"
                              style={{ fontSize: '1.65em', lineHeight: 1.3, minWidth: 'fit-content' }}
                              {...props}
                            >
                              {children}
                            </div>
                          )
                          : <div {...props}>{children}</div>,
                    }}
                  >
                    {finalAnswerContent || '\\text{—}'}
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

              {/* Steps Section – now with better inline math handling */}
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

                  <div className="prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-li:text-[var(--text-secondary)] prose-code:bg-transparent prose-code:p-0">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      // Extra components to prevent inline math from looking broken
                      components={{
                        code: ({ node, inline, className, children, ...props }) =>
                          inline ? (
                            <code className="not-prose bg-transparent p-0 font-normal" {...props}>
                              {children}
                            </code>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          ),
                        // Force inline math to behave nicely
                        math: ({ value }) => <span className="inline-block align-middle">{`$${value}$`}</span>,
                        inlineMath: ({ value }) => <span className="inline-block align-middle">{`$${value}$`}</span>,
                      }}
                    >
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
// Improved brace-balanced extraction (unchanged from last win)
function extractFinalAnswer(rawText) {
  if (!rawText) return '';

  const boxedPositions = [];
  let pos = 0;
  while ((pos = rawText.indexOf('\\boxed{', pos)) !== -1) {
    boxedPositions.push(pos);
    pos += 7;
  }

  if (boxedPositions.length === 0) {
    console.log('No \\boxed → fallback');
    return fallbackLastLines(rawText);
  }

  const startIndex = boxedPositions[boxedPositions.length - 1] + 7;
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
  console.log('Extracted boxed:', content);
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
    if (line.includes('=') || line.includes('\\frac') || line.match(/^\s*[-−]?\d+(\.\d+)?\s*$/)) break;
  }
  console.log('Fallback:', candidate);
  return candidate || lines[lines.length - 1];
}

// ────────────────────────────────────────────────
// IMPROVED prepareMathForKaTeX – fixes messy inline + display mix
// ────────────────────────────────────────────────
function prepareMathForKaTeX(rawText) {
  if (!rawText) return '';

  let text = rawText;

  // 1. Normalize common fraction patterns
  text = text.replace(
    /(\b\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?\b)(?!\s*\/)/g,
    '\\frac{$1}{$2}'
  );
  text = text.replace(
    /(\d+)\s*\n\s*_{2,}\s*\n\s*(\d+)/g,
    '\\frac{$1}{$2}'
  );

  // 2. Fix broken/partial delimiters (very common backend issue)
  text = text.replace(/\$([^$]*?)\$\$/g, '\\($1\\)');          // $...$$ → \(...\)
  text = text.replace(/\$\$([^$]*?)\$/g, '\\($1\\)');          // $$...$ → \(...\)
  text = text.replace(/\\begin\{equation\}(.*?)\\end\{equation\}/gs, '$$$$$1$$$$');

  // 3. Convert single $...$ to proper inline, but protect already doubled ones
  text = text.replace(/(?<!\$)\$(?!\$)(.*?)(?<!\$)\$(?!\$)/g, '\\($1\\)');

  // 4. Force display math where it looks like it should be block
  text = text.replace(
    /\\\((\s*(?:\\begin\{align\*?}|\\begin\{equation}|\\\[|displaystyle).*?)\s*\\\)/gs,
    '$$$$$1$$$$'
  );

  // 5. Clean extra newlines around delimiters (helps prose flow)
  text = text.replace(/\s*(\$\$|\\\[)\s*/g, '$1');
  text = text.replace(/\s*(\$\$|\\\])\s*/g, '$1');

  // 6. Your original smart replacements
  text = text.replace(
    /\$([^$]*?(?:derivative|rule|product rule|quotient|chain|integral|limit|sum|equals|therefore)[^$]*?)\$/gi,
    '$$$$$1$$$$'
  );

  text = text.replace(/\$\$[\s\n]+/g, '$$').replace(/[\s\n]+\$\$/g, '$$');
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  return text;
}