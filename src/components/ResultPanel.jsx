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

  // Extract final answer with proper brace balancing
  const finalAnswerRaw = extractFinalAnswer(fullText);

  // Debug logs
  console.log('Final Answer RAW extracted:', finalAnswerRaw);
  console.log('Full result.text length:', fullText.length);
  console.log('Full result.text last 400 chars:\n', fullText.slice(-400));

  // Auto-wrap in display math if it looks like math but isn't already wrapped
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
              <div
                className="final-answer mb-6 p-6 md:p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] text-center overflow-hidden"
                style={{ background: 'linear-gradient(135deg, var(--accent-glow), transparent 70%)' }}
              >
                <h3 className="text-2xl font-bold text-[var(--text-secondary)] mb-4 tracking-tight">
                  Final Answer
                </h3>

                <div
                  className="text-3xl md:text-5xl font-extrabold text-[var(--text-primary)] leading-tight min-h-[6rem] flex items-center justify-center overflow-x-auto px-4 py-6"
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => <div className="inline-block text-center">{children}</div>,
                      div: ({ node, className, children, ...props }) =>
                        className?.includes('katex-display')
                          ? (
                            <div
                              className="katex-display-final mx-auto text-center my-4"
                              style={{ fontSize: '1.65em', lineHeight: 1.3 }}
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

              {/* Toggle + Steps + Feedback unchanged */}
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
                {/* your feedback buttons */}
              </div>
            </>
          )}

          {loading && <div className="text-center py-8 text-gray-500 dark:text-gray-400">Solving your problem...</div>}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// New: Properly balanced brace extraction for last \boxed{...}
function extractFinalAnswer(rawText) {
  if (!rawText) return '';

  // Find the position of the LAST \boxed{
  const boxedPositions = [];
  let pos = 0;
  while ((pos = rawText.indexOf('\\boxed{', pos)) !== -1) {
    boxedPositions.push(pos);
    pos += 7; // skip \boxed{
  }

  if (boxedPositions.length === 0) {
    console.log('No \\boxed found → using fallback');
    return fallbackLastLines(rawText);
  }

  const startIndex = boxedPositions[boxedPositions.length - 1] + 7; // after \boxed{
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

  // Remove the last } we added
  content = content.slice(0, -1).trim();

  console.log('Extracted full boxed content (balanced):', content);
  return content;
}

// Fallback if no boxed or extraction fails
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

  console.log('Fallback candidate:', candidate);
  return candidate || lines[lines.length - 1];
}

// Your prepareMathForKaTeX (unchanged)
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