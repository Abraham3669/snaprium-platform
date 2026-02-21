export default function ResultPanel({ result, loading, onClose }) {
  if (!result) return null;

  return (
    <div className="result-panel">
      <div className="result-panel-header">
        <h2>Solution</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="result-panel-content">
        {result.image && (
          <img className="result-image" src={result.image} alt="Cropped result" />
        )}
        <div className="solution-area">
          {loading ? (
            <p>Processing your question...</p>
          ) : (
            <p>{result.text}</p>
          )}
        </div>
      </div>
    </div>
  );
}