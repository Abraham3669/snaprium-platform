// src/components/feed/Composer.jsx  -  "Share something" window
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { isClean, FILTER_MESSAGE } from "../../lib/contentFilter";
import { POST_KINDS, TOPICS } from "../../lib/topics";
import { LIMITS, checkPostInput, compressPostImage, createPost } from "../../lib/feed";
import { useMyHandle } from "../../lib/handles";
import Avatar from "./Avatar";
import HandleDialog from "./HandleDialog";
import { CloseIcon, ImageIcon } from "./Icons";

const DRAFT_KEY = "snaprium_feed_draft_v1";
const loadDraft = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") || {};
  } catch {
    return {};
  }
};

// defaultKind "post" = a normal post (nothing picked). Only the Ask button opens it on "question".
export default function Composer({ user, defaultKind = "post", onClose, onPosted }) {
  const draft = useRef(loadDraft()).current;
  const [kind, setKind] = useState(defaultKind || "post");
  const [text, setText] = useState(draft.text || "");
  const [topics, setTopics] = useState(draft.topics || []);
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [hint, setHint] = useState(""); // why Post did not go through, shown right under the text
  const [askHandle, setAskHandle] = useState(false);
  const mine = useMyHandle(user?.uid);
  const askRef = useRef(false);
  askRef.current = askHandle;
  const fileRef = useRef(null);
  const areaRef = useRef(null);

  useEffect(() => {
    areaRef.current?.focus();
    const k = (e) => e.key === "Escape" && !busy && !askRef.current && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onClose]);

  // Keep what you typed if you close the window by accident.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, topics }));
    } catch {}
  }, [text, topics]);

  const toggleTopic = (id) =>
    setTopics((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : cur.length >= LIMITS.topics ? cur : [...cur, id]));

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])].slice(0, LIMITS.images - images.length);
    e.target.value = "";
    if (!files.length) return;
    setAdding(true);
    try {
      const done = [];
      for (const f of files) done.push(await compressPostImage(f));
      setImages((cur) => [...cur, ...done].slice(0, LIMITS.images));
    } catch (err) {
      toast.error(err?.message || "Could not add the picture");
    } finally {
      setAdding(false);
    }
  };

  const err = checkPostInput({ kind, text, media: images });
  const left = LIMITS.text - text.length;

  const submit = async (skipHandle = false) => {
    if (busy) return;
    if (err) {
      setHint(err);
      areaRef.current?.focus();
      return;
    }
    if (!isClean(text)) return setHint(FILTER_MESSAGE);
    // Everyone who posts has a username, so people can find them. The first time, ask for it, then carry on posting.
    if (skipHandle !== true && mine.ready && !mine.handle) return setAskHandle(true);
    setHint("");
    setBusy(true);
    try {
      const post = await createPost({ user, kind, text, topics, media: images });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      onPosted?.(post);
      onClose();
    } catch (e) {
      console.warn("[post]", e?.code || "", e?.message || e);
      const denied = /permission|insufficient/i.test(String(e?.code || "") + " " + String(e?.message || ""));
      setHint(denied ? "Could not post right now. Please try again in a moment." : e?.message || "Could not post. Please try again.");
      setBusy(false);
    }
  };

  const placeholder =
    kind === "question" ? "What are you stuck on? Add enough detail that people can help."
    : kind === "log" ? "What did you study or practise today?"
    : kind === "resource" ? "What helped you, and why?"
    : kind === "insight" ? "What did you just learn or figure out?"
    : "Share something you learned, or ask a question";

  return (
    <>
    {createPortal(
    <div className="fd-modal-back" onClick={busy ? undefined : onClose}>
      <div className="fd-modal" role="dialog" aria-modal="true" aria-labelledby="fd-comp-title" onClick={(e) => e.stopPropagation()}>
        <div className="fd-modal-head">
          <h2 id="fd-comp-title">New post</h2>
          <button type="button" className="fd-icon-btn" aria-label="Close" onClick={onClose} disabled={busy}><CloseIcon /></button>
        </div>

        <div className="fd-kinds" role="radiogroup" aria-label="Kind of post">
          {POST_KINDS.map((k) => (
            <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={`fd-chip ${kind === k.id ? "on" : ""}`} onClick={() => setKind(kind === k.id ? "post" : k.id)} title={k.hint}>
              {k.label}
            </button>
          ))}
        </div>

        <div className="fd-compose-row">
          <Avatar name={user?.displayName} photo={user?.photoURL && user.photoURL.length < 400 ? user.photoURL : ""} size={40} />
          <textarea
            ref={areaRef}
            value={text}
            maxLength={LIMITS.text + 200}
            onChange={(e) => {
              setText(e.target.value);
              if (hint) setHint("");
            }}
            placeholder={placeholder}
            rows={6}
            aria-label="Post text"
          />
        </div>

        {hint && <p className="fd-compose-hint" role="alert">{hint}</p>}

        {images.length > 0 && (
          <div className={`fd-thumbs n${images.length}`}>
            {images.map((m, i) => (
              <div
                className="fd-thumb"
                key={i}
                style={images.length === 1 && m.w && m.h ? { aspectRatio: String(Math.min(2.4, Math.max(0.75, m.w / m.h))) } : undefined}
              >
                <img src={m.url} alt="" />
                <button type="button" aria-label="Remove picture" onClick={() => setImages((c) => c.filter((_, j) => j !== i))}><CloseIcon /></button>
              </div>
            ))}
          </div>
        )}

        <div className="fd-topic-pick">
          <span className="fd-label">Topics <em>(up to {LIMITS.topics})</em></span>
          <div className="fd-chips">
            {TOPICS.map((t) => (
              <button key={t.id} type="button" aria-pressed={topics.includes(t.id)} className={`fd-chip small ${topics.includes(t.id) ? "on" : ""}`} onClick={() => toggleTopic(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fd-modal-foot">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
          <button type="button" className="fd-icon-btn wide" onClick={() => fileRef.current?.click()} disabled={busy || adding || images.length >= LIMITS.images} aria-label="Add a picture">
            <ImageIcon /> <span>{adding ? "Adding…" : "Picture"}</span>
          </button>
          <span className="fd-spacer" />
          <span className={`fd-count ${left < 100 ? "warn" : ""}`}>{left}</span>
          <button type="button" className="fd-btn primary" onClick={() => submit()} disabled={busy}>
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>,
    document.body
    )}
    {askHandle && (
        <HandleDialog
          user={user}
          onClose={() => setAskHandle(false)}
          onDone={() => {
            mine.refresh();
            setAskHandle(false);
            setTimeout(() => submit(true), 0);
          }}
        />
    )}
    </>
  );
}