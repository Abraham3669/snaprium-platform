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
              {/* ─── FINAL ANSWER (BIG) ──────────────────────────────────────── */}
              <div className="final-answer-card mb-8 rounded-2xl border border-blue-200 dark:border-blue-800/50 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 dark:from-gray-800/60 dark:to-indigo-950/30 shadow-xl overflow-hidden">
                <h3 className="px-6 py-4 text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  Final Answer
                </h3>

                <div className="p-8 pb-10 flex justify-center items-center min-h-[160px] md:min-h-[220px]">
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
                            className="huge-final-katex mx-auto text-center"
                            style={{ fontSize: '320%' }} // 280–420% is usually perfect — tune here
                            {...props}
                          >
                            {children}
                          </div>
                        ) : (
                          <div {...props}>{children}</div>
                        ),
                    }}
                  >
                    {finalAnswerContent || '\\text{No final answer detected}'}
                  </ReactMarkdown>
                </div>
              </div>

              {/* ─── TOGGLE STEPS ────────────────────────────────────────────── */}
              <button
                onClick={() => setShowSteps(!showSteps)}
                className="w-full py-3.5 px-5 mb-6 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-medium rounded-xl shadow-lg transition-all flex items-center justify-center gap-2.5"
              >
                {showSteps ? 'Hide Steps' : 'Show Step-by-Step Solution'}
                <span className="text-xl transition-transform duration-300">
                  {showSteps ? '▲' : '▼'}
                </span>
              </button>

              {/* ─── STEPS (normal size) ─────────────────────────────────────── */}
              <div
                ref={stepsRef}
                className="overflow-hidden transition-all duration-500 ease-in-out"
                style={{
                  maxHeight: showSteps ? `${stepsRef.current?.scrollHeight || 3000}px` : '0px',
                  opacity: showSteps ? 1 : 0,
                }}
              >
                <div className="pt-2 pb-10 px-2">
                  <h4 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">
                    Step-by-Step Solution
                  </h4>
                  <div className="prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      // NO custom huge components here → stays normal size
                    >
                      {preparedSteps}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Feedback */}
              <div className="feedback-bar mt-8 flex justify-center gap-5">
                <button
                  className={`feedback-btn flex items-center gap-2.5 px-6 py-3 rounded-xl border ${feedback === 'up' ? 'bg-green-100 border-green-500 text-green-700' : 'border-gray-300 hover:bg-gray-100'} transition-colors`}
                  onClick={() => handleFeedback('up')}
                >
                  👍 Helpful
                </button>
                <button
                  className={`feedback-btn flex items-center gap-2.5 px-6 py-3 rounded-xl border ${feedback === 'down' ? 'bg-red-100 border-red-500 text-red-700' : 'border-gray-300 hover:bg-gray-100'} transition-colors`}
                  onClick={() => handleFeedback('down')}
                >
                  👎 Not Helpful
                </button>
              </div>
            </>
          )}

          {loading && (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400 italic">
              Working on your solution...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Your helper functions remain unchanged
// ────────────────────────────────────────────────

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