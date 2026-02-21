// src/components/ResultPanel.jsx  (small cleanup – mostly already good)

export default function ResultPanel({ result, loading, onClose }) {
  if (!result?.image) return null;   // safer guard

  return (
    <div className="result-panel">
      <div className="result-panel-header">
        <h2>Solution</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="result-panel-content">
        {result.image && (
          <img className="result-image" src={result.image} alt="Cropped" />
        )}
        <div className="solution-area">
          {loading ? (
            <p>Processing your question...</p>
          ) : (
            <p>{result.text || "No solution available yet."}</p>
          )}
        </div>
      </div>
    </div>
  );
}