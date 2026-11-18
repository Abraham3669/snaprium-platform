// src/components/DmPanel.jsx
//
// One private conversation with a friend. Full screen on a phone, a tall window on a PC.
// Text and photos, delete your own message, report theirs. Only works between friends.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { useFriendship, pairId } from "../lib/friends";
import { deleteDm, markDmRead, sendDm, useDmMessages } from "../lib/dms";
import { useLiveProfiles } from "../lib/publicProfile";
import { useBlocked } from "../lib/moderation";
import { isClean, FILTER_MESSAGE } from "../lib/contentFilter";
import { ReportDialog } from "./ModerationDialogs";
import ImageViewer from "./ImageViewer";
import "../styles/community-chat.css";
import "../styles/dm.css";

function compressImage(file, max = 900, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const dateOf = (t) => t?.toDate?.() || (t ? new Date(t) : null);
const clock = (t) => {
  const d = dateOf(t);
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
};
const dayKey = (t) => {
  const d = dateOf(t);
  return d && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : "";
};
function dayLabel(t) {
  const d = dateOf(t);
  if (!d) return "";
  const now = new Date();
  const y = new Date();
  y.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(y)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function sameRun(a, b) {
  if (!a || !b || a.uid !== b.uid) return false;
  const ta = a.createdAt?.toMillis?.() || 0;
  const tb = b.createdAt?.toMillis?.() || 0;
  return !!ta && !!tb && tb - ta < 4 * 60 * 1000 && dayKey(a.createdAt) === dayKey(b.createdAt);
}

function linkify(text) {
  return String(text || "").split(/(https?:\/\/[^\s<]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="cc-link">{part}</a>
    ) : (
      part
    )
  );
}

// A private chat that looks and feels like a circle's chat: same header, rows, composer.
export default function DmPanel({ other, fallback = {}, onClose }) {
  const { user } = useAuth();
  const me = user?.uid || "";
  const profiles = useLiveProfiles([other]);
  const name = profiles[other]?.displayName || fallback.name || "Member";
  const photo = profiles[other]?.photoURL || fallback.photo || "";
  const { status } = useFriendship(me, other);
  const { blocked } = useBlocked(me);
  const { messages, loading } = useDmMessages(me, other);
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [sending, setSending] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [report, setReport] = useState(null);
  const [lightbox, setLightbox] = useState("");
  const feedRef = useRef(null);
  const fileRef = useRef(null);
  const menuRef = useRef(null);
  const longPress = useRef(null);

  const canSend = status === "friends" && !blocked.has(other);
  const meInfo = useMemo(
    () => ({ uid: me, displayName: user?.displayName || "Member", photoURL: user?.photoURL || "" }),
    [me, user?.displayName, user?.photoURL]
  );
  const myName = user?.displayName || "Member";
  const myPhoto = user?.photoURL || "";

  useEffect(() => {
    if (!me || !other || loading) return;
    markDmRead(me, other).catch(() => {});
  }, [me, other, loading, messages.length]);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !report && !lightbox && !confirmDelete) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, report, lightbox, confirmDelete]);

  useEffect(() => {
    if (!menuFor) return undefined;
    const away = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuFor(null);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
    };
  }, [menuFor]);

  const send = async (e) => {
    e?.preventDefault?.();
    const body = text.trim();
    if ((!body && !image) || sending || !canSend) return;
    if (!isClean(body)) {
      toast.error(FILTER_MESSAGE);
      return;
    }
    setSending(true);
    const keepText = text;
    const keepImage = image;
    setText("");
    setImage("");
    try {
      await sendDm(meInfo, other, { text: body, imageUrl: keepImage });
    } catch {
      setText(keepText);
      setImage(keepImage);
      toast.error("Could not send. You can only message friends.");
    } finally {
      setSending(false);
    }
  };

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImage(await compressImage(file));
    } catch {
      toast.error("Could not use that photo");
    }
  };

  const confirmRemove = async () => {
    const m = confirmDelete;
    setConfirmDelete(null);
    if (!m) return;
    try {
      await deleteDm(me, other, m.id);
    } catch {
      toast.error("Could not delete message");
    }
  };

  const visible = messages.filter((m) => m.uid === me || !blocked.has(m.uid));

  return createPortal(
    <>
      <div className="cc-frame dm-frame" role="dialog" aria-modal="true" aria-label={`Messages with ${name}`}>
        <section className="cc-main">
          <header className="cc-top">
            <button type="button" className="cc-back" onClick={onClose} aria-label="Back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className="cc-top-copy">
              <h1>{name}</h1>
              <p>Direct message</p>
            </div>
            <div className="cc-faces">
              <span className="cc-face" title={name}>
                {photo ? <img src={photo} alt="" /> : name.slice(0, 1).toUpperCase()}
              </span>
              <button type="button" className="cc-icon-btn dm-close" onClick={onClose} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
              </button>
            </div>
          </header>

          <div className="cc-feed" ref={feedRef}>
            {loading ? (
              <p className="cc-muted">Loading…</p>
            ) : visible.length === 0 ? (
              <div className="cc-empty">
                <span className="cc-empty-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" strokeLinejoin="round" /></svg>
                </span>
                <strong>Say hi to {name}</strong>
                <p>This is a private chat between the two of you.</p>
              </div>
            ) : (
              visible.map((m, i) => {
                const mine = m.uid === me;
                const prev = visible[i - 1];
                const grouped = sameRun(prev, m);
                const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                const nm = mine ? myName : name;
                const ph = mine ? myPhoto : photo;
                const time = clock(m.createdAt);
                return (
                  <Fragment key={m.id}>
                    {newDay && dayKey(m.createdAt) ? (
                      <div className="cc-date-divider" role="separator"><span>{dayLabel(m.createdAt)}</span></div>
                    ) : null}
                    <article
                      data-mid={m.id}
                      className={`cc-post ${mine ? "mine" : ""} ${grouped ? "grouped" : ""} ${menuFor === m.id ? "menu-open" : ""}`}
                      onTouchStart={() => { longPress.current = setTimeout(() => setMenuFor(m.id), 450); }}
                      onTouchEnd={() => clearTimeout(longPress.current)}
                      onTouchMove={() => clearTimeout(longPress.current)}
                    >
                      <header className="cc-post-head">
                        {!grouped && (
                          <span className="cc-avatar-btn" aria-hidden="true">
                            {ph ? <img className="cc-avatar" src={ph} alt="" /> : <span className="cc-avatar cc-avatar-fallback">{nm.slice(0, 1).toUpperCase()}</span>}
                          </span>
                        )}
                        {!grouped && (
                          <span className="cc-name-line">
                            <strong>{nm}</strong>
                            {time ? <time>{time}</time> : null}
                          </span>
                        )}
                        <div className="cc-post-menu-wrap">
                          <button type="button" className="cc-more-btn" aria-label="Message actions" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}>⋯</button>
                          {menuFor === m.id && (
                            <div className="cc-post-menu" ref={menuRef}>
                              {mine ? (
                                <button type="button" className="danger" onClick={() => { setConfirmDelete(m); setMenuFor(null); }}>Delete</button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuFor(null);
                                    setReport({
                                      kind: "dm",
                                      communityId: "",
                                      boardId: pairId(me, other),
                                      contentId: m.id,
                                      contentUid: other,
                                      contentName: name,
                                      preview: m.text || "[photo]",
                                    });
                                  }}
                                >
                                  Report
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </header>
                      {grouped && time ? <time className="cc-hover-time">{time}</time> : null}
                      {m.imageUrl ? (
                        <button type="button" className="cc-media-btn" onClick={() => setLightbox(m.imageUrl)}>
                          <img src={m.imageUrl} alt="" className="cc-msg-photo" />
                        </button>
                      ) : null}
                      {m.text ? (
                        <div className="cc-md cc-user-md">
                          <p>{linkify(m.text)}</p>
                        </div>
                      ) : null}
                    </article>
                  </Fragment>
                );
              })
            )}
          </div>

          {canSend ? (
            <div className="cc-composer-wrap">
              {image && (
                <div className="cc-replying">
                  <img src={image} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
                  <span>Add a message, then send</span>
                  <button type="button" onClick={() => setImage("")}>×</button>
                </div>
              )}
              <form className="cc-composer" onSubmit={send}>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
                <button type="button" className="cc-icon-btn" onClick={() => fileRef.current?.click()} aria-label="Photo">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5.5-5-6.5 7" /></svg>
                </button>
                <textarea
                  className="cc-composer-input"
                  rows={1}
                  value={text}
                  maxLength={2000}
                  placeholder={`Message ${name}…`}
                  onChange={(e) => {
                    setText(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(e);
                    }
                  }}
                />
                <button type="submit" className="cc-send" disabled={sending || (!text.trim() && !image)} aria-label="Send">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 2L11 13" strokeLinecap="round" /><path d="M22 2l-7 20-4-9-9-4 20-7z" strokeLinejoin="round" /></svg>
                </button>
              </form>
            </div>
          ) : (
            <div className="cc-composer-wrap">
              <p className="cc-muted" style={{ textAlign: "center" }}>
                {blocked.has(other) ? "You blocked this person." : "You can only message people who are your friends."}
              </p>
            </div>
          )}
        </section>
      </div>

      <ImageViewer url={lightbox} onClose={() => setLightbox("")} />
      {report && <ReportDialog info={report} user={user} onClose={() => setReport(null)} />}
      {confirmDelete && (
        <div className="cc-confirm dm-confirm" onClick={() => setConfirmDelete(null)}>
          <div className="cc-confirm-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Delete this message?</h3>
            <p>This can't be undone.</p>
            <div className="cc-confirm-actions">
              <button type="button" className="cc-confirm-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button type="button" className="cc-confirm-delete" onClick={confirmRemove} autoFocus>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}