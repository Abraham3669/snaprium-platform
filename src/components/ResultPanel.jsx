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
            {/* Final Answer Card – BIG & PROUD */}
            <div className="final-answer mb-6 md:mb-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] overflow-hidden">
              <h3 className="final-answer-header px-6 pt-5 pb-3 text-2xl md:text-3xl font-bold text-center">
                Final Answer
              </h3>

              <div className="massive-answer-container">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p: ({ children }) => (
                      <div className="inline-block text-center leading-tight min-w-fit">
                        {children}
                      </div>
                    ),
                    div: ({ node, className, children, ...props }) =>
                      className?.includes('katex-display') ? (
                        <div className="block massive-katex mx-auto my-2 md:my-4" {...props}>
                          {children}
                        </div>
                      ) : (
                        <div className="massive-text" {...props}>
                          {children}
                        </div>
                      ),
                  }}
                >
                  {finalAnswerContent || '\\text{—}'}
                </ReactMarkdown>
              </div>
            </div>

            {/* Toggle Button */}
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="w-full py-3.5 px-5 mb-6 bg-[var(--accent)] hover:bg-[var(--accent-dark)] text-white font-medium rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
            >
              {showSteps ? 'Hide Step-by-Step' : 'Show Step-by-Step'}
              <span className="text-xl transition-transform duration-300">
                {showSteps ? '▲' : '▼'}
              </span>
            </button>

            {/* Steps Section – normal size */}
            <div
              ref={stepsRef}
              className="overflow-hidden transition-all duration-500 ease-in-out"
              style={{
                maxHeight: showSteps ? `${stepsRef.current?.scrollHeight || 2000}px` : '0px',
                opacity: showSteps ? 1 : 0,
              }}
            >
              <div className="pt-1 pb-10 px-2 md:px-4">
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
              {/* ... unchanged ... */}
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
// Extract last boxed answer
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

// Fallback
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