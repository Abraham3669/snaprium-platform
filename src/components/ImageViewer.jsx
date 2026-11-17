// src/components/ImageViewer.jsx
// Full-screen photo viewer: pinch to zoom, drag to pan when zoomed, double-tap to zoom,
// mouse wheel on desktop. The Close button always sits below the iPhone status bar / Dynamic Island.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MAX = 5;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export default function ImageViewer({ url, onClose }) {
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map());
  const start = useRef(null);
  const lastTap = useRef(0);
  const moved = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!url) return undefined;
    setT({ s: 1, x: 0, y: 0 });
    const onKey = (e) => e.key === "Escape" && closeRef.current?.();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [url]);

  if (!url) return null;

  const dist = () => {
    const [a, b] = [...pts.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    start.current = { d: pts.current.size === 2 ? dist() : 0, t, x: e.clientX, y: e.clientY };
  };

  const onMove = (e) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const st = start.current;
    if (!st) return;
    if (pts.current.size === 2) {
      if (!st.d) { start.current = { d: dist(), t, x: e.clientX, y: e.clientY }; return; }
      moved.current = true;
      const s = clamp(st.t.s * (dist() / st.d), 1, MAX);
      setT({ s, x: s === 1 ? 0 : st.t.x, y: s === 1 ? 0 : st.t.y });
    } else if (t.s > 1) {
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
      setT({ s: st.t.s, x: st.t.x + dx, y: st.t.y + dy });
    }
  };

  const onUp = (e) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size === 1) {
      const [p] = [...pts.current.values()];
      start.current = { d: 0, t, x: p.x, y: p.y };
    } else if (pts.current.size === 0) {
      if (!moved.current) {
        const now = Date.now();
        if (now - lastTap.current < 300) {
          setT((c) => (c.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 }));
          lastTap.current = 0;
        } else lastTap.current = now;
      }
      start.current = null;
    }
  };

  const onWheel = (e) => {
    setT((c) => {
      const s = clamp(c.s * (e.deltaY < 0 ? 1.15 : 0.87), 1, MAX);
      return { s, x: s === 1 ? 0 : c.x, y: s === 1 ? 0 : c.y };
    });
  };

  return createPortal(
    <div className="iv-root" role="dialog" aria-modal="true">
      <div className="iv-bar">
        <button type="button" className="iv-close" onClick={onClose}>Close</button>
      </div>
      <div
        className="iv-stage"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        <img
          src={url}
          alt=""
          draggable={false}
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }}
        />
      </div>
    </div>,
    document.body
  );
}