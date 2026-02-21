import { useEffect, useRef } from "react";
import Cropper from "cropperjs"; // Note: default import (not named)
import "cropperjs/dist/cropper.css";

export default function CropperModal({ file, isOpen, onClose, onCrop }) {
  const imageRef = useRef(null);
  const cropperRef = useRef(null); // renamed for clarity

  useEffect(() => {
    if (!isOpen || !file || !imageRef.current) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = imageRef.current;
      if (img) {
        img.src = e.target.result;

        // Wait for image to load before initializing Cropper
        const onImageLoad = () => {
          // Destroy previous instance if exists
          if (cropperRef.current) {
            cropperRef.current.destroy();
          }

          cropperRef.current = new Cropper(img, {
            viewMode: 1,
            dragMode: "crop",
            autoCropArea: 0.8,
            responsive: true,
            movable: true,
            zoomable: true,
            cropBoxResizable: true,
            // Optional: better defaults for mobile/touch
            touchDragZoom: true,
            mouseScrollZoom: false, // optional
          });
        };

        if (img.complete) {
          onImageLoad();
        } else {
          img.onload = onImageLoad;
        }
      }
    };

    reader.readAsDataURL(file);

    // Cleanup
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
      fillColor: "#fff", // optional: white background for JPEG
      imageSmoothingQuality: "high",
    });

    if (canvas) {
      const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
      onCrop(croppedDataUrl);
    }

    // Cleanup & close
    if (cropperRef.current) {
      cropperRef.current.destroy();
      cropperRef.current = null;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="crop-modal"> {/* Add global styles or use modal library */}
      <div className="crop-header">
        <button className="back-btn" onClick={onClose}>
          Cancel
        </button>
        <h3>Adjust & Solve</h3>
        <div /> {/* spacer */}
      </div>

      <div className="crop-body">
        <div className="cropper-wrapper">
          <img
            ref={imageRef}
            alt="Image to crop"
            style={{ display: "block", maxWidth: "100%", maxHeight: "70vh" }}
          />
        </div>
      </div>

      <div className="crop-footer">
        <button className="solve-btn" onClick={handleCrop}>
          Solve
        </button>
      </div>
    </div>
  );
}