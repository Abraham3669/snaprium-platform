// src/components/ResultPanel.jsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ResultPanel({ result, loading, onClose }) {
  const [feedback, setFeedback] = React.useState(null);

  const handleFeedback = (type) => {
    setFeedback(type);
    // Later: send to backend
    // fetch('/api/feedback', { method: 'POST', body: JSON.stringify({ type }) })
  };

  if (!result?.image) return null;

  // Render markdown with custom styling for steps & final answer
  const renderSolution = () => {
    if (!result?.text) return <p className="no-solution">No solution available</p>;

    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom step titles
          h1: ({ node, ...props }) => <h1 className="step-title main-title" {...props} />,
          h2: ({ node, ...props }) => <h2 className="step-title" {...props} />,
          h3: ({ node, ...props }) => <h3 className="step-title sub-title" {...props} />,
          // Paragraphs
          p: ({ node, ...props }) => <p className="step-paragraph" {...props} />,
          // Lists
          ul: ({ node, ...props }) => <ul className="step-list" {...props} />,
          ol: ({ node, ...props }) => <ol className="step-list numbered" {...props} />,
          li: ({ node, ...props }) => <li className="step-item" {...props} />,
          // Strong text (keywords)
          strong: ({ node, ...props }) => <strong className="strong-highlight" {...props} />,
        }}
      >
        {prepareMathForKaTeX(result.text || '')}
      </ReactMarkdown>
    );
  };

  return (
    <div className="result-panel">
      <div className="result-panel-header">
        <h2 className="panel-title">Solution</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="result-panel-content">
        {/* Image */}
        <div className="image-wrapper">
          <img className="result-image" src={result.image} alt="Cropped preview" />
          {loading && (
            <div className="scan-overlay">
              <div className="scan-line"></div>
            </div>
          )}
        </div>

        {/* Solution */}
        <div className="solution-area">
          {loading ? (
            <div className="loading-solution">
              <div className="spinner"></div>
              <p>Solving your problem...</p>
            </div>
          ) : (
            <>
              {renderSolution()}

              {/* Highlight Final Answer if present */}
              {result.text?.toLowerCase().includes('final answer') && (
                <div className="final-answer-box">
                  <h3 className="final-title">Final Answer</h3>
                  <div className="final-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {result.text.split(/final answer/i)[1]?.trim() || result.text}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Feedback */}
              {!loading && result?.text && (
                <div className="feedback-bar">
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Your existing helper (unchanged)
function prepareMathForKaTeX(rawText) {
  if (!rawText) return '';
  let text = rawText;
  // Your existing replacements...
  // Force final answer styling on the last math block
text = text.replace(
  /(\$\$[\s\S]*?\$\$)$/g, // last display math block
  '<div class="final-answer-box"><h3 class="final-title">Final Answer</h3><div class="final-content">$1</div></div>'
);
  return text;
}


