// src/components/StudyCall.jsx
import { useEffect, useRef, useState } from "react";
import DailyIframe from "@daily-co/daily-js";
import { postAPI } from "../utils/apiClient";
import { toast } from "react-toastify";

function getTrack(p, kind) {
  return p?.tracks?.[kind]?.persistentTrack || p?.tracks?.[kind]?.track || null;
}

export default function StudyCall({ roomId, user, onClose }) {
  const callRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState("");
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [activeScreenId, setActiveScreenId] = useState(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        setError("");
        setJoining(true);

        const data = await postAPI("/api/daily-room", {
          roomId,
          userName: user?.displayName || "Student",
        });

        if (cancelled) return;
        if (!data?.url) throw new Error(data?.error || "No Daily room URL returned");

        const call = DailyIframe.createCallObject();
        callRef.current = call;

        const sync = () => {
          setParticipants(Object.values(call.participants() || {}));
        };

        call.on("joined-meeting", () => {
          sync();
          setJoining(false);
        });
        call.on("participant-joined", sync);
        call.on("participant-updated", sync);
        call.on("participant-left", sync);
        call.on("track-started", sync);
        call.on("track-stopped", sync);
        call.on("error", (e) => {
          console.error("[Daily]", e);
          setError(e?.errorMsg || "Call error");
        });

        await call.join({
          url: data.url,
          userName: user?.displayName || "Student",
          startVideoOff: true,
          startAudioOff: true,
        });
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setJoining(false);
          setError(err.message || "Could not start the study call");
          toast.error("Could not start the study call");
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      if (callRef.current) {
        callRef.current.leave().catch(() => {});
        callRef.current.destroy();
        callRef.current = null;
      }
    };
  }, [roomId, user?.displayName]);

  useEffect(() => {
    participants.forEach((p) => {
      const videoEl = document.querySelector(`[data-daily-video="${p.session_id}"]`);
      const screenEl = document.querySelector(`[data-daily-screen="${p.session_id}"]`);
      const audioEl = document.querySelector(`[data-daily-audio="${p.session_id}"]`);

      const cam = getTrack(p, "video");
      const screen = getTrack(p, "screenVideo");
      const audio = getTrack(p, "audio");

      if (videoEl && cam && videoEl.srcObject?.getVideoTracks?.()[0] !== cam) {
        videoEl.srcObject = new MediaStream([cam]);
      }

      if (screenEl && screen && screenEl.srcObject?.getVideoTracks?.()[0] !== screen) {
        screenEl.srcObject = new MediaStream([screen]);
      }

      if (audioEl && audio && !p.local) {
        if (audioEl.srcObject?.getAudioTracks?.()[0] !== audio) {
          audioEl.srcObject = new MediaStream([audio]);
        }
        audioEl.play?.().catch(() => {});
      }
    });
  }, [participants]);

  const toggleCam = async () => {
    const next = !camOn;
    await callRef.current?.setLocalVideo(next);
    setCamOn(next);
  };

  const toggleMic = async () => {
    const next = !micOn;
    await callRef.current?.setLocalAudio(next);
    setMicOn(next);
  };

  const toggleShare = async () => {
    try {
      if (sharing) {
        await callRef.current?.stopScreenShare();
        setSharing(false);
      } else {
        await callRef.current?.startScreenShare();
        setSharing(true);
      }
    } catch (err) {
      console.error(err);
      toast.error("Allow screen share in the browser popup, or use desktop");
    }
  };

  const leave = async () => {
    try {
      await callRef.current?.leave();
    } catch {}
    onCloseRef.current?.();
  };

  const screens = participants.filter((p) => getTrack(p, "screenVideo"));
  const activeScreen =
    screens.find((p) => p.session_id === activeScreenId) || screens[0] || null;

  return (
    <div className="study-call">
      {screens.length > 0 && (
        <div className="study-call-stage">
          {screens.length > 1 && (
            <div className="study-call-screen-switch">
              {screens.map((p) => (
                <button
                  key={`pick-${p.session_id}`}
                  type="button"
                  className={activeScreen?.session_id === p.session_id ? "active" : ""}
                  onClick={() => setActiveScreenId(p.session_id)}
                >
                  {p.local ? "Your screen" : `${p.user_name || "Student"}'s screen`}
                </button>
              ))}
            </div>
          )}

          {activeScreen && (
            <video
              key={`screen-${activeScreen.session_id}`}
              data-daily-screen={activeScreen.session_id}
              autoPlay
              playsInline
              muted
            />
          )}
        </div>
      )}

      <div className="study-call-strip">
        {joining && <div className="study-call-status">Joining call...</div>}
        {error && <div className="study-call-status">{error}</div>}

        {participants.map((p) => (
          <div key={p.session_id} className="study-call-tile">
            <video
              data-daily-video={p.session_id}
              autoPlay
              playsInline
              muted={!!p.local}
            />
            {!p.local && <audio data-daily-audio={p.session_id} autoPlay />}
            <div className="study-call-name">
              {p.local ? "You" : p.user_name || "Student"}
            </div>
          </div>
        ))}
      </div>

      <div className="study-call-controls">
        <button type="button" onClick={toggleMic} title={micOn ? "Mute" : "Unmute"}>
          {micOn ? <MicOnIcon /> : <MicOffIcon />}
          <span>{micOn ? "Mute" : "Unmute"}</span>
        </button>
        <button type="button" onClick={toggleCam} title={camOn ? "Camera off" : "Camera on"}>
          {camOn ? <CamOnIcon /> : <CamOffIcon />}
          <span>{camOn ? "Camera off" : "Camera on"}</span>
        </button>
        <button type="button" onClick={toggleShare} title={sharing ? "Stop share" : "Share screen"}>
          <ShareIcon />
          <span>{sharing ? "Stop share" : "Share"}</span>
        </button>
        <button type="button" className="study-call-leave" onClick={leave} title="Leave call">
          <LeaveCallIcon />
          <span>Leave</span>
        </button>
      </div>
    </div>
  );
}

function MicOnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="4" y1="4" x2="20" y2="20" />
    </svg>
  );
}

function CamOnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}

function CamOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function LeaveCallIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}