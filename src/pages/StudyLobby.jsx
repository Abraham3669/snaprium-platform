// src/pages/StudyLobby.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createStudyRoom,
  joinStudyRoomByCode,
  rememberJoinedRoom,
  hideRoomForMe,
} from "../lib/studyRooms";
import { toast } from "react-toastify";

export default function StudyLobby() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [topic, setTopic] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const hidden = user?.hiddenStudyRooms || [];
  const myRooms = (user?.joinedStudyRooms || []).filter(
    (room, index, list) =>
      room?.id &&
      !hidden.includes(room.id) &&
      list.findIndex((item) => item.id === room.id) === index
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.info("Please sign in to create a study room");
      navigate("/login");
      return;
    }

    if (!topic.trim()) {
      toast.warning("Please enter a topic");
      return;
    }

    setIsCreating(true);
    try {
      const room = await createStudyRoom({
        topic: topic.trim(),
        createdBy: user.uid,
        displayName: user.displayName || user.email?.split("@")[0] || "Student",
      });
      await rememberJoinedRoom(user.uid, room);
      toast.success("Room created!");
      navigate(`/study/${room.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create room. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.info("Please sign in to join a study room");
      navigate("/login");
      return;
    }

    const code = joinCode.trim().toUpperCase();
    if (!code) {
      toast.warning("Please enter a room code");
      return;
    }

    setIsJoining(true);
    try {
      const room = await joinStudyRoomByCode(code, user);
      await rememberJoinedRoom(user.uid, room);
      toast.success("Joined the room!");
      navigate(`/study/${room.id}`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Could not join room. Check the code.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleHideRoom = async (roomId) => {
    if (!user?.uid) return;
    try {
      await hideRoomForMe(user.uid, roomId);
      toast.success("Room removed from your list");
    } catch (err) {
      console.error(err);
      toast.error("Could not remove room");
    }
  };

  return (
    <div className="study-lobby">
      <div className="study-lobby-container">
        <h1 className="study-lobby-title">Study with Friends</h1>
        <p className="study-lobby-subtitle">
          Create a room or join your friends. Snaprium AI will join you.
        </p>

        {user && (
          <section className="study-card my-rooms-card">
            <h2>My rooms</h2>
            {myRooms.length === 0 ? (
              <p className="study-hint">Rooms you create or join will show up here.</p>
            ) : (
              <ul className="my-rooms-list">
                {myRooms.map((room) => (
                  <li key={room.id} className="my-room-item">
                    <button
                      type="button"
                      className="my-room-open"
                      onClick={() => navigate(`/study/${room.id}`)}
                    >
                      <span className="my-room-topic">{room.topic || "Study Room"}</span>
                      {room.code && <span className="my-room-code">Code {room.code}</span>}
                    </button>
                    <button
                      type="button"
                      className="my-room-hide"
                      onClick={() => handleHideRoom(room.id)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <form onSubmit={handleCreate} className="study-card">
          <h2>Create a Study Room</h2>
          <input
            type="text"
            placeholder="What are you studying? (e.g. Calculus, Newton's Laws)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={60}
            disabled={isCreating}
          />
          <button type="submit" disabled={isCreating || !topic.trim()}>
            {isCreating ? "Creating..." : "Create Room & Invite Friends"}
          </button>
        </form>

        <div className="study-divider">
          <span>or</span>
        </div>

        <form onSubmit={handleJoin} className="study-card">
          <h2>Join a Room</h2>
          <p className="study-hint">
            Enter the 4-character code your friend shared with you.
          </p>
          <input
            type="text"
            placeholder="Enter room code (e.g. A7K2)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            disabled={isJoining}
          />
          <button type="submit" disabled={isJoining || !joinCode.trim()}>
            {isJoining ? "Joining..." : "Join Room"}
          </button>
        </form>

        <button
          className="study-back-btn"
          onClick={() => navigate("/")}
          type="button"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}