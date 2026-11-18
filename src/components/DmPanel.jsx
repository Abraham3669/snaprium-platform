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
  const [sel, setSel] = useState("");
  const [report, setReport] = useState(null);
  const [lightbox, setLightbox] = useState("");
  const feedRef = useRef(null);
  const fileRef = useRef(null);

  const canSend = status === "friends" && !blocked.has(other);
  const meInfo = useMemo(
    () => ({ uid: me, displayName: user?.displayName || "Member", photoURL: user?.photoURL || "" }),
    [me, user?.displayName, user?.photoURL]
  );

  // Opening (and new messages arriving while open) marks the conversation read.
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
      if (e.key === "Escape" && !report && !lightbox) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, report, lightbox]);

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
      await sendDm(meInfo, other, { text: body, imageUrl: image });
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

  const visible = messages.filter((m) => m.uid === me || !blocked.has(m.uid));

  return createPortal(
    <>
      <div className="dm-frame" role="dialog" aria-modal="true" aria-label={`Messages with ${name}`}>
        <div className="dm-window">
          <header className="dm-head">
            <button type="button" className="dm-back" onClick={onClose} aria-label="Back">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="dm-who">
              <span className="dm-av">{photo ? <img src={photo} alt="" /> : name.slice(0, 1).toUpperCase()}</span>
              <strong>{name}</strong>
            </div>
          </header>

          <div className="dm-feed" ref={feedRef}>
            {loading ? (
              <p className="dm-note">Loading…</p>
            ) : visible.length === 0 ? (
              <p className="dm-note">No messages yet. Say hi to {name}.</p>
            ) : (
              visible.map((m, i) => {
                const mine = m.uid === me;
                const prev = visible[i - 1];
                const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                return (
                  <Fragment key={m.id}>
                    {newDay && dayKey(m.createdAt) ? <div className="dm-day"><span>{dayLabel(m.createdAt)}</span></div> : null}
                    <div className={`dm-row ${mine ? "mine" : ""}`}>
                      <div className="dm-bubble" onClick={() => setSel(sel === m.id ? "" : m.id)}>
                        {m.imageUrl ? (
                          <button
                            type="button"
                            className="dm-img"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightbox(m.imageUrl);
                            }}
                          >
                            <img src={m.imageUrl} alt="" />
                          </button>
                        ) : null}
                        {m.text ? <p>{m.text}</p> : null}
                        <time>{clock(m.createdAt)}</time>
                      </div>
                      {sel === m.id && (
                        <div className="dm-tools">
                          {mine ? (
                            <button
                              type="button"
                              className="danger"
                              onClick={() => {
                                setSel("");
                                deleteDm(me, other, m.id).catch(() => toast.error("Could not delete"));
                              }}
                            >
                              Delete
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSel("");
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
                  </Fragment>
                );
              })
            )}
          </div>

          {canSend ? (
            <form className="dm-composer" onSubmit={send}>
              {image && (
                <div className="dm-attach">
                  <img src={image} alt="" />
                  <button type="button" onClick={() => setImage("")} aria-label="Remove photo">×</button>
                </div>
              )}
              <div className="dm-composer-row">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
                <button type="button" className="dm-icon" onClick={() => fileRef.current?.click()} aria-label="Photo">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5.5-5-6.5 7" /></svg>
                </button>
                <textarea
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
                <button type="submit" className="dm-send" disabled={sending || (!text.trim() && !image)} aria-label="Send">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 2L11 13" strokeLinecap="round" /><path d="M22 2l-7 20-4-9-9-4 20-7z" strokeLinejoin="round" /></svg>
                </button>
              </div>
            </form>
          ) : (
            <p className="dm-locked">
              {blocked.has(other)
                ? "You blocked this person."
                : "You can only message people who are your friends."}
            </p>
          )}
        </div>
      </div>

      <ImageViewer url={lightbox} onClose={() => setLightbox("")} />
      {report && <ReportDialog info={report} user={user} onClose={() => setReport(null)} />}
    </>,
    document.body
  );
}