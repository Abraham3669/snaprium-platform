// src/pages/StudyRoom.jsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/study-room.css";
import {
  subscribeToRoom,
  subscribeToMessages,
  sendMessage,
  deleteMessage,
  joinStudyRoom,
  leaveStudyRoom,
  updateTimer,
} from "../lib/studyRooms";
import { toast } from "react-toastify";
import { postAPI } from "../utils/apiClient";
import StudyCall from "../components/StudyCall";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export default function StudyRoom() {
  const { roomId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hideTopControls, setHideTopControls] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;

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
    };
  }, [authLoading, user, roomId, navigate]);

  useEffect(() => {
    if (!authLoading && !user && roomId) {
      navigate("/study", { replace: true });
    }
  }, [authLoading, user, roomId, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        type: "text",
      });
      setInput("");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

    const handleAskAI = async () => {
    const lastImage = [...messages].reverse().find((m) => m.imageUrl)?.imageUrl || "";
    if ((!input.trim() && !lastImage) || isAskingAI || !user) return;

    const question = input.trim() || "Please help the group with this shared question photo.";
    setInput("");
    setIsAskingAI(true);

    await sendMessage(roomId, {
      text: question,
      uid: user.uid,
      displayName: user.displayName || "Student",
      isAI: false,
      type: "text",
    });

    try {
      const res = await postAPI("/api/room-ai", {
        roomId,
        topic: room?.topic || "Math & Physics",
        question,
               imageUrl: lastImage?.startsWith("http") ? lastImage : "",
        imageBase64: lastImage?.startsWith("data:")
          ? lastImage.split(",")[1]
          : "",
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
        type: "text",
      });
    } catch {
      await sendMessage(roomId, {
        text: "Sorry, I had trouble answering just now. Please try again.",
        uid: "snaprium-ai",
        displayName: "Snaprium AI",
        isAI: true,
        type: "text",
      });
    } finally {
      setIsAskingAI(false);
    }
  };

    const handleShareQuestion = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      await sendMessage(roomId, {
        text: "Shared a question",
        imageUrl: dataUrl,
        type: "image",
        uid: user.uid,
        displayName: user.displayName || "Student",
        isAI: false,
      });
    } catch (err) {
      console.error(err);
      toast.error("Could not share the question");
    } finally {
      setIsUploading(false);
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

  const handleLeave = async () => {
    try {
      if (user?.uid) await leaveStudyRoom(roomId, user.uid);
    } catch {}
    navigate("/study");
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

  if (authLoading || loading || !room) {
    return (
      <div className="study-room-loading">
        <p>Joining study room...</p>
      </div>
    );
  }

  const onlineParticipants = (room.participants || []).filter((p) => p.isOnline);

  return (
    <div className="study-room">
      <header className="study-room-header">
        <div className="study-room-header-left">
          <h1>{room.topic}</h1>
          <p className="study-room-code">Code: {room.code}</p>
        </div>
        <div className="study-room-actions">
          <button
            type="button"
            onClick={() => setCallOpen((v) => !v)}
            className="invite-btn"
          >
            <VideoIcon />
            {callOpen ? "In call" : "Start video"}
          </button>
          <button onClick={copyInviteLink} className="invite-btn">
            <LinkIcon />
            Invite
          </button>
          <button onClick={handleLeave} className="leave-btn">
            <LeaveIcon />
            Leave
          </button>
        </div>
      </header>

      {callOpen && (
        <StudyCall
          roomId={roomId}
          user={user}
          onClose={() => setCallOpen(false)}
        />
      )}

      <button
        type="button"
        className="study-tools-toggle"
        onClick={() => setHideTopControls((v) => !v)}
      >
        {hideTopControls ? "Show timer & people" : "Hide timer & people"}
      </button>

      <div className={`study-top-controls ${hideTopControls ? "hidden" : ""}`}>
        <div className="study-timer-card">
          <div className="timer-label">Shared Timer</div>
          <div className="timer-display">
            {formatTime(room.timer?.remaining ?? 25 * 60)}
          </div>
          <div className="timer-controls">
            {room.timer?.mode !== "running" ? (
              <button type="button" onClick={() => startTimer(25)}>Start</button>
            ) : (
              <button type="button" onClick={pauseTimer}>Pause</button>
            )}
            <button type="button" onClick={resetTimer}>Reset</button>
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

      <main className="study-chat">
        <div className="messages">
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
                                {msg.imageUrl && (
                  <>
                    <img
                      src={msg.imageUrl}
                      alt="Shared question"
                      className="room-shared-image"
                    />
                    {msg.uid === user?.uid && (
                      <button
                        type="button"
                        className="delete-msg-btn"
                        onClick={() =>
                          deleteMessage(roomId, msg.id).catch(() =>
                            toast.error("Could not delete")
                          )
                        }
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
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
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={handleShareQuestion}
          />
          <button
            type="button"
            className="share-photo-btn"
            onClick={() => photoInputRef.current?.click()}
            disabled={isUploading}
            title="Share a question"
          >
            <CameraIcon />
          </button>
          <input
            type="text"
            placeholder="Message or ask AI..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending || isAskingAI}
          />
          <button type="submit" disabled={isSending || !input.trim()}>
            <SendIcon />
          </button>
          <button
            type="button"
            className="ask-ai-btn"
            onClick={handleAskAI}
           disabled={isAskingAI || (!input.trim() && !messages.some((m) => m.imageUrl))}
          >
            {isAskingAI ? "..." : "Ask AI"}
          </button>
        </form>
      </main>
    </div>
  );
}

function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 900;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.65));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function prepareMathForKaTeX(rawText) {
  if (!rawText) return "";
  let text = rawText;
  text = text.replace(/(\b\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?\b)(?!\s*\/)/g, "\\frac{$1}{$2}");
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, "$$$$$1$$$$");
  text = text.replace(/\$\$[\s\n]+/g, "$$").replace(/[\s\n]+\$\$/g, "$$");
  return text;
}

function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function LeaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}