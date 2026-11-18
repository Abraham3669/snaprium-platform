// src/components/ModerationDialogs.jsx
// Report dialog and Block confirmation, shared by the chat and the Questions board.
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { REPORT_REASONS, reportContent } from "../lib/moderation";

const KIND_LABEL = { message: "message", question: "question", reply: "reply", user: "person", profile: "profile", dm: "message" };

export function ReportDialog({ info, user, onClose, onAlsoBlock }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [sending, setSending] = useState(false);
  if (!info) return null;

  const submit = async () => {
    if (!reason || sending) return;
    setSending(true);
    try {
      await reportContent({ ...info, reporterId: user?.uid, reason, details });
      if (alsoBlock && onAlsoBlock) await onAlsoBlock(info);
      toast.success("Thanks. We review reports within 24 hours.");
      onClose();
    } catch {
      toast.error("Could not send the report. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div className="mod-backdrop" onClick={sending ? undefined : onClose}>
      <div className="mod-card" role="dialog" aria-modal="true" aria-labelledby="mod-rep-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="mod-rep-title">Report this {KIND_LABEL[info.kind] || "content"}</h3>
        <p className="mod-sub">Tell us what's wrong. The person won't be told you reported them.</p>
        <div className="mod-reasons" role="radiogroup" aria-label="Reason">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              className={`mod-reason ${reason === r ? "on" : ""}`}
              onClick={() => setReason(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          className="mod-details"
          rows={3}
          maxLength={500}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Add details (optional)"
        />
        {onAlsoBlock && info.contentUid && (
          <label className="mod-check">
            <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
            <span>Also block {info.contentName || "this person"}</span>
          </label>
        )}
        <div className="mod-actions">
          <button type="button" className="mod-btn" onClick={onClose} disabled={sending}>Cancel</button>
          <button type="button" className="mod-btn mod-primary" onClick={submit} disabled={!reason || sending}>
            {sending ? "Sending…" : "Send report"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function BlockDialog({ person, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  if (!person) return null;

  const go = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm(person);
      toast.success(`${person.name || "This person"} is blocked`);
      onClose();
    } catch {
      toast.error("Could not block. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="mod-backdrop" onClick={busy ? undefined : onClose}>
      <div className="mod-card" role="dialog" aria-modal="true" aria-labelledby="mod-blk-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="mod-blk-title">Block {person.name || "this person"}?</h3>
        <p className="mod-sub">
          You won't see their messages, questions, replies or notifications. You can unblock them anytime in
          Profile, Blocked users.
        </p>
        <div className="mod-actions">
          <button type="button" className="mod-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="mod-btn mod-danger" onClick={go} disabled={busy}>
            {busy ? "Blocking…" : "Block"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}