export default function ResultPanel({ result, onClose }) {
  if (!result) return null;

  return (
    <div className="result-panel">
      <div className="result-panel-header">
        <h2>Solution</h2>
        <button id="closeResult" className="close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="result-panel-content">
        {result.image && (
          <img className="result-image" src={result.image} alt="Cropped result" />
        )}
        <div className="solution-area">
          {result.text ? <p>{result.text}</p> : <p>Processing your question...</p>}
        </div>
      </div>
    </div>
  );
}