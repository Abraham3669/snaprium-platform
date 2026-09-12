// src/pages/StudyRoom.jsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  subscribeToRoom,
  subscribeToMessages,
  sendMessage,
  joinStudyRoom,
  leaveStudyRoom,
  updateTimer,
} from "../lib/studyRooms";
import { toast } from "react-toastify";
import { postAPI } from "../utils/apiClient";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export default function StudyRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hideTopControls, setHideTopControls] = useState(false);

  const messagesEndRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const lastScrollTop = useRef(0);

  // Join room
  useEffect(() => {
    if (!user || !roomId) {
      setLoading(false);
      return;
    }

    let unsubRoom = null;
    let unsubMessages = null;
    let isMounted = true;

    const init = async () => {
      try {
        await joinStudyRoom(roomId, user);
        if (!isMounted) return;

        unsubRoom = subscribeToRoom(roomId, (data) => {
          if (isMounted) {
            setRoom(data);
            setLoading(false);
          }
        });

        unsubMessages = subscribeToMessages(roomId, (msgs) => {
          if (isMounted) setMessages(msgs);
        });
      } catch (err) {
        console.error(err);
        if (isMounted) {
          toast.error("Could not join the room");
          navigate("/study");
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      if (unsubRoom) try { unsubRoom(); } catch {}
      if (unsubMessages) try { unsubMessages(); } catch {}
      if (user?.uid) leaveStudyRoom(roomId, user.uid).catch(() => {});
    };
  }, [user, roomId, navigate]);

  // Redirect if signed out
  useEffect(() => {
    if (!user && roomId) {
      navigate("/study", { replace: true });
    }
  }, [user, roomId, navigate]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Timer
  useEffect(() => {
    if (!room?.timer) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (room.timer.mode === "running") {
      timerIntervalRef.current = setInterval(() => {
        setRoom((prev) => {
          if (!prev?.timer) return prev;
          const remaining = Math.max(0, (prev.timer.remaining || 0) - 1);
          return { ...prev, timer: { ...prev.timer, remaining } };
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [room?.timer?.mode, room?.timer?.startedAt]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isSending || !user) return;

    setIsSending(true);
    try {
      await sendMessage(roomId, {
        text: input.trim(),
        uid: user.uid,
        displayName: user.displayName || "Student",
        isAI: false,
      });
      setInput("");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleAskAI = async () => {
    if (!input.trim() || isAskingAI || !user) return;

    const question = input.trim();
    setInput("");
    setIsAskingAI(true);

    await sendMessage(roomId, {
      text: question,
      uid: user.uid,
      displayName: user.displayName || "Student",
      isAI: false,
    });

    try {
      const res = await postAPI("/api/room-ai", {
        roomId,
        topic: room?.topic || "Math & Physics",
        question,
        recentMessages: messages.slice(-8).map((m) => ({
          role: m.isAI ? "assistant" : "user",
          content: m.text,
        })),
      });

      await sendMessage(roomId, {
        text: res.answer || "I couldn't generate a response right now.",
        uid: "snaprium-ai",
        displayName: "Snaprium AI",
        isAI: true,
      });
    } catch {
      await sendMessage(roomId, {
        text: "Sorry, I had trouble answering just now. Please try again.",
        uid: "snaprium-ai",
        displayName: "Snaprium AI",
        isAI: true,
      });
    } finally {
      setIsAskingAI(false);
    }
  };

  const startTimer = async (minutes = 25) => {
    await updateTimer(roomId, {
      mode: "running",
      duration: minutes * 60,
      remaining: minutes * 60,
      startedAt: Date.now(),
    });
  };

  const pauseTimer = async () => {
    if (!room?.timer) return;
    await updateTimer(roomId, { ...room.timer, mode: "paused" });
  };

  const resetTimer = async () => {
    await updateTimer(roomId, {
      mode: "idle",
      duration: 25 * 60,
      remaining: 25 * 60,
      startedAt: null,
    });
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/study/${roomId}`);
    toast.success("Invite link copied!");
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading || !room) {
    return (
      <div className="study-room-loading">
        <p>Joining study room...</p>
      </div>
    );
  }

  const onlineParticipants = (room.participants || []).filter((p) => p.isOnline);

  return (
    <div className="study-room">
      {/* Header */}
      <header className="study-room-header">
        <div className="study-room-header-left">
          <h1>{room.topic}</h1>
          <p className="study-room-code">Code: {room.code}</p>
        </div>
        <div className="study-room-actions">
          <button onClick={copyInviteLink} className="invite-btn">Invite</button>
          <button onClick={() => navigate("/study")} className="leave-btn">Leave</button>
        </div>
      </header>

      {/* Top Controls */}
      <div className={`study-top-controls ${hideTopControls ? "hidden" : ""}`}>
        <div className="study-timer-card">
          <div className="timer-label">Shared Timer</div>
          <div className="timer-display">
            {formatTime(room.timer?.remaining ?? 25 * 60)}
          </div>
          <div className="timer-controls">
            {room.timer?.mode !== "running" ? (
              <button onClick={() => startTimer(25)}>Start</button>
            ) : (
              <button onClick={pauseTimer}>Pause</button>
            )}
            <button onClick={resetTimer}>Reset</button>
          </div>
        </div>

        <div className="study-participants">
          <div className="participants-label">
            Online · {onlineParticipants.length + 1}
          </div>
          <div className="participants-list">
            {onlineParticipants.map((p) => (
              <span key={p.uid} className="participant-chip">{p.displayName}</span>
            ))}
            <span className="participant-chip ai">Snaprium AI</span>
          </div>
        </div>
      </div>

      {/* Chat */}
      <main className="study-chat">
        <div
          className="messages"
          onScroll={(e) => {
  const el = e.currentTarget;
  const current = el.scrollTop;
  const diff = current - lastScrollTop.current;

  // Only react to clear intentional scrolls
  if (Math.abs(diff) < 12) return;

  if (diff > 0 && current > 60) {
    // Scrolling down
    setHideTopControls(true);
  } else if (diff < 0 && current < 80) {
    // Scrolling up near the top
    setHideTopControls(false);
  }

  lastScrollTop.current = current;
}}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.isAI ? "ai-message" : ""} ${
                msg.uid === user?.uid ? "my-message" : ""
              }`}
            >
              <div className="message-author">
                {msg.displayName}{msg.isAI && " · AI"}
              </div>
              <div className="message-text">
                {msg.isAI ? (
                  <div className="ai-markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", trust: true }]]}
                    >
                      {prepareMathForKaTeX(msg.text)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Message or ask AI..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending || isAskingAI}
          />
          <button type="submit" disabled={isSending || !input.trim()}>Send</button>
          <button
            type="button"
            className="ask-ai-btn"
            onClick={handleAskAI}
            disabled={isAskingAI || !input.trim()}
          >
            {isAskingAI ? "..." : "Ask AI"}
          </button>
        </form>
      </main>
    </div>
  );
}

function prepareMathForKaTeX(rawText) {
  if (!rawText) return "";
  let text = rawText;
  text = text.replace(/(\b\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?\b)(?!\s*\/)/g, "\\frac{$1}{$2}");
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, "$$$$$1$$$$");
  text = text.replace(/\$\$[\s\n]+/g, "$$").replace(/[\s\n]+\$\$/g, "$$");
  return text;
}