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
import { acceptDmRequest, clearDmTyping, declineDmRequest, deleteDm, editDm, markDmRead, sendDm, setDmTyping, toggleDmReaction, useDmMessages, useDmMeta, useDmTyping, useSharedCircle } from "../lib/dms";
import { useLiveProfiles, useOnline } from "../lib/publicProfile";
import { useBlocked } from "../lib/moderation";
import { isClean, FILTER_MESSAGE } from "../lib/contentFilter";
import { BlockDialog, ReportDialog } from "./ModerationDialogs";
import ImageViewer from "./ImageViewer";
import StudyCall from "./StudyCall";
import UpgradeModal from "./UpgradeModal";
import { getAuth } from "firebase/auth";
import { postAPI } from "../utils/apiClient";
import "../styles/community-chat.css";
import "../styles/dm.css";
import "../styles/dm-call.css";

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

const MENU_HEIGHT = 260; // room the message menu needs, in px
// How a reply points at the message it answers: "rail" or "elbow". Keep the same value as in CommunityChat.jsx.
const REPLY_STYLE = "rail";
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
  const online = useOnline(useMemo(() => (other ? [other] : []), [other]))[other]; // true | false | undefined (not known yet)
  const name = profiles[other]?.displayName || fallback.name || "Member";
  const photo = profiles[other]?.photoURL || fallback.photo || "";
  const { status, loading: relLoading } = useFriendship(me, other);
  const { blocked, block: blockPerson } = useBlocked(me);
  const meta = useDmMeta(me, other);
  const { messages, loading } = useDmMessages(me, other);
  const theyTyping = useDmTyping(me, other);
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [sending, setSending] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [report, setReport] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [blockInfo, setBlockInfo] = useState(null);
  const moreRef = useRef(null);
  const [lightbox, setLightbox] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const feedRef = useRef(null);
  const fileRef = useRef(null);
  const menuRef = useRef(null);
  const longPress = useRef(null);
  const pickerRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingWrite = useRef(0);

  // Who can write here:
  //  - friends, or a request the other person accepted: normal chat
  //  - nobody talked yet and you share a circle: your ONE first message goes out as a message request
  //  - you sent a request and they have not answered: you wait
  //  - they sent you a request: you accept or decline before replying
  const settled = !relLoading && !meta.loading;
  const isFriend = status === "friends";
  const normalChat = isFriend || (meta.exists && meta.accepted);
  const incomingReq = settled && !isFriend && !!meta.request && meta.request !== me && !meta.accepted;
  const waitingReq = settled && !isFriend && !!meta.request && meta.request === me && !meta.accepted;
  const shared = useSharedCircle(me, other, settled && !isFriend && !meta.exists);
  const firstRequest = settled && !isFriend && !meta.exists && !!shared.circleId;
  const canSend = !blocked.has(other) && settled && (normalChat || firstRequest);
  const [answering, setAnswering] = useState(false);
  const answer = async (accept) => {
    if (answering) return;
    setAnswering(true);
    try {
      if (accept) await acceptDmRequest(me, other);
      else {
        await declineDmRequest(me, other);
        onBack?.();
      }
    } catch {
      toast.error("Could not update. Please try again.");
    } finally {
      setAnswering(false);
    }
  };
  const otherTyping = theyTyping && canSend;
  const meInfo = useMemo(
    () => ({ uid: me, displayName: user?.displayName || "Member", photoURL: user?.photoURL || "" }),
    [me, user?.displayName, user?.photoURL]
  );
  const myName = user?.displayName || "Member";
  const myPhoto = user?.photoURL || "";

  // ---- Calls with this friend. Voice is free for everyone; video is an Orbit feature (the server enforces it too).
  const isPaid = user?.plan === "unlimited" || user?.plan === "premium" || user?.isUnlimited === true;
  const canCall = normalChat && canSend && !blocked.has(other);
  const callRoomId = me && other ? `dm-${pairId(me, other)}` : "";
  const [callKind, setCallKind] = useState(null); // null | "voice" | "video"
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [liveCall, setLiveCall] = useState(null); // { video } while your friend is in a call with the door open
  // The call can step aside so you can type in the chat while it keeps running (the Chat button in the call).
  const [callMin, setCallMin] = useState(false);
  const [callBase, setCallBase] = useState(null); // id of the last message when the call screen was last in front ("" = chat was empty)
  const lastMsgId = () => messages[messages.length - 1]?.id || "";
  const baseIdx = callBase ? messages.findIndex((m) => m.id === callBase) : -1;
  const callUnread =
    callBase === null || callMin
      ? 0
      : callBase === ""
      ? messages.filter((m) => m.uid !== me).length
      : baseIdx < 0
      ? 0
      : messages.slice(baseIdx + 1).filter((m) => m.uid !== me).length;
  const openCall = (kind) => {
    setCallMin(false);
    setCallBase(lastMsgId());
    setCallKind(kind);
  };
  const closeCall = () => {
    setCallKind(null);
    setCallMin(false);
    setCallBase(null);
  };
  const returnToCall = () => {
    setCallBase(lastMsgId());
    setCallMin(false);
  };

  const startCall = (kind) => {
    if (!canCall || callKind) return;
    if (kind === "video" && !isPaid) {
      setUpgradeOpen(true);
      return;
    }
    openCall(kind);
  };
  const joinCall = () => {
    if (!canCall || callKind) return;
    openCall(liveCall?.video ? "video" : "voice");
  };
  // The person who opens the call drops a line in the chat. It reaches the friend as a normal message
  // (bell + phone alert) and makes the "Join call" bar appear in their chat.
  const onCallConnected = (data) => {
    if (!data) return;
    // The server decides what the call really is. If you asked for video but your friend's call is voice, say so.
    const real = data.video ? "video" : "voice";
    if (callKind && callKind !== real) {
      setCallKind(real);
      if (callKind === "video") toast.info(`${name}'s call is voice only. End it and start a video call to use video.`, { autoClose: 8000 });
    }
    if (!data.created) return;
    sendDm(meInfo, other, {
      text: data.video ? "📹 Started a video call" : "📞 Started a voice call",
    }).catch(() => {});
  };

  // While a recent call line from your friend is the latest thing here, check every 15 seconds if they are still in it.
  const lastInvite = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.uid === other && /^(📞|📹) /.test(m.text || "")) return m;
    }
    return null;
  }, [messages, other]);
  const inviteId = lastInvite?.id || "";
  const inviteAt = lastInvite?.createdAt?.toMillis?.() || 0;
  useEffect(() => {
    if (!canCall || callKind || !inviteId || !inviteAt || Date.now() - inviteAt > 2 * 60 * 60 * 1000) {
      setLiveCall(null);
      return undefined;
    }
    let stop = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const idToken = await getAuth().currentUser?.getIdToken();
        if (!idToken) return;
        const r = await postAPI("/api/daily-room", { roomId: callRoomId, userName: myName, idToken, action: "status" });
        if (!stop) setLiveCall(r?.ok && r.live ? { video: !!r.video } : null);
      } catch {
        if (!stop) setLiveCall(null);
      }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [canCall, callKind, inviteId, inviteAt, callRoomId, myName]);

  useEffect(() => {
    if (!me || !other || loading) return;
    markDmRead(me, other).catch(() => {});
  }, [me, other, loading, messages.length]);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  // Your own "typing…": written at most every 2 seconds while you type, removed when you stop, send or leave.
  const stopTyping = () => {
    clearTimeout(typingTimer.current);
    if (lastTypingWrite.current) {
      lastTypingWrite.current = 0;
      clearDmTyping(me, other);
    }
  };
  const pulseTyping = () => {
    if (!canSend || !me || !other) return;
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 2500);
    const now = Date.now();
    if (lastTypingWrite.current && now - lastTypingWrite.current < 2000) return;
    lastTypingWrite.current = now;
    setDmTyping(me, other);
  };
  useEffect(
    () => () => {
      clearTimeout(typingTimer.current);
      if (lastTypingWrite.current) {
        lastTypingWrite.current = 0;
        clearDmTyping(me, other);
      }
    },
    [me, other]
  );

  // When their "typing…" line appears and you are at the bottom, stay at the bottom.
  useEffect(() => {
    const el = feedRef.current;
    if (el && otherTyping && el.scrollHeight - el.scrollTop - el.clientHeight < 140) el.scrollTop = el.scrollHeight;
  }, [otherTyping]);

  // Esc closes the small things first (menu, emoji picker, reply, edit) and only then leaves Messages.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || report || blockInfo || lightbox || confirmDelete || (callKind && !callMin) || upgradeOpen) return;
      if (moreOpen) return setMoreOpen(false);
      if (menuFor) return setMenuFor(null);
      if (pickerOpen) return setPickerOpen(false);
      if (editingId) return;
      if (replyTo) return setReplyTo(null);
      onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, report, blockInfo, moreOpen, lightbox, confirmDelete, menuFor, pickerOpen, editingId, replyTo, callKind, callMin, upgradeOpen]);

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

  // The header ⋯ menu closes when you tap anywhere else.
  useEffect(() => {
    if (!moreOpen) return undefined;
    const away = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
    };
  }, [moreOpen]);

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
    stopTyping();
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
        viaCircle: firstRequest ? shared.circleId : "",
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
      toast.error(firstRequest ? "Could not send the request. Please try again." : "Could not send. You can only message friends or people who accepted your request.");
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

  // Open the message menu. Near the bottom (next to the message box) it opens upwards so it is never hidden.
  const openMenu = (id, el) => {
    if (menuFor === id) return setMenuFor(null);
    let up = false;
    const feed = feedRef.current;
    if (feed && el) {
      const r = el.getBoundingClientRect();
      const f = feed.getBoundingClientRect();
      const below = f.bottom - r.top;
      const above = r.top - f.top;
      up = below < MENU_HEIGHT && above > below;
    }
    setMenuUp(up);
    setMenuFor(id);
  };

  // If the menu still sticks out of the message area, scroll the area so it is fully in view.
  useEffect(() => {
    if (!menuFor) return undefined;
    const id = requestAnimationFrame(() => {
      const m = menuRef.current;
      const f = feedRef.current;
      if (!m || !f) return;
      const mr = m.getBoundingClientRect();
      const fr = f.getBoundingClientRect();
      if (mr.bottom > fr.bottom) f.scrollTop += mr.bottom - fr.bottom + 8;
      else if (mr.top < fr.top) f.scrollTop -= fr.top - mr.top + 8;
    });
    return () => cancelAnimationFrame(id);
  }, [menuFor, menuUp]);

  const visible = messages.filter((m) => m.uid === me || !blocked.has(m.uid));

  const titleCopy = (
    <>
      <h1>
        {name}
        {online === undefined ? null : <i className={`dm-online-inline ${online ? "" : "off"}`} role="img" aria-label={online ? "Online" : "Offline"} title={online ? "Online" : "Offline"} />}
      </h1>
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
              {canCall && (
                <div className="dmc-btns">
                  <button type="button" className="dmc-btn" onClick={() => startCall("voice")} aria-label="Voice call" title="Voice call">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  </button>
                  <button type="button" className={`dmc-btn ${isPaid ? "" : "locked"}`} onClick={() => startCall("video")} aria-label={isPaid ? "Video call" : "Video call (Orbit)"} title={isPaid ? "Video call" : "Video calls are part of Orbit"}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                    {!isPaid && <span className="dmc-dot" aria-hidden="true" />}
                  </button>
                </div>
              )}
              {onOpenProfile && (
                <div className="dm-more" ref={moreRef}>
                  <button type="button" className={`dm-more-btn ${moreOpen ? "on" : ""}`} onClick={() => setMoreOpen((v) => !v)} aria-label="More options" aria-haspopup="menu" aria-expanded={moreOpen}>
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" /></svg>
                  </button>
                  {moreOpen && (
                    <div className="dm-more-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onOpenProfile(); }}>View profile</button>
                      <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setReport({ kind: "profile", communityId: "", contentId: other, contentUid: other, contentName: name, preview: "" }); }}>Report profile</button>
                      {!blocked.has(other) && (
                        <button type="button" role="menuitem" className="danger" onClick={() => { setMoreOpen(false); setBlockInfo({ uid: other, name, photo }); }}>Block user</button>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                <span className="dm-me-label">Profile</span>
              </button>
              {onClose && (
                <button type="button" className="cc-icon-btn dm-close" onClick={onClose} aria-label="Close messages">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
                </button>
              )}
            </div>
          </header>

          {callKind && callMin && (
            <div className="dmc-join dmc-return" role="status">
              <span className="dmc-join-pulse" aria-hidden="true" />
              <span className="dmc-join-text">In a {callKind === "video" ? "video" : "voice"} call with {name}</span>
              <button type="button" onClick={returnToCall}>Return to call</button>
            </div>
          )}

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
                const grouped = sameRun(prev, m) && !m.replyTo;
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
                      className={`cc-post ${mine ? "mine" : ""} ${grouped ? "grouped" : ""} ${menuFor === m.id ? "menu-open" : ""} ${m.replyTo ? `has-reply rp-${REPLY_STYLE}` : ""}`}
                      onTouchStart={(e) => {
                        const el = e.currentTarget;
                        longPress.current = setTimeout(() => openMenu(m.id, el), 450);
                      }}
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
                      {m.replyTo && (() => {
                        const qMine = m.replyTo.uid === me;
                        const qName = qMine ? myName : m.replyTo.displayName || name;
                        const qPhoto = qMine ? myPhoto : photo;
                        return (
                          <div
                            className="cc-reply"
                            role="button"
                            tabIndex={0}
                            title="Show the original message"
                            onClick={() => jumpTo(m.replyTo.id)}
                            onKeyDown={(e) => e.key === "Enter" && jumpTo(m.replyTo.id)}
                          >
                            <span className="cc-reply-av" aria-hidden="true">
                              {qPhoto ? <img src={qPhoto} alt="" /> : <span>{qName.slice(0, 1).toUpperCase()}</span>}
                            </span>
                            <strong>{qName}</strong>
                            <span className="cc-reply-text">{m.replyTo.text}</span>
                          </div>
                        );
                      })()}
                      <header className="cc-post-head">
                        {!grouped && (
                          !mine && onOpenProfile ? (
                            <button type="button" className="cc-avatar-btn" onClick={onOpenProfile} aria-label={`Open ${nm}'s profile`}>
                              {ph ? <img className="cc-avatar" src={ph} alt="" /> : <span className="cc-avatar cc-avatar-fallback">{nm.slice(0, 1).toUpperCase()}</span>}
                            </button>
                          ) : (
                            <span className="cc-avatar-btn" aria-hidden="true">
                              {ph ? <img className="cc-avatar" src={ph} alt="" /> : <span className="cc-avatar cc-avatar-fallback">{nm.slice(0, 1).toUpperCase()}</span>}
                            </span>
                          )
                        )}
                        {!grouped && (
                          <span className="cc-name-line">
                            {!mine && onOpenProfile ? (
                              <button type="button" className="dm-name-btn" onClick={onOpenProfile}>{nm}</button>
                            ) : (
                              <strong>{nm}</strong>
                            )}
                            {time ? <time>{time}</time> : null}
                            {m.edited ? <em className="cc-edited">edited</em> : null}
                          </span>
                        )}
                        <div className="cc-post-menu-wrap">
                          <button type="button" className="cc-more-btn" aria-label="Message actions" onClick={(e) => openMenu(m.id, e.currentTarget)}>⋯</button>
                          {menuFor === m.id && (
                            <div className={`cc-post-menu ${menuUp ? "up" : ""}`} ref={menuRef}>
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

          {otherTyping && (
            <p className="cc-typing-label dm-typing" role="status" aria-live="polite">
              <span className="dm-typing-dots" aria-hidden="true"><i /><i /><i /></span>
              <span className="dm-typing-text">{name} is typing…</span>
            </p>
          )}

          {liveCall && !callKind && canCall && (
            <div className="dmc-join" role="status">
              <span className="dmc-join-pulse" aria-hidden="true" />
              <span className="dmc-join-text">{name} is in a {liveCall.video ? "video" : "voice"} call</span>
              <button type="button" onClick={joinCall}>Join call</button>
            </div>
          )}

          {canSend ? (
            <div className="cc-composer-wrap">
              {firstRequest && (
                <p className="dm-req-hint" role="note">
                  This is a message request. {name} needs to accept before you can send more.
                </p>
              )}
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
                {!firstRequest && <button type="button" className="cc-icon-btn" onClick={() => fileRef.current?.click()} aria-label="Photo">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5.5-5-6.5 7" /></svg>
                </button>}
                <textarea
                  className="cc-composer-input"
                  rows={1}
                  value={text}
                  maxLength={2000}
                  placeholder={`Message ${name}…`}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (e.target.value.trim()) pulseTyping();
                    else stopTyping();
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
          ) : incomingReq && !blocked.has(other) ? (
            <div className="cc-composer-wrap dm-req">
              <p className="dm-req-text"><strong>{name}</strong> wants to message you. You are both in a circle. They can send more once you accept.</p>
              <div className="dm-req-actions">
                <button type="button" className="dm-btn dm-btn-primary" disabled={answering} onClick={() => answer(true)}>Accept</button>
                <button type="button" className="dm-btn dm-btn-out" disabled={answering} onClick={() => answer(false)}>Decline</button>
                <button type="button" className="dm-btn dm-btn-danger" disabled={answering} onClick={() => setBlockInfo({ uid: other, name, photo })}>Block</button>
              </div>
            </div>
          ) : (
            <div className="cc-composer-wrap">
              <p className="cc-muted" style={{ textAlign: "center" }}>
                {blocked.has(other)
                  ? "You blocked this person."
                  : waitingReq
                    ? `Request sent. You can send more once ${name} accepts.`
                    : !settled || shared.loading
                      ? ""
                      : "You can message friends, or people you share a circle with."}
              </p>
            </div>
          )}
      </section>

      {callKind && callRoomId && (
        <div className={`dmc-overlay ${callMin ? "min" : ""}`} role="dialog" aria-modal={callMin ? undefined : "true"} aria-label={`${callKind === "video" ? "Video" : "Voice"} call with ${name}`}>
          <div className="dmc-top">
            <span className="dmc-av" aria-hidden="true">{photo ? <img src={photo} alt="" /> : name.slice(0, 1).toUpperCase()}</span>
            <div className="dmc-who">
              <strong>{name}</strong>
              <small>{callKind === "video" ? "Video call" : "Voice call"}</small>
            </div>
          </div>
          <div className="dmc-stage">
            <StudyCall
              dm
              video={callKind === "video"}
              roomId={callRoomId}
              user={user}
              onClose={closeCall}
              onConnected={onCallConnected}
              onOpenChat={() => setCallMin(true)}
              chatBadge={callUnread}
            />
          </div>
        </div>
      )}
      {upgradeOpen && (
        <UpgradeModal
          isOpen
          onClose={() => setUpgradeOpen(false)}
          title="Video calls are part of Orbit"
          subtitle="Voice calls with friends are free. Upgrade to Orbit to call them with video."
        />
      )}

      <ImageViewer url={lightbox} onClose={() => setLightbox("")} />
      {report && <ReportDialog info={report} user={user} onClose={() => setReport(null)} />}
      {blockInfo && <BlockDialog person={blockInfo} onClose={() => setBlockInfo(null)} onConfirm={(p) => blockPerson(p, "")} />}
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