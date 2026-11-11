// src/components/StudyCall.jsx
import { useEffect, useRef, useState } from "react";
import DailyIframe from "@daily-co/daily-js";
import { getAuth } from "firebase/auth";
import "../lib/firebase"; // makes sure the Firebase app is started before getAuth()
import { postAPI } from "../utils/apiClient";
import { toast } from "react-toastify";
import UpgradeModal from "./UpgradeModal";
import { track } from "../lib/track";
import "../styles/study-call.css";

// "32 min left", "1h 20m left"
function fmtLeft(secs) {
  if (secs === null || secs === undefined) return "";
  if (secs <= 0) return "ending";
  const m = Math.ceil(secs / 60);
  if (m < 60) return `${m} min left`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m left` : `${h}h left`;
}

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

// move/scale the shared screen video while the person pinches or drags it
function applyZoom(box, z) {
  const v = box?.querySelector("video");
  if (v) v.style.transform = z.s > 1 ? `translate(${z.x}px, ${z.y}px) scale(${z.s})` : "";
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
  const zoomRef = useRef({ s: 1, x: 0, y: 0 }); // pinch zoom of the shared screen
  const [zoomed, setZoomed] = useState(false);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [limits, setLimits] = useState(null); // { max, minutes, tier, expiresAt } sent by the server
  const [now, setNow] = useState(() => Date.now());
  const [ended, setEnded] = useState(null); // { title, message, upgrade } when the session ends or can't start
  const warnedRef = useRef(false);

  const secsLeft = limits ? Math.max(0, Math.floor(limits.expiresAt - now / 1000)) : null;
  const lowTime = secsLeft !== null && secsLeft <= 300;

  // one heads-up when 5 minutes remain
  useEffect(() => {
    if (secsLeft === null || warnedRef.current) return;
    if (secsLeft > 0 && secsLeft <= 300) {
      warnedRef.current = true;
      toast.info("5 minutes left in this session.");
    }
  }, [secsLeft]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let endTimer;
    let nowTimer;
    let info = null; // { tier, minutes, expiresAt (ms) } once the server answered

    const timeUpInfo = () =>
      info?.tier === "free"
        ? {
            title: "Session ended",
            message: `Free sessions last ${info.minutes} minutes. Upgrade to host longer sessions with more people.`,
            upgrade: true,
          }
        : {
            title: "Session ended",
            message: "This session reached its time limit. You can start a new one.",
            upgrade: false,
          };

    const finishSession = async () => {
      try {
        await callRef.current?.leave();
      } catch {}
      if (!cancelled) setEnded(timeUpInfo());
    };

    const start = async () => {
      try {
        setError("");
        setJoining(true);

        // The server checks who you are, whether you belong to this circle, and sets the limits.
        const idToken = await getAuth().currentUser?.getIdToken();
        if (!idToken) throw new Error("Please sign in again to join the session.");

        const data = await postAPI("/api/daily-room", {
          roomId,
          userName: user?.displayName || "Student",
          idToken,
        });

        if (cancelled) return;

        if (data?.ok === false) {
          setJoining(false);
          setEnded({
            title:
              data.code === "daily_limit"
                ? "Daily session limit"
                : data.code === "full"
                ? "Session is full"
                : "Can't join this session",
            message: data.error || "Could not join this session.",
            upgrade: data.code === "daily_limit",
          });
          return;
        }

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
          track("call_join");
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
          // Daily removes everyone when the room reaches its time limit
          if (info && Date.now() >= info.expiresAt - 15000) {
            finishSession();
            return;
          }
          setError(e?.errorMsg || "Call error");
        });

        await call.join({
          url: data.url,
          token: data.token,
          userName: user?.displayName || "Student",
          startVideoOff: true,
          startAudioOff: true,
        });

        info = { tier: data.tier, minutes: data.minutes, expiresAt: data.expiresAt * 1000 };
        setLimits({
          max: data.max,
          minutes: data.minutes,
          tier: data.tier,
          expiresAt: data.expiresAt,
        });
        setNow(Date.now());
        nowTimer = setInterval(() => setNow(Date.now()), 15000);
        // the server and Daily end the room for real; this just shows the end message on time
        endTimer = setTimeout(finishSession, Math.max(0, info.expiresAt - Date.now()));
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setJoining(false);
          const full = /full|max|exceed/i.test(err.message || "");
          setError(full ? "This session is full." : err.message || "Could not start the study call");
          toast.error(full ? "This session is full" : "Could not start the study call");
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      clearTimeout(endTimer);
      clearInterval(nowTimer);
      if (callRef.current) {
        callRef.current.leave().catch(() => {});
        callRef.current.destroy();
        callRef.current = null;
      }
    };
  }, [roomId, user?.displayName, user?.uid]);

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

  const resetZoom = () => {
    zoomRef.current = { s: 1, x: 0, y: 0 };
    applyZoom(screenBoxRef.current, zoomRef.current);
    setZoomed(false);
  };

  // back to normal size when the view changes (other screen, fit/fill, hide people)
  useEffect(() => {
    zoomRef.current = { s: 1, x: 0, y: 0 };
    applyZoom(screenBoxRef.current, zoomRef.current);
    setZoomed(false);
  }, [activeScreen?.session_id, fit, theater]);

  // pinch to zoom, drag to move, double tap to reset (phones and tablets)
  useEffect(() => {
    const box = screenBoxRef.current;
    if (!box || !activeScreen) return undefined;

    const MAX_ZOOM = 5;
    let base = null;
    let lastTap = 0;
    let wasZoomed = false;

    const read = (e) => {
      const r = box.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const pts = Array.from(e.touches);
      const n = pts.length;
      const mx = pts.reduce((a, p) => a + p.clientX, 0) / n - cx;
      const my = pts.reduce((a, p) => a + p.clientY, 0) / n - cy;
      const dist = n > 1 ? Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY) : 0;
      return { mx, my, dist, n, w: r.width, h: r.height };
    };

    const start = (p) => {
      const z = zoomRef.current;
      base = { s: z.s, x: z.x, y: z.y, mx: p.mx, my: p.my, dist: p.dist, n: p.n };
    };

    const onStart = (e) => {
      if (e.target.closest("button, .sc-screen-tools, .sc-screen-switch")) return;
      if (!e.touches.length) return;
      const p = read(e);
      start(p);
      if (p.n === 1) {
        const now = Date.now();
        if (now - lastTap < 300 && zoomRef.current.s > 1) {
          zoomRef.current = { s: 1, x: 0, y: 0 };
          applyZoom(box, zoomRef.current);
          wasZoomed = false;
          setZoomed(false);
          base = null;
          lastTap = 0;
          e.preventDefault();
          return;
        }
        lastTap = now;
      }
    };

    const onMove = (e) => {
      if (!base || !e.touches.length) return;
      const p = read(e);
      if (p.n !== base.n) {
        start(p);
        return;
      }
      if (p.n === 1 && base.s <= 1) return; // one finger at normal size: leave taps alone

      const s1 =
        p.n > 1 && base.dist
          ? Math.min(MAX_ZOOM, Math.max(1, (base.s * p.dist) / base.dist))
          : base.s;
      // the point of the picture under the fingers stays under the fingers
      const px = (base.mx - base.x) / base.s;
      const py = (base.my - base.y) / base.s;
      const z = { s: s1, x: p.mx - px * s1, y: p.my - py * s1 };

      if (z.s <= 1.01) {
        z.s = 1;
        z.x = 0;
        z.y = 0;
      } else {
        const maxX = ((z.s - 1) * p.w) / 2;
        const maxY = ((z.s - 1) * p.h) / 2;
        z.x = Math.min(maxX, Math.max(-maxX, z.x));
        z.y = Math.min(maxY, Math.max(-maxY, z.y));
      }

      zoomRef.current = z;
      applyZoom(box, z);
      const isZoomed = z.s > 1;
      if (isZoomed !== wasZoomed) {
        wasZoomed = isZoomed;
        setZoomed(isZoomed);
      }
      e.preventDefault();
    };

    const onEnd = (e) => {
      if (!e.touches.length) {
        base = null;
      } else {
        start(read(e));
      }
    };

    const onFullscreenChange = () => {
      zoomRef.current = { s: 1, x: 0, y: 0 };
      applyZoom(box, zoomRef.current);
      wasZoomed = false;
      setZoomed(false);
    };

    box.addEventListener("touchstart", onStart, { passive: false });
    box.addEventListener("touchmove", onMove, { passive: false });
    box.addEventListener("touchend", onEnd);
    box.addEventListener("touchcancel", onEnd);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      box.removeEventListener("touchstart", onStart);
      box.removeEventListener("touchmove", onMove);
      box.removeEventListener("touchend", onEnd);
      box.removeEventListener("touchcancel", onEnd);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, [activeScreen?.session_id]);

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
              onClick={() => {
                if (zoomRef.current.s > 1) return; // zoomed in: a tap does nothing
                setTheater((v) => !v);
              }}
              title={theater ? "Click to show people" : "Click to enlarge"}
            />
            <span className="sc-screen-label">
              {`${activeScreen.user_name || "Student"}'s screen`}
            </span>
            <div className="sc-screen-tools">
              {zoomed && (
                <button
                  type="button"
                  className="sc-zoom-reset"
                  onClick={resetZoom}
                  title="Reset zoom"
                  aria-label="Reset zoom"
                >
                  1×
                </button>
              )}
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

        {limits && !ended && (
          <div className={`sc-info ${lowTime ? "low" : ""}`} role="status">
            <span>
              {Math.min(participants.length, 99)}/{limits.max}
            </span>
            <span aria-hidden="true">·</span>
            <span>{fmtLeft(secsLeft)}</span>
            {lowTime && limits.tier === "free" && (
              <button type="button" onClick={() => setShowUpgradeModal(true)}>
                Upgrade
              </button>
            )}
          </div>
        )}

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
          title="Longer sessions"
          subtitle="Upgrade to host longer sessions with more people."
        />
      )}

      {ended &&
        (ended.upgrade ? (
          <UpgradeModal
            isOpen
            title={ended.title}
            subtitle={ended.message}
            onClose={() => onCloseRef.current?.()}
          />
        ) : (
          <div className="sc-ended" role="dialog" aria-modal="true">
            <div className="sc-ended-card">
              <h3>{ended.title}</h3>
              <p>{ended.message}</p>
              <button type="button" onClick={() => onCloseRef.current?.()}>
                Close
              </button>
            </div>
          </div>
        ))}
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