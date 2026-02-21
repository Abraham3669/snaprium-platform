import { useEffect, useRef } from "react";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

export default function CropperModal({ file, isOpen, onClose, onCrop }) {
  const imageRef = useRef(null);
  const cropperRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !file || !imageRef.current) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = imageRef.current;
      if (img) {
        img.src = e.target.result;

        const onImageLoad = () => {
          if (cropperRef.current) cropperRef.current.destroy();

          cropperRef.current = new Cropper(img, {
            viewMode: 1,
            dragMode: "crop",
            autoCropArea: 0.8,
            responsive: true,
            movable: true,
            zoomable: true,
            cropBoxResizable: true,
            touchDragZoom: true,
            mouseScrollZoom: false,
          });
        };

        if (img.complete) onImageLoad();
        else img.onload = onImageLoad;
      }
    };

    reader.readAsDataURL(file);

    return () => {
      if (cropperRef.current) {
        cropperRef.current.destroy();
        cropperRef.current = null;
      }
    };
  }, [file, isOpen]);

  const handleCrop = () => {
    if (!cropperRef.current) return;

    const canvas = cropperRef.current.getCroppedCanvas({
      fillColor: "#fff",
      imageSmoothingQuality: "high",
    });

    if (canvas) onCrop(canvas.toDataURL("image/jpeg", 0.92));

    if (cropperRef.current) {
      cropperRef.current.destroy();
      cropperRef.current = null;
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="crop-modal">
      {/* Cropper Body */}
      <div className="crop-body">
        <div className="cropper-wrapper">
          <img
            ref={imageRef}
            alt="Image to crop"
            style={{ display: "block", maxWidth: "100%", maxHeight: "70vh" }}
          />
        </div>
      </div>

      {/* Footer: Cancel + Solve */}
<div className="crop-footer">
  <button className="back-btn" onClick={onClose}>
    Cancel
  </button>
  <button className="solve-btn" onClick={handleCrop}>
    Solve
  </button>
</div>
    </div>
  );
}