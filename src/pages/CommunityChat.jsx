// src/pages/CommunityChat.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import EmojiPicker from "emoji-picker-react";

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
  editCommunityMessage,
  deleteCommunityMessage,
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


const handleOf = (name) => String(name || "").replace(/\s+/g, "");
const RESERVED = /^(ai|snaprium)$/i;

// returns uids of people mentioned in text, e.g. "@abraham hi" -> [uid]
function resolveMentions(text, people) {
  const found = new Set();
  const re = /@([\p{L}\p{N}_.-]{2,})/gu;
  let m;
  while ((m = re.exec(text || ""))) {
    const token = m[1].replace(/[.-]+$/, "").toLowerCase();
    if (!token || RESERVED.test(token)) continue;
    const exact = people.filter(
      (p) =>
        handleOf(p.name).toLowerCase() === token ||
        p.name.toLowerCase().split(/\s+/)[0] === token
    );
    if (exact.length) {
      exact.forEach((p) => found.add(p.uid));
      continue;
    }
    const prefix = people.filter((p) => handleOf(p.name).toLowerCase().startsWith(token));
    if (prefix.length === 1) found.add(prefix[0].uid);
  }
  return [...found];
}


const EMOJI_ONLY_RE = /^(\p{Extended_Pictographic}|\u200d|\ufe0f|\s){1,12}$/u;
function isEmojiOnly(text) {
  const t = String(text || "").trim();
  return t.length > 0 && EMOJI_ONLY_RE.test(t);
}



// turns "@abraham hi" into text + a highlighted <span>
function renderWithMentions(text, people, myUid) {
  return String(text)
    .split(/(@[\p{L}\p{N}_.-]{2,})/gu)
    .map((part, i) => {
      if (!part.startsWith("@")) return part;
      const token = part.slice(1).replace(/[.-]+$/, "");
      const uids = resolveMentions(part, people);
      if (!RESERVED.test(token) && !uids.length) return part;
      return (
        <span key={i} className={`cc-mention ${uids.includes(myUid) ? "me" : ""}`}>
          {part}
        </span>
      );
    });
}




