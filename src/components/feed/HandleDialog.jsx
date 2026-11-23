// src/components/feed/HandleDialog.jsx  -  choose (or change) your @username
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HANDLE_COOLDOWN_DAYS, HANDLE_MAX, HANDLE_MIN, checkHandle, claimHandle, cleanHandle, isHandleFree, nextChangeAt, suggestHandle } from "../../lib/handles";

// current = the handle you have now ("" for the first time). card = your public card (to know when a change is allowed).
export default function HandleDialog({ user, current = "", card = null, onClose, onDone }) {
  const [value, setValue] = useState(current || suggestHandle(user?.displayName));
  const [state, setState] = useState({ kind: "idle", msg: "" }); // idle | checking | free | taken | bad | saving | error
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const wait = current ? nextChangeAt(card) : null;
  const h = cleanHandle(value);

  useEffect(() => {
    inputRef.current?.focus();
    const k = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onClose]);

  // Check as they type (after a short pause).
  useEffect(() => {
    if (!h || h === current) return setState({ kind: "idle", msg: "" });
    const bad = checkHandle(h);
    if (bad) return setState({ kind: "bad", msg: bad });
    setState({ kind: "checking", msg: "Checking…" });
    let off = false;
    const t = setTimeout(async () => {
      const free = await isHandleFree(h, user?.uid);
      if (off) return;
      setState(free === true ? { kind: "free", msg: "Available" } : free === false ? { kind: "taken", msg: "That username is taken" } : { kind: "idle", msg: "" });
    }, 350);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, [h, current, user?.uid]);

  const save = async (e) => {
    e?.preventDefault();
    if (busy || wait) return;
    const bad = checkHandle(h);
    if (bad) return setState({ kind: "bad", msg: bad });
    setBusy(true);
    try {
      const done = await claimHandle(user, h, current);
      onDone?.(done);
      onClose();
    } catch (err) {
      setState({ kind: "error", msg: err?.message || "Could not save the username" });
      setBusy(false);
    }
  };

  const ok = !wait && !busy && h && h !== current && !checkHandle(h) && state.kind !== "taken" && state.kind !== "checking";

  return createPortal(
    <div className="fd-modal-back" onClick={busy ? undefined : onClose}>
      <form className="fd-modal fd-handle-dialog" role="dialog" aria-modal="true" aria-labelledby="fd-handle-title" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="fd-modal-head">
          <h2 id="fd-handle-title">{current ? "Change username" : "Choose your username"}</h2>
        </div>
        <p className="fd-handle-hint">
          {current
            ? `People can find you by it. You can change it once every ${HANDLE_COOLDOWN_DAYS} days.`
            : "People can find you and mention you by it. It is not your email, and nobody sees your email."}
        </p>
        {wait ? (
          <p className="fd-handle-msg bad" role="alert">You can change your username again on {wait.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}.</p>
        ) : (
          <>
            <label className="fd-handle-field">
              <span className="fd-handle-at">@</span>
              <input
                ref={inputRef}
                value={value.replace(/^@+/, "")}
                onChange={(e) => setValue(e.target.value.replace(/\s/g, "").slice(0, HANDLE_MAX + 5))}
                placeholder="yourname"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={HANDLE_MAX + 5}
                aria-label="Username"
              />
            </label>
            <p className={`fd-handle-msg ${state.kind}`} role="status">
              {state.msg || `${HANDLE_MIN} to ${HANDLE_MAX} characters: letters, numbers and underscores.`}
            </p>
          </>
        )}
        <div className="fd-dialog-actions">
          <button type="button" className="fd-btn" onClick={onClose} disabled={busy}>Cancel</button>
          {!wait && (
            <button type="submit" className="fd-btn primary" disabled={!ok}>{busy ? "Saving…" : current ? "Save" : "Continue"}</button>
          )}
        </div>
      </form>
    </div>,
    document.body
  );
}