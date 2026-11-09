// src/components/StudyCall.jsx
import { useEffect, useRef, useState } from "react";
import DailyIframe from "@daily-co/daily-js";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { postAPI } from "../utils/apiClient";
import { toast } from "react-toastify";
import UpgradeModal from "./UpgradeModal";
import "../styles/study-call.css";

const FREE_SESSION_MIN = 45;
const FREE_SESSIONS_PER_DAY = 2;
const getToday = () => new Date().toISOString().split("T")[0];

function getTrack(p, kind) {
  return p?.tracks?.[kind]?.persistentTrack || p?.tracks?.[kind]?.track || null;
}

// camera is showing video only when Daily says the track is playable
function hasCamera(p) {
  const state = p?.tracks?.video?.state;
  return state ? state === "playable" : !!p?.video;
}

function hasMic(p) {
  const state = p?.tracks?.audio?.state;
  return state ? state === "playable" : !!p?.audio;
}

// focus + onToggleFocus are optional. Pass them to show the full screen button in the control bar.
export default function StudyCall({ roomId, user, onClose, focus = false, onToggleFocus, onOpenChat, chatBadge = 0 }) {
  const callRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState("");
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [activeScreenId, setActiveScreenId] = useState(null);
  const [theater, setTheater] = useState(false); // hide the people strip, shared screen fills the stage
  const [fit, setFit] = useState(true); // true = show the whole screen, false = fill the area
  const screenBoxRef = useRef(null);

  const isPaid = user?.plan === "unlimited" || user?.plan === "premium";

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let capTimer;

    const start = async () => {
      try {
        setError("");
        setJoining(true);

        if (!isPaid && user?.uid) {
          const today = getToday();
          const used = user.lastLiveSessionDate === today ? user.dailyLiveSessions || 0 : 0;
          if (used >= FREE_SESSIONS_PER_DAY) {
            toast.info("Free session limit reached (45 minutes).");
            setShowUpgradeModal(true);
            try {
              await callRef.current?.leave();
            } catch {}
            onCloseRef.current?.();
            return;
          }
          await updateDoc(doc(db, "users", user.uid), {
            dailyLiveSessions: used + 1,
            lastLiveSessionDate: today,
            updatedAt: serverTimestamp(),
          });
        }

        const data = await postAPI("/api/daily-room", {
          roomId,
          userName: user?.displayName || "Student",
        });

        if (cancelled) return;
        if (!data?.url) throw new Error(data?.error || "No Daily room URL returned");

        if (!window.isSecureContext) {
          throw new Error(
            "Live sessions need a secure connection. Open the app over https (or localhost)."
          );
        }
        if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "This browser or app has WebRTC turned off. Try Chrome or Safari, or turn off any WebRTC blocking."
          );
        }

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
        call.on("local-screen-share-started", () => setSharing(true));
        call.on("local-screen-share-stopped", () => setSharing(false));
        call.on("camera-error", (e) => {
          console.error("[Daily camera]", e);
          setCamOn(false);
          setMicOn(false);
          toast.error(
            "Camera or mic is blocked. Allow access in your device and browser settings, then try again."
          );
        });
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

        if (!isPaid) {
          capTimer = setTimeout(async () => {
            toast.info("Free session limit reached (45 minutes).");
            try {
              await callRef.current?.leave();
            } catch {}
            onCloseRef.current?.();
          }, FREE_SESSION_MIN * 60 * 1000);
        }
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
      clearTimeout(capTimer);
      if (callRef.current) {
        callRef.current.leave().catch(() => {});
        callRef.current.destroy();
        callRef.current = null;
      }
    };
  }, [roomId, user?.displayName, user?.uid, isPaid]);

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
  }, [participants, activeScreenId]);

  const toggleCam = async () => {
    const next = !camOn;
    try {
      await callRef.current?.setLocalVideo(next);
      setCamOn(next);
    } catch (err) {
      console.error(err);
      toast.error("Could not turn the camera on. Check your camera permissions.");
    }
  };

  const toggleMic = async () => {
    const next = !micOn;
    try {
      await callRef.current?.setLocalAudio(next);
      setMicOn(next);
    } catch (err) {
      console.error(err);
      toast.error("Could not turn the mic on. Check your microphone permissions.");
    }
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

  const viewScreens = participants.filter((p) => !p.local && getTrack(p, "screenVideo"));
  const activeScreen =
    viewScreens.find((p) => p.session_id === activeScreenId) || viewScreens[0] || null;

  // native browser full screen for just the shared screen
  const toggleScreenFullscreen = async () => {
    const el = screenBoxRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        await (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // local person first, then everyone else
  const ordered = [...participants].sort((a, b) => Number(!!b.local) - Number(!!a.local));
  const count = Math.min(Math.max(ordered.length, 1), 10);

  return (
    <div className={`sc-root ${focus ? "is-focus" : ""}`}>
      <div className={`sc-main ${activeScreen ? "has-screen" : ""} ${activeScreen && theater ? "theater" : ""}`}>
        {activeScreen && (
          <div className="sc-screen" ref={screenBoxRef}>
            <video
              key={`screen-${activeScreen.session_id}`}
              data-daily-screen={activeScreen.session_id}
              autoPlay
              playsInline
              muted
              className={fit ? "" : "fill"}
              onClick={() => setTheater((v) => !v)}
              title={theater ? "Click to show people" : "Click to enlarge"}
            />
            <span className="sc-screen-label">
              {`${activeScreen.user_name || "Student"}'s screen`}
            </span>
            <div className="sc-screen-tools">
              <button
                type="button"
                onClick={() => setTheater((v) => !v)}
                title={theater ? "Show people" : "Hide people"}
                aria-label={theater ? "Show people" : "Hide people"}
              >
                <PeopleIcon />
              </button>
              <button
                type="button"
                onClick={() => setFit((v) => !v)}
                title={fit ? "Fill the area" : "Fit whole screen"}
                aria-label={fit ? "Fill the area" : "Fit whole screen"}
              >
                <FitIcon />
              </button>
              <button
                type="button"
                onClick={toggleScreenFullscreen}
                title="Full screen"
                aria-label="Full screen"
              >
                <ExpandIcon size={18} />
              </button>
            </div>
            {viewScreens.length > 1 && (
              <div className="sc-screen-switch">
                {viewScreens.map((p) => (
                  <button
                    key={`pick-${p.session_id}`}
                    type="button"
                    className={activeScreen.session_id === p.session_id ? "active" : ""}
                    onClick={() => setActiveScreenId(p.session_id)}
                  >
                    {p.local ? "Your screen" : `${p.user_name || "Student"}'s screen`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="sc-grid" data-count={count}>
          {ordered.map((p) => {
            const name = p.local ? "You" : p.user_name || "Student";
            const camera = hasCamera(p);
            const mic = p.local ? micOn : hasMic(p);
            return (
              <div
                key={p.session_id}
                className={`sc-tile ${p.local ? "local" : ""} ${camera ? "" : "cam-off"}`}
              >
                <video data-daily-video={p.session_id} autoPlay playsInline muted={!!p.local} />
                {!p.local && <audio data-daily-audio={p.session_id} autoPlay />}
                {!camera && (
                  <div className="sc-avatar" aria-hidden="true">
                    <span>{(p.user_name || (p.local ? user?.displayName : "") || name).slice(0, 1).toUpperCase()}</span>
                  </div>
                )}
                <div className="sc-name">
                  {!mic && <MicOffIcon size={14} />}
                  <span>{name}</span>
                </div>
              </div>
            );
          })}
        </div>

        {(joining || error) && (
          <div className="sc-status" role="status">
            {error || "Joining call…"}
          </div>
        )}

        {sharing && (
          <div className="sc-sharing-bar" role="status">
            <span className="sc-sharing-dot" aria-hidden="true" />
            <span>You are sharing your screen</span>
            <button type="button" onClick={toggleShare}>Stop sharing</button>
          </div>
        )}
      </div>

      <div className="sc-controls">
        <button
          type="button"
          className={`sc-btn ${micOn ? "" : "off"}`}
          onClick={toggleMic}
          title={micOn ? "Mute" : "Unmute"}
          aria-label={micOn ? "Mute" : "Unmute"}
        >
          {micOn ? <MicOnIcon /> : <MicOffIcon />}
        </button>
        <button
          type="button"
          className={`sc-btn ${camOn ? "" : "off"}`}
          onClick={toggleCam}
          title={camOn ? "Turn camera off" : "Turn camera on"}
          aria-label={camOn ? "Turn camera off" : "Turn camera on"}
        >
          {camOn ? <CamOnIcon /> : <CamOffIcon />}
        </button>
        <button
          type="button"
          className={`sc-btn ${sharing ? "active" : ""}`}
          onClick={toggleShare}
          title={sharing ? "Stop sharing" : "Share screen"}
          aria-label={sharing ? "Stop sharing" : "Share screen"}
        >
          <ShareIcon />
        </button>
        {onOpenChat && (
          <button type="button" className="sc-btn" onClick={onOpenChat} title="Chat" aria-label="Open chat">
            <ChatIcon />
            {chatBadge > 0 && <span className="sc-badge">{chatBadge > 9 ? "9+" : chatBadge}</span>}
          </button>
        )}
        {onToggleFocus && (
          <button
            type="button"
            className="sc-btn"
            onClick={onToggleFocus}
            title={focus ? "Exit full screen" : "Full screen"}
            aria-label={focus ? "Exit full screen" : "Full screen"}
          >
            {focus ? <CollapseIcon /> : <ExpandIcon />}
          </button>
        )}
        <button type="button" className="sc-btn sc-leave" onClick={leave} title="Leave call" aria-label="Leave call">
          <LeaveCallIcon />
          <span>Leave</span>
        </button>
      </div>

      {showUpgradeModal && (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          title="Live session limit"
          subtitle="Free accounts get 2 sessions a day, 45 minutes each."
        />
      )}
    </div>
  );
}

const svgProps = (size) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

function MicOnIcon({ size = 22 }) {
  return (
    <svg {...svgProps(size)}>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}
function MicOffIcon({ size = 22 }) {
  return (
    <svg {...svgProps(size)}>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4" y1="4" x2="20" y2="20" />
    </svg>
  );
}
function CamOnIcon({ size = 22 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}
function CamOffIcon({ size = 22 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
function ShareIcon({ size = 22 }) {
  return (
    <svg {...svgProps(size)}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}
function ExpandIcon({ size = 22 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}
function CollapseIcon({ size = 22 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}
function ChatIcon({ size = 22 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}
function LeaveCallIcon({ size = 20 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M10 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function PeopleIcon({ size = 18 }) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.5a6 6 0 0 1 3 5.5" />
    </svg>
  );
}
function FitIcon({ size = 18 }) {
  return (
    <svg {...svgProps(size)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 12h8M10 10l-2 2 2 2M14 10l2 2-2 2" />
    </svg>
  );
}