function autolinkMarkdown(text) {
  return String(text || "").replace(
    /(^|[\s(])((https?:\/\/|www\.)[^\s<]+[^.\s<,;:!?"')\]])/gi,
    (_, pre, url) => {
      const href = url.startsWith("http") ? url : `https://${url}`;
      return `${pre}[${url}](${href})`;
    }
  );
}

function prepareUserMessage(text) {
  // Markdown hard breaks so pasted paragraphs/newlines show up
  let t = String(text || "").replace(/\n/g, "  \n");
  t = autolinkMarkdown(t);
  return t;
}

function MessageText({ text, people, myUid, isAI }) {
  if (!text) return null;
  if (!isAI && isEmojiOnly(text)) {
    return <p className="cc-emoji-only">{text}</p>;
  }

  const source = isAI
    ? fixCommonMathGlue(prepareMathForKaTeX(text))
    : prepareUserMessage(text);

  return (
    <div className={`cc-md ${isAI ? "" : "cc-user-md"}`}>
      <ReactMarkdown
        remarkPlugins={isAI ? [remarkMath] : []}
        rehypePlugins={
          isAI
            ? [[rehypeKatex, { output: "html", throwOnError: false, strict: "ignore", trust: true }]]
            : []
        }
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="cc-link">
              {children}
            </a>
          ),
          // Keep @mentions highlighted inside text nodes when possible
          p: ({ children }) => (
            <p>
              {Array.isArray(children)
                ? children.map((child, i) =>
                    typeof child === "string"
                      ? renderWithMentions(child, people, myUid)
                      : child
                  )
                : typeof children === "string"
                ? renderWithMentions(children, people, myUid)
                : children}
            </p>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
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


function IconBoard() {
  return (
    <svg className="cc-board-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h8M8 12h8M8 15h5" strokeLinecap="round" />
    </svg>
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




function formatMsgTime(createdAt) {
  const d = createdAt?.toDate?.() || (createdAt ? new Date(createdAt) : null);
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function sameRun(a, b) {
  if (!a || !b || a.uid !== b.uid || a.isAI !== b.isAI) return false;
  const ta = a.createdAt?.toMillis?.() || 0;
  const tb = b.createdAt?.toMillis?.() || 0;
  return tb && ta && tb - ta < 4 * 60 * 1000;
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
const [pendingImage, setPendingImage] = useState("");
  const [mentionQuery, setMentionQuery] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [menuFor, setMenuFor] = useState(null);
  const menuRef = useRef(null);
  const longPressTimer = useRef(null);
  const seenRef = useRef(null);

  const isPaid = user?.plan === "unlimited" || user?.plan === "premium";
  const today = getToday();
  const usedRoomAI = user?.lastRoomAIDate === today ? user?.dailyRoomAI || 0 : 0;
  const activeBoard = boards.find((b) => b.id === boardId) || boards[0];
  const activeBoardId = activeBoard?.id || boardId || "general";
  const liveBoard = isLiveBoard(activeBoard);
  const GIF_CATEGORIES = ["Trending", "Reactions",  "Funny", "Happy", "Sad", "Celebrate"];
  



   const [pickerOpen, setPickerOpen] = useState(false);
     const [lightbox, setLightbox] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pickerTab, setPickerTab] = useState("emoji");
    const [mediaQuery, setMediaQuery] = useState("");
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
    const pickerRef = useRef(null);
    

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


    const startLongPress = (msg) => {
    longPressTimer.current = setTimeout(() => setMenuFor(msg.id), 450);
  };
  const cancelLongPress = () => {
    clearTimeout(longPressTimer.current);
  };




const boardPeople = useMemo(() => {
  const seen = new Set();
  const list = [];
  for (const m of messages) {
    if (!m.uid || m.isAI || seen.has(m.uid)) continue;
    seen.add(m.uid);
    list.push({
      uid: m.uid,
      name: liveName(m),
      photo: livePhoto(m),
    });
  }
  return list;
}, [messages, profiles]);

const mentionable = useMemo(() => {
  const map = new Map();
  for (const p of boardPeople) {
    map.set(p.uid, { uid: p.uid, name: p.name });
  }
  for (const uid of community?.members || []) {
    const name = profiles[uid]?.displayName;
    if (name) map.set(uid, { uid, name });
  }
  return [...map.values()].filter((p) => p.name && p.name !== "Member");
}, [boardPeople, community?.members, profiles]);

const suggestions = useMemo(() => {
  if (mentionQuery === null) return [];
  return [{ uid: "__ai", name: "AI" }, ...mentionable.filter((p) => p.uid !== user?.uid)]
    .filter(
      (p) =>
        handleOf(p.name).toLowerCase().startsWith(mentionQuery) ||
        p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(mentionQuery))
    )
    .slice(0, 5);
}, [mentionQuery, mentionable, user?.uid]);

  const pickMention = (p) => {
    setInput((prev) => prev.replace(/@([\p{L}\p{N}_.-]*)$/u, `@${handleOf(p.name)} `));
    setMentionQuery(null);
  };



  const clearTyping = async () => {
    if (!typingRef) return;
    try {
      await deleteDoc(typingRef);
    } catch {}
  };

  const lastTypingWrite = useRef(0);

const pulseTyping = () => {
  if (!typingRef || !user) return;

  // Clear "stop typing" timer on every key
  clearTimeout(typingTimer.current);
  typingTimer.current = setTimeout(clearTyping, 2500);

  // Write to Firestore at most once every 2 seconds
  const now = Date.now();
  if (now - lastTypingWrite.current < 2000) return;
  lastTypingWrite.current = now;

  setDoc(typingRef, {
    uid: user.uid,
    boardId: activeBoardId,
    displayName: user.displayName || "Member",
    at: serverTimestamp(),
  }).catch(() => {});
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
    if (!menuFor) return;
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuFor(null);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("touchstart", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("touchstart", onClickOutside);
    };
  }, [menuFor]);




    useEffect(() => {
    if (!pickerOpen) return;
    const onClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("touchstart", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("touchstart", onClickOutside);
    };
  }, [pickerOpen]);



   useEffect(() => {
    if (!pickerOpen || (pickerTab !== "gif" && pickerTab !== "sticker")) return;
    const key = import.meta.env.VITE_GIPHY_KEY;
    if (!key) return;
    const kind = pickerTab === "sticker" ? "stickers" : "gifs";
    const q = mediaQuery.trim();
    const url = q
      ? `https://api.giphy.com/v1/${kind}/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13`
      : `https://api.giphy.com/v1/${kind}/trending?api_key=${key}&limit=24&rating=pg-13`;
        const t = setTimeout(async () => {
      setMediaLoading(true);
      try {
        const res = await fetch(url);
        const json = await res.json();
        let items = json.data || [];
        if (!q && items.length < 20) {
          const fallback = pickerTab === "sticker" ? "sticker" : "funny";
          const res2 = await fetch(
            `https://api.giphy.com/v1/${kind}/search?api_key=${key}&q=${fallback}&limit=32&rating=pg-13`
          );
          const json2 = await res2.json();
          const seen = new Set(items.map((i) => i.id));
          items = [...items, ...(json2.data || []).filter((i) => !seen.has(i.id))];
        }
        setMediaItems(items);
      } catch (err) {
        console.error("Giphy fetch failed:", err);
        toast.error("Could not load content");
      } finally {
        setMediaLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [pickerOpen, pickerTab, mediaQuery]);


    useEffect(() => {
    setMediaQuery("");
    setMediaItems([]);
  }, [pickerTab]);



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

    const stickToBottom = useRef(true);
  const [unseen, setUnseen] = useState(0);

  const jumpToBottom = () => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickToBottom.current = true;
    setUnseen(0);
  };

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
      setUnseen(0);
    } else {
      setUnseen((n) => n + 1);
    }
  }, [messages, askingAI]);


  useEffect(() => {
    seenRef.current = null; // new board = start fresh
  }, [activeBoardId]);

  useEffect(() => {
    if (!user?.uid || !messages.length) return;
    if (!seenRef.current) {
      seenRef.current = new Set(messages.map((m) => m.id)); // don't toast old messages
      return;
    }
    messages.forEach((m) => {
      if (seenRef.current.has(m.id)) return;
      seenRef.current.add(m.id);
      if (m.uid !== user.uid && (m.mentions || []).includes(user.uid)) {
        toast.info(`${liveName(m)} mentioned you`);
      }
    });
  }, [messages]);


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

    // Find the most recent real photo (not gif/sticker)
    const lastImageMsg = [...messages]
      .reverse()
      .find((m) => m.imageUrl && m.type !== "gif" && m.type !== "sticker");

    // Last message that wasn't from the AI
    const lastUserMsg = [...messages].reverse().find((m) => !m.isAI);

    // Only attach image if it's clearly part of *this* turn
    const questionAboutImage =
      /\b(this|that|these|those|image|photo|picture|pic|screenshot|problem|question|equation|diagram|solve|above|attached|here)\b/i.test(
        question || ""
      );

    const imageIsLatestUserTurn =
      lastImageMsg &&
      lastUserMsg &&
      (lastUserMsg.id === lastImageMsg.id ||
        lastUserMsg.imageUrl === lastImageMsg.imageUrl);

    // Attach image only when:
    // 1) user just shared it (latest user message is the image), or
    // 2) the question clearly refers to a photo/problem
    const lastImage =
      lastImageMsg && (imageIsLatestUserTurn || questionAboutImage)
        ? lastImageMsg.imageUrl || ""
        : "";

    const res = await postAPI("/api/community-ai", {
      roomId: communityId,
      topic: `${community?.name || "Circle"} · ${activeBoard?.name || "Board"}`,
      question,
      imageUrl: lastImage?.startsWith("http") ? lastImage : "",
      imageBase64: lastImage?.startsWith("data:") ? lastImage.split(",")[1] : "",
      recentMessages: messages.slice(-8).map((m) => ({
        role: m.isAI ? "assistant" : "user",
        // Tell the model when a turn included an image, without forcing that image again
        content: m.imageUrl && m.type !== "gif" && m.type !== "sticker"
          ? `${m.text || "[shared a photo]"}`.trim()
          : m.text || "",
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
  const imageUrl = pendingImage;
  if ((!text && !imageUrl) || !user || !isMember) return;
  setInput("");
  setPendingImage("");
  clearTyping();
  const quoted = replyTo;
  setReplyTo(null);
  setMentionQuery(null);
  const mentions = resolveMentions(text, mentionable).filter((id) => id !== user.uid);
  try {
    await sendCommunityMessage(communityId, {
      boardId: activeBoardId,
      text,
      mentions,
      imageUrl,
      type: imageUrl ? "image" : "text",
      uid: user.uid,
      displayName: user.displayName || "Member",
      photoURL: user.photoURL || "",
      isAI: false,
      replyTo: quoted
        ? {
            id: quoted.id,
            displayName: liveName(quoted),
            text: String(quoted.text || "").slice(0, 140),
          }
        : null,
    });
    if (text && /(^|\s)@(ai|snaprium)\b/i.test(text)) askAI(text);
  } catch {
    setInput(text);
    setPendingImage(imageUrl);
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
    setPendingImage(imageUrl);
  } catch {
    toast.error("Could not share photo");
  }
};




  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditText(msg.text || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async (msg) => {
    const text = editText.trim();
    if (!text) return;
    try {
      await editCommunityMessage(communityId, msg.id, text);
      cancelEdit();
    } catch {
      toast.error("Could not edit message");
    }
  };

  const removeMessage = async (msg) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await deleteCommunityMessage(communityId, msg.id);
    } catch {
      toast.error("Could not delete message");
    }
  };




  const sendMedia = async (item, kind) => {
    if (!user || !isMember) return;
    setPickerOpen(false);
    try {
      await sendCommunityMessage(communityId, {
        boardId: activeBoardId,
        text: "",
        imageUrl: item.images.fixed_height.url,
        type: kind, // "gif" or "sticker"
        uid: user.uid,
        displayName: user.displayName || "Member",
        photoURL: user.photoURL || "",
        isAI: false,
      });
    } catch {
      toast.error(`Could not send ${kind}`);
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
                        <IconBoard />
            <span>{board.name}</span>
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
              {boardPeople.length > 6 && (
                <span className="cc-face cc-face-more">+{boardPeople.length - 6}</span>
              )}
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

                <div
          className="cc-feed"
          ref={feedRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            stickToBottom.current = near;
            if (near) setUnseen(0);
          }}
        >

                  {unseen > 0 && !stickToBottom.current && (
          <button type="button" className="cc-jump" onClick={jumpToBottom}>
            New messages
          </button>
        )}
                    {messages.length === 0 && (
            <p className="cc-muted">Nothing here yet. Ask a question, or drop a photo of the problem.</p>
          )}
                    {messages.map((msg, index) => {
            const name = liveName(msg);
            const photo = livePhoto(msg);
            const grouped = sameRun(messages[index - 1], msg);
            const time = formatMsgTime(msg.createdAt);
            return (
              <article
                key={msg.id}
                className={`cc-post ${msg.isAI ? "ai" : ""} ${msg.uid === user?.uid ? "mine" : ""} ${
                  grouped ? "grouped" : ""
                } ${(msg.mentions || []).includes(user?.uid) ? "mentioned" : ""} ${
                  menuFor === msg.id ? "menu-open" : ""
                }`}
                onTouchStart={() => !msg.isAI && startLongPress(msg)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
              >
                <header className="cc-post-head">
                                    {!grouped && (
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
                  )}
                  {!grouped && (
                    <span className="cc-name-line">
                      <strong>{name}{msg.isAI ? " · AI" : ""}</strong>
                      {time ? <time>{time}</time> : null}
                      {msg.edited ? <em className="cc-edited">edited</em> : null}
                    </span>
                  )}
                  
                  {!msg.isAI && (
                    <div className="cc-post-menu-wrap">
                      <button
                        type="button"
                        className="cc-more-btn"
                        onClick={() => setMenuFor(menuFor === msg.id ? null : msg.id)}
                        aria-label="Message actions"
                      >
                        ⋯
                      </button>
                      {menuFor === msg.id && (
                        <div className="cc-post-menu" ref={menuRef}>
                          <button type="button" onClick={() => { setReplyTo(msg); setMenuFor(null); }}>Reply</button>
                          {msg.uid === user?.uid && msg.text && !msg.imageUrl && (
                            <button type="button" onClick={() => { startEdit(msg); setMenuFor(null); }}>Edit</button>
                          )}
                          {msg.uid === user?.uid && (
                            <button type="button" className="danger" onClick={() => { removeMessage(msg); setMenuFor(null); }}>Delete</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </header>
                {msg.replyTo && (
                  <div className="cc-quote">
                    <strong>{msg.replyTo.displayName}</strong>
                    <span>{msg.replyTo.text}</span>
                  </div>
                )}
                               {msg.imageUrl && (
                  <button
                    type="button"
                    className={`cc-media-btn ${msg.type === "sticker" ? "sticker" : ""}`}
                    onClick={() => {
                      setZoom(1);
                      setLightbox(msg.imageUrl);
                    }}
                  >
                    <img
                      src={msg.imageUrl}
                      alt=""
                      className={
                        msg.type === "gif"
                          ? "cc-msg-gif"
                          : msg.type === "sticker"
                          ? "cc-msg-sticker"
                          : "cc-msg-photo"
                      }
                    />
                  </button>
                )}
{editingId === msg.id ? (
  <div className="cc-edit-row">
    <input
      className="cc-edit-input"
      value={editText}
      onChange={(e) => setEditText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") saveEdit(msg);
        if (e.key === "Escape") cancelEdit();
      }}
      autoFocus
    />
    <button type="button" className="cc-edit-save" onClick={() => saveEdit(msg)}>
      Save
    </button>
    <button type="button" className="cc-edit-cancel" onClick={cancelEdit}>
      Cancel
    </button>
  </div>
) : (
   msg.text && msg.text !== "Shared a photo" && (
    <MessageText
      text={msg.text}
      people={mentionable}
      myUid={user?.uid}
      isAI={!!msg.isAI}
    />
  )
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


{pendingImage && (
  <div className="cc-replying">
    <img src={pendingImage} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
    <span>Add a caption, then send</span>
    <button type="button" onClick={() => setPendingImage("")}>×</button>
  </div>
)}



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

          {suggestions.length > 0 && (
            <div className="cc-mention-list">
              {suggestions.map((p) => (
                <button
                  key={p.uid}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickMention(p)}
                >
                  @{handleOf(p.name)}
                </button>
              ))}
            </div>
          )}



                      {pickerOpen && (
                       <div className="cc-picker" ref={pickerRef} onMouseDown={(e) => e.stopPropagation()}>
              <div className="cc-picker-tabs">
                <button
                  type="button"
                  className={pickerTab === "emoji" ? "on" : ""}
                  onClick={() => setPickerTab("emoji")}
                >
                  Emoji
                </button>
                <button
                  type="button"
                  className={pickerTab === "gif" ? "on" : ""}
                  onClick={() => setPickerTab("gif")}
                >
                  GIF
                </button>
                <button
                  type="button"
                  className={pickerTab === "sticker" ? "on" : ""}
                  onClick={() => setPickerTab("sticker")}
                >
                  Stickers
                </button>
              </div>

              {pickerTab === "emoji" ? (
                               <EmojiPicker
                  theme="auto"
                  emojiStyle="native"
                  width="100%"
                  height="100%"
                  lazyLoadEmojis
                  onEmojiClick={(e) => setInput((v) => v + e.emoji)}
                />
              ) : (
                                <div className="cc-gif-pane">
                  <input
                    className="cc-gif-search"
                    value={mediaQuery}
                    onChange={(e) => setMediaQuery(e.target.value)}
                    placeholder={pickerTab === "sticker" ? "Search stickers…" : "Search GIFs…"}
                  />
                  <div className="cc-gif-categories">
                    {GIF_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={mediaQuery.toLowerCase() === cat.toLowerCase() ? "on" : ""}
                        onClick={() => setMediaQuery(cat === "Trending" ? "" : cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className={`cc-gif-grid ${pickerTab === "sticker" ? "sticker" : ""}`}>
                    {mediaLoading && <p className="cc-muted">Loading…</p>}
                    {!mediaLoading && mediaItems.length === 0 && (
                      <p className="cc-muted">Nothing found.</p>
                    )}
                    {mediaItems.map((item) => (
                      <button key={item.id} type="button" onClick={() => sendMedia(item, pickerTab)}>
                        <img
                          src={item.images.fixed_height_small.url}
                          alt={item.title || pickerTab}
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                  <p className="cc-gif-credit">Powered by GIPHY</p>
                </div>
              )}
            </div>
          )}




          <form className="cc-composer" onSubmit={handleSend}>
            <input ref={photoRef} type="file" accept="image/*" hidden onChange={handleSharePhoto} />
            <button type="button" className="cc-icon-btn" onClick={() => photoRef.current?.click()} aria-label="Photo">
              <IconPhoto />
            </button>
            <textarea
  className="cc-composer-input"
  rows={1}
  value={input}
    onChange={(e) => {
    const value = e.target.value;
    setInput(value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    const m = value.match(/(?:^|\s)@([\p{L}\p{N}_.-]*)$/u);
    const nextQuery = m ? m[1].toLowerCase() : null;
    setMentionQuery((prev) => (prev === nextQuery ? prev : nextQuery));
    if (value.trim()) pulseTyping();
    else clearTyping();
  }}
  onKeyDown={(e) => {
    // Enter sends; Shift+Enter = new line
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }}
  placeholder={`Message ${activeBoard?.name || "board"}…`}
/>

                        <button
              type="button"
              className={`cc-icon-btn ${pickerOpen ? "on" : ""}`}
              onClick={() => setPickerOpen((v) => !v)}
              aria-label="Emoji and GIFs"
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
            <button type="submit" className="cc-send" disabled={!input.trim() && !pendingImage} aria-label="Send">
              <IconSend />
            </button>
          </form>
        </div>
      </section>



              {lightbox &&
          createPortal(
            <div className="cc-lightbox" onClick={() => setLightbox(null)}>
              <div className="cc-lightbox-bar" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.5))}>−</button>
                <button type="button" onClick={() => setZoom(1)}>Fit</button>
                <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.5))}>+</button>
                <button type="button" onClick={() => setLightbox(null)}>Close</button>
              </div>
              <div
                className="cc-lightbox-stage"
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => {
                  e.preventDefault();
                  setZoom((z) => Math.min(4, Math.max(1, z + (e.deltaY < 0 ? 0.2 : -0.2))));
                }}
              >
                <img src={lightbox} alt="" style={{ transform: `scale(${zoom})` }} />
              </div>
            </div>,
            document.body
          )}

      {showUpgradeModal && (
        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      )}
    </>
  );
}