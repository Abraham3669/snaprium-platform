import { useEffect, useRef } from "react";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

export default function CropperModal({ file, isOpen, onClose, onCrop }) {
  const imageRef = useRef();
  let cropper = useRef(null);

  useEffect(() => {
    if (file && isOpen) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imageRef.current.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }, [file, isOpen]);

  const initCropper = () => {
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

  useEffect(() => {
    if (imageRef.current && isOpen) {
      initCropper();
    }
  }, [isOpen]);

  const handleCrop = () => {
    if (!cropper.current) return;
    const canvas = cropper.current.getCroppedCanvas({ imageSmoothingQuality: "high" });
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
          <img ref={imageRef} alt="To crop" style={{ maxWidth: "100%", maxHeight: "80vh" }} />
        </div>
      </div>
      <div className="crop-footer">
        <button className="solve-btn" onClick={handleCrop}>Solve</button>
      </div>
    </div>
  );
}