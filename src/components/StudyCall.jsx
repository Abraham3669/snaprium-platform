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

      // Play everyone else's mic. Keep your own muted to avoid echo.
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

  return (
    <div className="study-call">
      {screens.length > 0 && (
        <div className="study-call-stage">
          {screens.map((p) => (
            <video
              key={`screen-${p.session_id}`}
              data-daily-screen={p.session_id}
              autoPlay
              playsInline
              muted
            />
          ))}
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
            {!p.local && (
              <audio data-daily-audio={p.session_id} autoPlay />
            )}
            <div className="study-call-name">
              {p.local ? "You" : p.user_name || "Student"}
            </div>
          </div>
        ))}
      </div>

      <div className="study-call-controls">
        <button type="button" onClick={toggleMic}>{micOn ? "Mute" : "Unmute"}</button>
        <button type="button" onClick={toggleCam}>{camOn ? "Camera off" : "Camera on"}</button>
        <button type="button" onClick={toggleShare}>{sharing ? "Stop share" : "Share screen"}</button>
        <button type="button" className="study-call-leave" onClick={leave}>Leave call</button>
      </div>
    </div>
  );
}