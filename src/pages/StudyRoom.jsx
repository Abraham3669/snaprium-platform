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

  const messagesEndRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Join room + subscribe
  useEffect(() => {
    if (!user || !roomId) return;

    let unsubRoom = null;
    let unsubMessages = null;

    const init = async () => {
      try {
        await joinStudyRoom(roomId, user);

        unsubRoom = subscribeToRoom(roomId, (data) => {
          setRoom(data);
          setLoading(false);
        });

        unsubMessages = subscribeToMessages(roomId, (msgs) => {
          setMessages(msgs);
        });
      } catch (err) {
        console.error(err);
        toast.error("Could not join the room");
        navigate("/study");
      }
    };

    init();

    return () => {
      if (unsubRoom) unsubRoom();
      if (unsubMessages) unsubMessages();
      leaveStudyRoom(roomId, user.uid).catch(() => {});
    };
  }, [user, roomId, navigate]);

  // Auto scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Shared timer logic
  useEffect(() => {
    if (!room?.timer) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (room.timer.mode === "running") {
      timerIntervalRef.current = setInterval(() => {
        // Local countdown (real source of truth is Firestore)
        setRoom((prev) => {
          if (!prev?.timer) return prev;
          const remaining = Math.max(0, (prev.timer.remaining || 0) - 1);
          return {
            ...prev,
            timer: { ...prev.timer, remaining },
          };
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
    } catch (err) {
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

    // First show the user's question in the chat
    await sendMessage(roomId, {
      text: question,
      uid: user.uid,
      displayName: user.displayName || "Student",
      isAI: false,
    });

    try {
      // Call AI (we will create the endpoint next)
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
    } catch (err) {
      console.error(err);
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
    await updateTimer(roomId, {
      ...room.timer,
      mode: "paused",
    });
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
    const link = `${window.location.origin}/study/${roomId}`;
    navigator.clipboard.writeText(link);
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
        <div>
          <h1>{room.topic}</h1>
          <p className="study-room-code">Code: {room.code}</p>
        </div>
        <div className="study-room-actions">
          <button onClick={copyInviteLink} className="invite-btn">
            Copy Invite Link
          </button>
          <button onClick={() => navigate("/study")} className="leave-btn">
            Leave
          </button>
        </div>
      </header>

      <div className="study-room-body">
        {/* Left: Participants + Timer */}
        <aside className="study-sidebar">
          <div className="study-timer-card">
            <h3>Shared Timer</h3>
            <div className="timer-display">
              {formatTime(room.timer?.remaining ?? 25 * 60)}
            </div>
            <div className="timer-controls">
              {room.timer?.mode !== "running" ? (
                <button onClick={() => startTimer(25)}>Start 25 min</button>
              ) : (
                <button onClick={pauseTimer}>Pause</button>
              )}
              <button onClick={resetTimer}>Reset</button>
            </div>
          </div>

          <div className="study-participants">
            <h3>Online ({onlineParticipants.length})</h3>
            <ul>
              {onlineParticipants.map((p) => (
                <li key={p.uid}>
                  {p.displayName}
                  {p.uid === "snaprium-ai" && " 🤖"}
                </li>
              ))}
              {/* Always show AI */}
              <li className="ai-participant">Snaprium AI 🤖</li>
            </ul>
          </div>
        </aside>

        {/* Chat */}
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
                  {msg.displayName}
                  {msg.isAI && " 🤖"}
                </div>
                <div className="message-text">{msg.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input" onSubmit={handleSend}>
            <input
              type="text"
              placeholder="Type a message or ask the AI..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSending || isAskingAI}
            />
            <button type="submit" disabled={isSending || !input.trim()}>
              Send
            </button>
            <button
              type="button"
              className="ask-ai-btn"
              onClick={handleAskAI}
              disabled={isAskingAI || !input.trim()}
            >
              {isAskingAI ? "Thinking..." : "Ask AI"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}