// src/pages/CommunityChat.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import StudyCall from "../components/StudyCall";
import UpgradeModal from "../components/UpgradeModal";
import "../styles/community-chat.css";
import {
  getCommunity,
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

export default function CommunityChat() {
  const { communityId } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const photoRef = useRef(null);
  const feedRef = useRef(null);

  const [community, setCommunity] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [callOpen, setCallOpen] = useState(false);
  const [askingAI, setAskingAI] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isPaid = user?.plan === "unlimited" || user?.plan === "premium";
  const today = getToday();
  const usedRoomAI = user?.lastRoomAIDate === today ? user?.dailyRoomAI || 0 : 0;

  useEffect(() => {
    let unsub = null;
    (async () => {
      const data = await getCommunity(communityId);
      setCommunity(data);
      if (user?.uid && (data?.members || []).includes(user.uid)) {
        unsub = subscribeToCommunityMessages(communityId, setMessages);
      }
    })();
    return () => unsub && unsub();
  }, [communityId, user?.uid]);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, askingAI]);

  const isMember = user && community && (community.members || []).includes(user.uid);

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
        topic: community?.name || "Community",
        question,
        imageUrl: lastImage?.startsWith("http") ? lastImage : "",
        imageBase64: lastImage?.startsWith("data:") ? lastImage.split(",")[1] : "",
        recentMessages: messages.slice(-8).map((m) => ({
          role: m.isAI ? "assistant" : "user",
          content: m.text,
        })),
      });
      await sendCommunityMessage(communityId, {
        text: res.answer || "I couldn't respond right now.",
        uid: "snaprium-ai",
        displayName: "Snaprium AI",
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
    try {
      await sendCommunityMessage(communityId, {
        text,
        uid: user.uid,
        displayName: user.displayName || "Member",
        isAI: false,
        type: "text",
      });
      if (/(^|\s)@(ai|snaprium)\b/i.test(text)) askAI(text);
    } catch {
      setInput(text);
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
        text: "Shared a photo",
        imageUrl,
        type: "image",
        uid: user.uid,
        displayName: user.displayName || "Member",
        isAI: false,
      });
    } catch {
      toast.error("Could not share photo");
    }
  };

  if (!community) {
    return (
      <div className="cc-page">
        <p className="cc-muted">Opening chat…</p>
      </div>
    );
  }

  if (user && !isMember) {
    return (
      <div className="cc-page">
        <p className="cc-muted">Join this community to use chat.</p>
        <button type="button" className="cc-session-btn" onClick={() => navigate(`/community/${communityId}`)}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="cc-page">
      <header className="cc-top">
        <button
          type="button"
          className="cc-back"
          onClick={() => navigate(`/community/${communityId}`)}
          aria-label="Back to community"
        >
          <IconBack />
        </button>
        <div className="cc-top-copy">
          <h1>{community.name}</h1>
          <p>Community chat</p>
        </div>
        <button
          type="button"
          className={`cc-session-btn ${callOpen ? "on" : ""}`}
          onClick={() => setCallOpen((v) => !v)}
        >
          <IconVideo />
          {callOpen ? "End" : "Session"}
        </button>
      </header>

      {callOpen && (
        <div className="cc-session">
          <StudyCall roomId={`community-${community.id}`} user={user} onClose={() => setCallOpen(false)} />
        </div>
      )}

      <div className="cc-feed" ref={feedRef}>
        {messages.length === 0 && <p className="cc-muted">No messages yet. Start the thread.</p>}
        {messages.map((msg) => (
          <article
            key={msg.id}
            className={`cc-post ${msg.isAI ? "ai" : ""} ${msg.uid === user?.uid ? "mine" : ""}`}
          >
            <header>{msg.displayName}{msg.isAI ? " · AI" : ""}</header>
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
        ))}
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

      <form className="cc-composer" onSubmit={handleSend}>
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={handleSharePhoto} />
        <button type="button" className="cc-icon-btn" onClick={() => photoRef.current?.click()} aria-label="Photo">
          <IconPhoto />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Write in the community…"
        />
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

      {showUpgradeModal && (
        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  );
}