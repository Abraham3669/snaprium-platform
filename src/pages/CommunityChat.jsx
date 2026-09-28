// src/pages/CommunityChat.jsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import StudyCall from "../components/StudyCall";
import UpgradeModal from "../components/UpgradeModal";
import "../styles/community-chat.css";
import {
  getCommunity,
  listBoards,
  subscribeToCommunityMessages,
  sendCommunityMessage,
} from "../lib/communities";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

const FREE_ROOM_AI_LIMIT = 5;
const PAID_ROOM_AI_LIMIT = 40;
const getToday = () => new Date().toISOString().split("T")[0];

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

function fixCommonMathGlue(text) {
  if (!text) return text;
  return text.replace(/(\$[^\s$]{1,60}?)\$\$/g, "$1$");
}

function prepareMathForKaTeX(rawText) {
  if (!rawText) return "";
  let text = rawText;
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, "$$$$$1$$$$");
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, "$$$1$$");
  text = text.replace(/\$\$[\s\n]+/g, "$$").replace(/[\s\n]+\$\$/g, "$$");
  return text;
}

function isLiveBoard(board) {
  const slug = String(board?.slug || "").toLowerCase();
  const name = String(board?.name || "").toLowerCase();
  return slug === "session" || name === "session" || name === "live";
}

function uniqueBoards(rows) {
  return (rows || []).filter(
    (b, i, arr) =>
      arr.findIndex((x) => x.id === b.id || (x.slug && x.slug === b.slug)) === i
  );
}

function IconBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconVideo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="6" width="13" height="12" rx="2" />
      <path d="M15 10l7-3v10l-7-3z" />
    </svg>
  );
}
function IconPhoto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M21 16l-5.5-5-6.5 7" />
    </svg>
  );
}
function IconAI() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-4.9L6 9.4l4.4-1.6L12 3z" />
      <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 2L11 13" strokeLinecap="round" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" strokeLinejoin="round" />
    </svg>
  );
}



function IconEmoji() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14c1.2 1.4 2.5 2 4 2s2.8-.6 4-2" strokeLinecap="round" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

