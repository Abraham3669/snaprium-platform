export default function ResultPanel({ isOpen, image, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="result-panel">
      <div className="result-panel-header">
        <h2>Solution</h2>
        <button id="closeResult" className="close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="result-panel-content">
        <img className="result-image" src={image} alt="Cropped result" />
        <div className="solution-area">
          <p>Processing your question...</p>
        </div>
      </div>
    </div>
  );
}