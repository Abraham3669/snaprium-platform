// src/components/feed/ReplyBox.jsx  -  the box you write a reply in (under a post, or under someone's reply)
import { useEffect, useRef, useState } from "react";
import { LIMITS } from "../../lib/feed";
import Avatar from "./Avatar";

// On a computer Enter sends and Shift+Enter starts a new line. On a phone or tablet Enter is always a new line
// (the Reply button sends). Ctrl/Cmd+Enter sends everywhere.
const enterSends = () => {
  try {
    return !window.matchMedia("(pointer: coarse)").matches; // phones and tablets: finger = coarse
  } catch {
    return true;
  }
};

export default function ReplyBox({ name, photo, placeholder, replyingTo = "", submitLabel = "Reply", busy = false, autoFocus = false, compact = false, dock = false, onSend, onCancel }) {
  const [text, setText] = useState("");
  const ref = useRef(null);

  // Grows with what you type (up to a limit), then scrolls.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: false });
  }, [autoFocus]);

  const send = async () => {
    const body = text.trim();
    if (busy) return;
    if (!body) return ref.current?.focus();
    const ok = await onSend(body);
    if (ok !== false) setText("");
  };

  const onKey = (e) => {
    if (e.key !== "Enter" || e.nativeEvent?.isComposing) return;
    if (e.ctrlKey || e.metaKey || (!e.shiftKey && enterSends())) {
      e.preventDefault();
      send();
    }
  };

  return (
    <form className={`fd-replybox ${compact ? "compact" : ""} ${dock ? "dock" : ""}`} onSubmit={(e) => { e.preventDefault(); send(); }}>
      <Avatar name={name} photo={photo} size={compact ? 32 : 40} />
      <div className="fd-replybox-main">
        {replyingTo && <p className="fd-replying">Replying to <strong>{replyingTo}</strong></p>}
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          maxLength={LIMITS.reply}
          rows={compact || dock ? 1 : 2}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <div className="fd-replybox-foot">
          {text.length > LIMITS.reply - 150 && <span className="fd-count warn">{LIMITS.reply - text.length}</span>}
          {onCancel && <button type="button" className="fd-btn" onClick={onCancel} disabled={busy}>Cancel</button>}
          <button type="submit" className="fd-btn primary" disabled={busy}>{busy ? "Sending…" : submitLabel}</button>
        </div>
      </div>
    </form>
  );
}