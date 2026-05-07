// src/components/ResultPanel.jsx

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
import 'katex/dist/katex.min.css';

import GraphDisplay from './GraphDisplay';
import { autoGenerateGraph } from '../utils/graphGenerator';

export default function ResultPanel({ result, loading, onClose }) {
  const [showSteps, setShowSteps] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showAnalyzing, setShowAnalyzing] = useState(false);
  const [scanFinished, setScanFinished] = useState(false);

  const stepsRef = useRef(null);
  const timeoutRef = useRef(null);

  const handleFeedback = (type) => setFeedback(type);

  // Loading timing
  useEffect(() => {
    if (loading) {
      setScanFinished(false);
      setShowAnalyzing(false);
      timeoutRef.current = setTimeout(() => {
        setScanFinished(true);
        setShowAnalyzing(true);
      }, 3300);
      return () => clearTimeout(timeoutRef.current);
    } else {
      setShowAnalyzing(false);
      clearTimeout(timeoutRef.current);
    }
  }, [loading]);

  // Reveal result
  const [revealReady, setRevealReady] = useState(false);

  useEffect(() => {
    if (!loading && result?.text) {
      const timer = setTimeout(() => setRevealReady(true), 400);
      return () => clearTimeout(timer);
    } else {
      setRevealReady(false);
    }
  }, [loading, result?.text]);

  if (!result?.image) return null;

  const fullText = result.text || '';
  const preparedSteps = prepareMathForKaTeX(fullText);
  const cleanedSteps = fixCommonMathGlue(preparedSteps);

  const finalAnswerRaw = extractFinalAnswer(fullText);

  // Graph
  const displayGraph = result.graph || autoGenerateGraph(fullText);
  const graphTitle = result.graph ? "AI Generated Graph" : "Solution Graph";

  // Final Answer for KaTeX (cleaner way)
  const finalAnswerDisplay = finalAnswerRaw
    ? `$$\\displaystyle\\mathbf{${finalAnswerRaw}}$$`
    : '$$\\displaystyle\\mathbf{-}$$';

  return (
    <div className="result-panel">
      <div className="result-panel-header">
        <h2>Solution</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="result-panel-content">
        {/* Question Image */}
        <div className="image-wrapper relative mb-8">
          <img className="result-image" src={result.image} alt="Question" />
        </div>

        <div className="solution-area prose prose-lg dark:prose-invert max-w-none">
          {loading ? (
            <div className="min-h-[220px] flex items-center justify-center py-12">
              <p className="text-2xl text-gray-900 dark:text-white animate-pulse font-bold">
                Solving your question…
              </p>
            </div>
          ) : (
            result?.text && revealReady && (
              <>
                {/* Final Answer Box */}
                <div className="final-answer mb-10 rounded-3xl border border-blue-200/40 dark:border-blue-800/40 bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 shadow-2xl overflow-hidden">
                  <h3 className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xl font-bold tracking-wide">
                    Final Answer
                  </h3>
                  <div className="p-10 flex justify-center">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        p: ({ children }) => <div className="text-center">{children}</div>,
                      }}
                    >
                      {finalAnswerDisplay}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Step-by-Step Toggle */}
                <button
                  onClick={() => setShowSteps(!showSteps)}
                  className="w-full py-4 px-6 mb-6 bg-[var(--accent)] hover:bg-[var(--accent-dark)] text-white font-semibold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 text-lg"
                >
                  {showSteps ? 'Hide Step-by-Step Solution' : 'Show Step-by-Step Solution'}
                  <span className="text-2xl transition-transform duration-300">
                    {showSteps ? '▲' : '▼'}
                  </span>
                </button>

                {/* Steps Content */}
                <div
                  ref={stepsRef}
                  className="overflow-hidden transition-all duration-500 ease-in-out"
                  style={{
                    maxHeight: showSteps ? `${stepsRef.current?.scrollHeight || 3000}px` : '0px',
                    opacity: showSteps ? 1 : 0,
                  }}
                >
                  <div className="mb-8">
                    <h3 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">
                      Step-by-Step Solution
                    </h3>

                    <div className="step-by-step-content leading-relaxed text-[17px]">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[[rehypeKatex, { output: 'html', throwOnError: false, strict: 'ignore', trust: true }]]}
                        components={{
                          inlineMath: ({ value }) => (
                            <span className="inline-katex">
                              <span dangerouslySetInnerHTML={{
                                __html: katex.renderToString(value.trim(), { throwOnError: false, displayMode: false })
                              }} />
                            </span>
                          ),
                          math: ({ value }) => (
                            <div className="my-8 overflow-x-auto">
                              <div dangerouslySetInnerHTML={{
                                __html: katex.renderToString(value, { throwOnError: false, displayMode: true })
                              }} />
                            </div>
                          ),
                        }}
                      >
                        {cleanedSteps}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>

                {/* Graph */}
                {displayGraph && (
                  <GraphDisplay graphData={displayGraph} title={graphTitle} />
                )}

                {/* Feedback */}
                <div className="feedback-bar mt-10 flex justify-center gap-4">
                  <button
                    className={`feedback-btn flex items-center gap-2 px-6 py-3 ${feedback === 'up' ? 'active' : ''}`}
                    onClick={() => handleFeedback('up')}
                  >
                    👍 Helpful
                  </button>
                  <button
                    className={`feedback-btn flex items-center gap-2 px-6 py-3 ${feedback === 'down' ? 'active' : ''}`}
                    onClick={() => handleFeedback('down')}
                  >
                    👎 Not Helpful
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

/* ==================== HELPER FUNCTIONS ==================== */
function extractFinalAnswer(rawText) {
  if (!rawText) return '';

  let lastStart = -1;
  let pos = 0;

  while ((pos = rawText.indexOf('\\boxed{', pos)) !== -1) {
    lastStart = pos;
    pos += 7;
  }

  if (lastStart === -1) return fallbackLastLines(rawText);

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

  return content.slice(0, -1).trim();
}

function fallbackLastLines(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 1) return '';

  let candidate = '';
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 6); i--) {
    let line = lines[i].replace(/^(Final answer|Answer|Result|So|Therefore|Hence|Thus):?\s*/i, '').trim();
    if (line) candidate = line + (candidate ? '\n' + candidate : '');
    if (line.includes('=') || line.includes('\\frac') || /^\s*[-−]?\d+(\.\d+)?\s*$/.test(line)) break;
  }
  return candidate || lines[lines.length - 1];
}

function fixCommonMathGlue(text) {
  if (!text) return text;
  return text.replace(/(\$[^\s$]{1,60}?)\$\$/g, '$1$');
}

function prepareMathForKaTeX(rawText) {
  if (!rawText) return '';

  let text = rawText;
  text = text.replace(/(\b\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?\b)(?!\s*\/)/g, '\\frac{$1}{$2}');
  text = text.replace(/(\d+)\s*\n\s*_{2,}\s*\n\s*(\d+)/g, '\\frac{$1}{$2}');
  text = text.replace(/\$\$[\s\n]+/g, '$$').replace(/[\s\n]+\$\$/g, '$$');
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  return text;
}