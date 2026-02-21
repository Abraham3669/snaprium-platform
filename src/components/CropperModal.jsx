import { useEffect, useRef } from "react";
import Cropper from "cropperjs";



export default function CropperModal({ file, isOpen, onClose, onCrop }) {
  const imageRef = useRef(null);
  const cropper = useRef(null);

  // Load file into image
  useEffect(() => {
    if (!file || !isOpen) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (imageRef.current) {
        imageRef.current.src = e.target.result;

        // Initialize cropper after image loads
        imageRef.current.onload = () => {
          if (cropper.current) cropper.current.destroy();
          cropper.current = new Cropper(imageRef.current, {
            viewMode: 1,
            dragMode: "crop",
            autoCropArea: 0.8,
            responsive: true,
            movable: true,
            zoomable: true,
            cropBoxResizable: true,
          });
        };
      }
    };
    reader.readAsDataURL(file);

    // Cleanup on unmount or file change
    return () => {
      if (cropper.current) {
        cropper.current.destroy();
        cropper.current = null;
      }
    };
  }, [file, isOpen]);

  const handleCrop = () => {
    if (!cropper.current) return;

    const canvas = cropper.current.getCroppedCanvas({
      imageSmoothingQuality: "high",
    });
    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    onCrop(croppedDataUrl);

    cropper.current.destroy();
    cropper.current = null;
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="crop-modal">
      <div className="crop-header">
        <button className="back-btn" onClick={onClose}>Cancel</button>
        <h3>Adjust & Solve</h3>
        <div></div>
      </div>
      <div className="crop-body">
        <div className="cropper-wrapper">
          <img
            ref={imageRef}
            alt="To crop"
            style={{ maxWidth: "100%", maxHeight: "80vh" }}
          />
        </div>
      </div>
      <div className="crop-footer">
        <button className="solve-btn" onClick={handleCrop}>Solve</button>
      </div>
    </div>
  );
}