export default function CommunityChat() {
  const { communityId } = useParams();
  const [params, setParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const photoRef = useRef(null);
  const feedRef = useRef(null);
  const typingTimer = useRef(null);

  const [community, setCommunity] = useState(null);
  const [boards, setBoards] = useState([]);
  const [boardId, setBoardId] = useState(params.get("board") || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [callOpen, setCallOpen] = useState(false);
  const [askingAI, setAskingAI] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [typingNames, setTypingNames] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [replyTo, setReplyTo] = useState(null);

  const isPaid = user?.plan === "unlimited" || user?.plan === "premium";
  const today = getToday();
  const usedRoomAI = user?.lastRoomAIDate === today ? user?.dailyRoomAI || 0 : 0;
  const activeBoard = boards.find((b) => b.id === boardId) || boards[0];
  const activeBoardId = activeBoard?.id || boardId || "general";
  const liveBoard = isLiveBoard(activeBoard);


    

  const typingRef = user?.uid
    ? doc(db, "communities", communityId, "typing", user.uid)
    : null;

  const liveName = (msg) => {
    if (msg.isAI) return "Snaprium AI";
    return profiles[msg.uid]?.displayName || msg.displayName || "Member";
  };
  const livePhoto = (msg) => {
    if (msg.isAI) return "";
    return profiles[msg.uid]?.photoURL || msg.photoURL || "";
  };



const boardPeople = [];
  const seen = new Set();
  messages.forEach((m) => {
    if (!m.uid || m.isAI || seen.has(m.uid)) return;
    seen.add(m.uid);
    boardPeople.push({
      uid: m.uid,
      name: liveName(m),
      photo: livePhoto(m),
    });
  });



  const clearTyping = async () => {
    if (!typingRef) return;
    try {
      await deleteDoc(typingRef);
    } catch {}
  };

  const pulseTyping = async () => {
    if (!typingRef || !user) return;
    try {
      await setDoc(typingRef, {
        uid: user.uid,
        boardId: activeBoardId,
        displayName: user.displayName || "Member",
        at: serverTimestamp(),
      });
    } catch {}
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(clearTyping, 2500);
  };

  useEffect(() => {
    (async () => {
      const data = await getCommunity(communityId);
      setCommunity(data);
      if (!data) return;
      const rows = uniqueBoards(await listBoards(data.id));
      setBoards(rows);
      const fromUrl = params.get("board");
      const next =
        rows.find((b) => b.id === fromUrl) ||
        rows.find((b) => b.slug === "general") ||
        rows[0];
      if (next) {
        setBoardId(next.id);
        if (fromUrl !== next.id) setParams({ board: next.id }, { replace: true });
      }
    })();
  }, [communityId]);

  useEffect(() => {
    const ids = community?.members || [];
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      const next = {};
      await Promise.all(
        ids.slice(0, 40).map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
              const d = snap.data();
              next[uid] = { displayName: d.displayName || "", photoURL: d.photoURL || "" };
            }
          } catch {}
        })
      );
      if (!cancelled) setProfiles(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [community]);

  useEffect(() => {
    if (user?.uid) {
      setProfiles((prev) => ({
        ...prev,
        [user.uid]: {
          displayName: user.displayName || prev[user.uid]?.displayName || "",
          photoURL: user.photoURL || prev[user.uid]?.photoURL || "",
        },
      }));
    }
  }, [user?.uid, user?.displayName, user?.photoURL]);

  useEffect(() => {
    if (!liveBoard && callOpen) setCallOpen(false);
  }, [liveBoard, callOpen]);

  useEffect(() => {
    if (!user?.uid || !community || !activeBoardId) return;
    if (!(community.members || []).includes(user.uid)) return;
    const unsub = subscribeToCommunityMessages(
      communityId,
      setMessages,
      activeBoardId,
      activeBoard?.slug || ""
    );
    return () => unsub && unsub();
  }, [communityId, user?.uid, community, activeBoardId]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "communities", communityId, "typing"), (snap) => {
      const now = Date.now();
      const names = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((row) => {
          if (row.uid === user?.uid) return false;
          if (row.boardId && row.boardId !== activeBoardId) return false;
          const t = row.at?.toMillis?.() || 0;
          return !t || now - t < 4000;
        })
        .map((row) => row.displayName || "Someone");
      setTypingNames(names);
    });
    return () => unsub();
  }, [communityId, activeBoardId, user?.uid]);

  useEffect(
    () => () => {
      clearTimeout(typingTimer.current);
      clearTyping();
    },
    [activeBoardId]
  );

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, askingAI]);

  const isMember = user && community && (community.members || []).includes(user.uid);

  const switchBoard = (id) => {
    setBoardId(id);
    setParams({ board: id });
    setMessages([]);
    setCallOpen(false);
    setReplyTo(null);
    clearTyping();
  };

  const canUseAI = () => {
    const limit = isPaid ? PAID_ROOM_AI_LIMIT : FREE_ROOM_AI_LIMIT;
    if (usedRoomAI >= limit) {
      if (!isPaid) setShowUpgradeModal(true);
      toast.info(isPaid ? "Group AI resets tomorrow." : "Free group AI limit reached.");
      return false;
    }
    return true;
  };

  const askAI = async (question) => {
    if (!canUseAI() || askingAI) return;
    setAskingAI(true);
    try {
      const { postAPI } = await import("../utils/apiClient");
      const lastImage = [...messages].reverse().find((m) => m.imageUrl)?.imageUrl || "";
      const res = await postAPI("/api/community-ai", {
        roomId: communityId,
        topic: `${community?.name || "Circle"} · ${activeBoard?.name || "Board"}`,
        question,
        imageUrl: lastImage?.startsWith("http") ? lastImage : "",
        imageBase64: lastImage?.startsWith("data:") ? lastImage.split(",")[1] : "",
        recentMessages: messages.slice(-8).map((m) => ({
          role: m.isAI ? "assistant" : "user",
          content: m.text,
        })),
      });
      await sendCommunityMessage(communityId, {
        boardId: activeBoardId,
        text: res.answer || "I couldn't respond right now.",
        uid: "snaprium-ai",
        displayName: "Snaprium AI",
        photoURL: "",
        isAI: true,
        type: "text",
      });
      if (user?.uid) {
        await updateDoc(doc(db, "users", user.uid), {
          dailyRoomAI: usedRoomAI + 1,
          lastRoomAIDate: today,
          updatedAt: serverTimestamp(),
        });
        refreshUser?.();
      }
    } catch {
      toast.error("AI is unavailable right now");
    } finally {
      setAskingAI(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || !user || !isMember) return;
    setInput("");
    clearTyping();
    const quoted = replyTo;
    setReplyTo(null);
    try {
      await sendCommunityMessage(communityId, {
        boardId: activeBoardId,
        text,
        uid: user.uid,
        displayName: user.displayName || "Member",
        photoURL: user.photoURL || "",
        isAI: false,
        type: "text",
        replyTo: quoted
          ? {
              id: quoted.id,
              displayName: liveName(quoted),
              text: String(quoted.text || "").slice(0, 140),
            }
          : null,
      });
      if (/(^|\s)@(ai|snaprium)\b/i.test(text)) askAI(text);
    } catch {
      setInput(text);
      setReplyTo(quoted);
      toast.error("Could not send");
    }
  };

  const handleAskAI = () => {
    const text = input.trim();
    if (!text && !messages.some((m) => m.imageUrl)) return;
    setInput("");
    askAI(text || "Help the group with this.");
  };

  const handleSharePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isMember) return;
    try {
      const imageUrl = await compressImage(file);
      await sendCommunityMessage(communityId, {
        boardId: activeBoardId,
        text: "Shared a photo",
        imageUrl,
        type: "image",
        uid: user.uid,
        displayName: user.displayName || "Member",
        photoURL: user.photoURL || "",
        isAI: false,
      });
    } catch {
      toast.error("Could not share photo");
    }
  };

  const frame = (inner) => createPortal(<div className="cc-frame">{inner}</div>, document.body);

  if (!community) {
    return frame(<p className="cc-muted">Opening board…</p>);
  }

  if (user && !isMember) {
    return frame(
      <>
        <p className="cc-muted">Join this circle to use boards.</p>
        <button type="button" className="cc-session-btn" onClick={() => navigate(`/community/${communityId}`)}>
          Back
        </button>
      </>
    );
  }

  return frame(
    <>
      <aside className="cc-rail">
        <p className="cc-rail-label">Boards</p>
        {boards.map((board) => (
          <button
            key={board.id}
            type="button"
            className={`cc-board-chip ${board.id === activeBoardId ? "on" : ""}`}
            onClick={() => switchBoard(board.id)}
          >
            {board.name}
          </button>
        ))}
      </aside>

      <section className="cc-main">
        <header className="cc-top">
          <button
            type="button"
            className="cc-back"
            onClick={() => navigate(`/community/${communityId}`)}
            aria-label="Back to circle"
          >
            <IconBack />
          </button>
          <div className="cc-top-copy">
            <h1>{community.name}</h1>
            <p>{activeBoard?.name || "Board"}</p>
          </div>
          {liveBoard ? (
            <button
              type="button"
              className={`cc-session-btn ${callOpen ? "on" : ""}`}
              onClick={() => setCallOpen((v) => !v)}
            >
              <IconVideo />
              {callOpen ? "End" : "Session"}
            </button>
          ) : (
                        <div className="cc-faces">
              {boardPeople.slice(0, 6).map((p) => (
                <button
                  key={p.uid}
                  type="button"
                  className="cc-face"
                  title={p.name}
                  onClick={() => p.uid === user?.uid && navigate("/profile")}
                >
                  {p.photo ? (
                    <img src={p.photo} alt="" />
                  ) : (
                    (p.name || "?").slice(0, 1).toUpperCase()
                  )}
                </button>

                
              ))}




          
            </div>
          )}
        </header>

        {liveBoard && callOpen && (
          <div className="cc-session">
            <StudyCall
              roomId={`community-${community.id}-session`}
              user={user}
              onClose={() => setCallOpen(false)}
            />
          </div>
        )}

        <div className="cc-feed" ref={feedRef}>
          {messages.length === 0 && <p className="cc-muted">No messages in this board yet.</p>}
          {messages.map((msg) => {
            const name = liveName(msg);
            const photo = livePhoto(msg);
            return (
              <article
                key={msg.id}
                className={`cc-post ${msg.isAI ? "ai" : ""} ${msg.uid === user?.uid ? "mine" : ""}`}
              >
                <header className="cc-post-head">
                           <button
                    type="button"
                    className="cc-avatar-btn"
                    onClick={() => msg.uid === user?.uid && navigate("/profile")}
                  >
                    {photo ? (
                      <img className="cc-avatar" src={photo} alt="" />
                    ) : (
                      <span className="cc-avatar cc-avatar-fallback">
                        {(name || "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </button>


            


                  <span>
                    {name}
                    {msg.isAI ? " · AI" : ""}
                  </span>
                  {!msg.isAI && (
                    <button type="button" className="cc-reply-btn" onClick={() => setReplyTo(msg)}>
                      Reply
                    </button>
                  )}
                </header>
                {msg.replyTo && (
                  <div className="cc-quote">
                    <strong>{msg.replyTo.displayName}</strong>
                    <span>{msg.replyTo.text}</span>
                  </div>
                )}
                {msg.imageUrl && <img src={msg.imageUrl} alt="" />}
                {msg.text && msg.isAI ? (
                  <div className="cc-md">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[[rehypeKatex, { output: "html", throwOnError: false, strict: "ignore", trust: true }]]}
                    >
                      {fixCommonMathGlue(prepareMathForKaTeX(msg.text))}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.text && <p>{msg.text}</p>
                )}
              </article>
            );
          })}
          {askingAI && (
            <article className="cc-post ai pending">
              <header>Snaprium AI</header>
              <p className="cc-typing">
                <span />
                <span />
                <span />
              </p>
            </article>
          )}
        </div>

        {typingNames.length > 0 && (
          <p className="cc-typing-label">
            {typingNames.slice(0, 2).join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
          </p>
        )}

        <div className="cc-composer-wrap">
          {replyTo && (
            <div className="cc-replying">
              <span>
                Replying to {liveName(replyTo)}: {String(replyTo.text || "").slice(0, 80)}
              </span>
              <button type="button" onClick={() => setReplyTo(null)}>
                ×
              </button>
            </div>
          )}
          <form className="cc-composer" onSubmit={handleSend}>
            <input ref={photoRef} type="file" accept="image/*" hidden onChange={handleSharePhoto} />
            <button type="button" className="cc-icon-btn" onClick={() => photoRef.current?.click()} aria-label="Photo">
              <IconPhoto />
            </button>
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (e.target.value.trim()) pulseTyping();
                else clearTyping();
              }}
              placeholder={`Message ${activeBoard?.name || "board"}…`}
            />

            <button
              type="button"
              className="cc-icon-btn"
              onClick={() => toast.info("Emojis coming soon")}
              aria-label="Emoji"
            >
              <IconEmoji />
            </button>
            <button
              type="button"
              className="cc-icon-btn"
              disabled={askingAI || (!input.trim() && !messages.some((m) => m.imageUrl))}
              onClick={handleAskAI}
              aria-label="Ask AI"
            >
              <IconAI />
            </button>
            <button type="submit" className="cc-send" disabled={!input.trim()} aria-label="Send">
              <IconSend />
            </button>
          </form>
        </div>
      </section>

      {showUpgradeModal && (
        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      )}
    </>
  );
}