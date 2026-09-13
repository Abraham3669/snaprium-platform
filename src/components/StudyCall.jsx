// src/components/StudyCall.jsx
import { useEffect, useRef, useState } from "react";
import DailyIframe from "@daily-co/daily-js";
import { postAPI } from "../utils/apiClient";
import { toast } from "react-toastify";

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

        if (!data?.url) {
          throw new Error(data?.error || "No Daily room URL returned");
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
      const el = document.querySelector(`[data-daily-session="${p.session_id}"]`);
      if (!el) return;
      const track = p?.tracks?.video?.persistentTrack || p?.tracks?.video?.track;
      if (track) {
        const current = el.srcObject?.getVideoTracks?.()[0];
        if (current !== track) {
          el.srcObject = new MediaStream([track]);
        }
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
    } catch {
      toast.error("Screen share works best on desktop");
    }
  };

  const leave = async () => {
    try {
      await callRef.current?.leave();
    } catch {}
    onCloseRef.current?.();
  };

  return (
    <div className="study-call">
      <div className="study-call-strip">
        {joining && <div className="study-call-status">Joining call...</div>}
        {error && <div className="study-call-status">{error}</div>}

        {participants.map((p) => (
          <div key={p.session_id} className="study-call-tile">
            <video
              data-daily-session={p.session_id}
              autoPlay
              playsInline
              muted={!!p.local}
            />
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