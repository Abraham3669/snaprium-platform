// src/components/DmPanel.jsx
//
// One private conversation with a friend. Lives inside the Messages page (src/pages/MessagesPage.jsx),
// which gives it the page frame, the profile column and the conversation list.
// Text and photos, delete your own message, report theirs. Only works between friends.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import EmojiPicker from "emoji-picker-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFriendship, pairId } from "../lib/friends";
import { deleteDm, editDm, markDmRead, sendDm, toggleDmReaction, useDmMessages } from "../lib/dms";
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

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🙏", "🎉"];
// [["👍", [uid, ...]], ...] with the empty ones removed
const reactionList = (m) =>
  Object.entries(m?.reactions || {}).filter(([, people]) => Array.isArray(people) && people.length > 0);
const EMOJI_ONLY_RE = /^(\p{Extended_Pictographic}|\u200d|\ufe0f|\s){1,12}$/u;
const isEmojiOnly = (t) => {
  const v = String(t || "").trim();
  return v.length > 0 && EMOJI_ONLY_RE.test(v);
};

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
export default function DmPanel({ other, fallback = {}, onBack, onClose, onOpenProfile }) {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const feedRef = useRef(null);
  const fileRef = useRef(null);
  const menuRef = useRef(null);
  const longPress = useRef(null);
  const pickerRef = useRef(null);

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

  // Esc closes the small things first (menu, emoji picker, reply, edit) and only then leaves Messages.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || report || lightbox || confirmDelete) return;
      if (menuFor) return setMenuFor(null);
      if (pickerOpen) return setPickerOpen(false);
      if (editingId) return;
      if (replyTo) return setReplyTo(null);
      onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, report, lightbox, confirmDelete, menuFor, pickerOpen, editingId, replyTo]);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const away = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
    };
  }, [pickerOpen]);

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
    const quoted = replyTo;
    setText("");
    setImage("");
    setReplyTo(null);
    setPickerOpen(false);
    try {
      await sendDm(meInfo, other, {
        text: body,
        imageUrl: keepImage,
        replyTo: quoted
          ? {
              id: quoted.id,
              uid: quoted.uid,
              displayName: quoted.uid === me ? myName : name,
              text: String(quoted.text || "").trim() || (quoted.imageUrl ? "Photo" : ""),
            }
          : null,
      });
    } catch {
      setText(keepText);
      setImage(keepImage);
      setReplyTo(quoted);
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

  const onReact = async (m, emoji) => {
    setMenuFor(null);
    if (!canSend) return;
    const has = (m.reactions?.[emoji] || []).includes(me);
    try {
      await toggleDmReaction(me, other, m.id, emoji, has);
    } catch {
      toast.error("Could not react");
    }
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditText(m.text || "");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };
  const saveEdit = async (m) => {
    const body = editText.trim();
    if (!body) return;
    if (body === String(m.text || "").trim()) return cancelEdit();
    if (!isClean(body)) {
      toast.error(FILTER_MESSAGE);
      return;
    }
    try {
      await editDm(me, other, m.id, body);
      cancelEdit();
    } catch {
      toast.error("Could not edit message");
    }
  };

  // Tap a quoted reply to jump to the message it answers.
  const jumpTo = (id) => {
    const el = id ? document.querySelector(`[data-mid="${id}"]`) : null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 1400);
  };

  const visible = messages.filter((m) => m.uid === me || !blocked.has(m.uid));

  const titleCopy = (
    <>
      <h1>{name}</h1>
      <p>Direct message</p>
    </>
  );

  return (
    <>
      <section className="cc-main dm-chat" aria-label={`Messages with ${name}`}>
          <header className="cc-top">
            <button type="button" className="cc-back dm-back" onClick={onBack} aria-label="Back to messages">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {onOpenProfile ? (
              <button type="button" className="cc-top-copy dm-who" onClick={onOpenProfile} aria-label={`Open ${name}'s profile`}>
                {titleCopy}
              </button>
            ) : (
              <div className="cc-top-copy">{titleCopy}</div>
            )}
            <div className="cc-faces">
              {onOpenProfile ? (
                <button type="button" className="cc-face dm-face-btn" title={`${name}'s profile`} onClick={onOpenProfile} aria-label={`Open ${name}'s profile`}>
                  {photo ? <img src={photo} alt="" /> : name.slice(0, 1).toUpperCase()}
                </button>
              ) : (
                <span className="cc-face" title={name}>
                  {photo ? <img src={photo} alt="" /> : name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <button type="button" className="dm-me-pill" onClick={() => navigate("/profile")} aria-label="Your profile" title="Your profile">
                <span className="dm-me-av">{myPhoto ? <img src={myPhoto} alt="" /> : (myName || "Me").trim().charAt(0).toUpperCase()}</span>
                Profile
              </button>
              {onClose && (
                <button type="button" className="cc-icon-btn dm-close" onClick={onClose} aria-label="Close messages">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
                </button>
              )}
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
                      {canSend && (
                        <div className="cc-rx-hover" role="toolbar" aria-label="React to message">
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className={(m.reactions?.[emoji] || []).includes(me) ? "on" : ""}
                              onClick={() => onReact(m, emoji)}
                              aria-label={`React ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
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
                            {m.edited ? <em className="cc-edited">edited</em> : null}
                          </span>
                        )}
                        <div className="cc-post-menu-wrap">
                          <button type="button" className="cc-more-btn" aria-label="Message actions" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}>⋯</button>
                          {menuFor === m.id && (
                            <div className="cc-post-menu" ref={menuRef}>
                              {canSend && (
                                <div className="cc-rx-menu">
                                  {QUICK_REACTIONS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      className={(m.reactions?.[emoji] || []).includes(me) ? "on" : ""}
                                      onClick={() => onReact(m, emoji)}
                                      aria-label={`React ${emoji}`}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {canSend && <button type="button" onClick={() => { setReplyTo(m); setMenuFor(null); }}>Reply</button>}
                              {mine && canSend && m.text && !m.imageUrl && (
                                <button type="button" onClick={() => { startEdit(m); setMenuFor(null); }}>Edit</button>
                              )}
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
                      {m.replyTo && (() => {
                        const qMine = m.replyTo.uid === me;
                        const qName = qMine ? myName : m.replyTo.displayName || name;
                        const qPhoto = qMine ? myPhoto : photo;
                        return (
                          <div
                            className="cc-quote"
                            role="button"
                            tabIndex={0}
                            onClick={() => jumpTo(m.replyTo.id)}
                            onKeyDown={(e) => e.key === "Enter" && jumpTo(m.replyTo.id)}
                          >
                            <span className="cc-quote-avatar" aria-hidden="true">
                              {qPhoto ? <img src={qPhoto} alt="" /> : <span>{qName.slice(0, 1).toUpperCase()}</span>}
                            </span>
                            <div className="cc-quote-body">
                              <strong>{qName}</strong>
                              <span>{m.replyTo.text}</span>
                            </div>
                          </div>
                        );
                      })()}
                      {m.imageUrl ? (
                        <button type="button" className="cc-media-btn" onClick={() => setLightbox(m.imageUrl)}>
                          <img src={m.imageUrl} alt="" className="cc-msg-photo" />
                        </button>
                      ) : null}
                      {editingId === m.id ? (
                        <div className="cc-edit-row">
                          <input
                            className="cc-edit-input"
                            value={editText}
                            maxLength={2000}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(m);
                              if (e.key === "Escape") {
                                e.stopPropagation();
                                cancelEdit();
                              }
                            }}
                            autoFocus
                          />
                          <button type="button" className="cc-edit-save" onClick={() => saveEdit(m)}>Save</button>
                          <button type="button" className="cc-edit-cancel" onClick={cancelEdit}>Cancel</button>
                        </div>
                      ) : m.text ? (
                        isEmojiOnly(m.text) ? (
                          <p className="cc-emoji-only">{m.text}</p>
                        ) : (
                          <div className="cc-md cc-user-md">
                            <p>
                              {linkify(m.text)}
                              {grouped && m.edited ? <em className="cc-edited"> edited</em> : null}
                            </p>
                          </div>
                        )
                      ) : null}
                      {reactionList(m).length > 0 && (
                        <div className="cc-rx-row">
                          {reactionList(m).map(([emoji, people]) => {
                            const reacted = people.includes(me);
                            return (
                              <button
                                key={emoji}
                                type="button"
                                className={`cc-rx-chip ${reacted ? "on" : ""}`}
                                onClick={() => onReact(m, emoji)}
                                disabled={!canSend}
                                aria-pressed={reacted}
                                aria-label={`${emoji} ${people.length}`}
                              >
                                <span>{emoji}</span>
                                <span className="cc-rx-count">{people.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  </Fragment>
                );
              })
            )}
          </div>

          {canSend ? (
            <div className="cc-composer-wrap">
              {replyTo && (
                <div className="cc-replying">
                  <span>
                    Replying to {replyTo.uid === me ? "yourself" : name}: {(String(replyTo.text || "").trim() || "Photo").slice(0, 80)}
                  </span>
                  <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">×</button>
                </div>
              )}
              {image && (
                <div className="cc-replying">
                  <img src={image} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
                  <span>Add a message, then send</span>
                  <button type="button" onClick={() => setImage("")}>×</button>
                </div>
              )}
              {pickerOpen && (
                <div className="cc-picker" ref={pickerRef} onMouseDown={(e) => e.stopPropagation()}>
                  <EmojiPicker
                    theme="auto"
                    emojiStyle="native"
                    width="100%"
                    height="100%"
                    lazyLoadEmojis
                    onEmojiClick={(e) => setText((v) => v + e.emoji)}
                  />
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
                <button type="button" className={`cc-icon-btn ${pickerOpen ? "on" : ""}`} onClick={() => setPickerOpen((v) => !v)} aria-label="Emoji">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M8 14c1.2 1.4 2.5 2 4 2s2.8-.6 4-2" strokeLinecap="round" /><circle cx="9" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /></svg>
                </button>
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
    </>
  );
}