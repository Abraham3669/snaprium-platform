// src/components/ResultPanel.jsx

export default function ResultPanel({ result, loading, onClose }) {
  if (!result?.image) return null;

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

        <div className="solution-area">
          {loading ? (
            <p className="processing-text">Analyzing...</p>
          ) : (
            <p>{result.text || "No solution available yet."}</p>
          )}
        </div>
      </div>
    </div>
  );
}