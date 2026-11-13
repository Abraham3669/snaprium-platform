// src/lib/useSessionStatus.js
// Asks the server "is there a live session in this circle, and how many people are in it?"
// It only LOOKS. It never starts a session and never counts against anyone's daily limit.

import { useCallback, useEffect, useRef, useState } from "react";
import { getAuth } from "firebase/auth";
import "./firebase"; // makes sure the Firebase app is started before getAuth()
import { postAPI } from "../utils/apiClient";
import "../styles/live-status.css";

const POLL_MS = 20000;

// "3/5 in session · 32 min left"
export function sessionLabel(status) {
  if (!status?.live) return "";
  const parts = [];
  if (typeof status.count === "number" && status.max) {
    parts.push(`${status.count}/${status.max} in session`);
  }
  const secs = status.expiresAt ? Math.floor(status.expiresAt - Date.now() / 1000) : null;
  if (secs !== null && secs > 0) {
    const m = Math.ceil(secs / 60);
    if (m < 60) parts.push(`${m} min left`);
    else {
      const h = Math.floor(m / 60);
      const r = m % 60;
      parts.push(r ? `${h}h ${r}m left` : `${h}h left`);
    }
  }
  return parts.join(" · ");
}

// Pass a circle id to start checking, or null/"" to stay quiet.
export default function useSessionStatus(communityId) {
  const [status, setStatus] = useState(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!communityId || busy.current) return;
    busy.current = true;
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) return;
      const data = await postAPI("/api/daily-room", {
        roomId: `community-${communityId}-session`,
        action: "status",
        idToken,
      });
      if (data?.ok) {
        setStatus({
          live: !!data.live,
          count: typeof data.count === "number" ? data.count : null,
          max: data.max || 0,
          tier: data.tier || "free",
          expiresAt: data.expiresAt || 0,
        });
      }
    } catch {
      // a failed check just keeps the last known status
    } finally {
      busy.current = false;
    }
  }, [communityId]);

  useEffect(() => {
    if (!communityId) {
      setStatus(null);
      return undefined;
    }
    refresh();
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [communityId, refresh]);

  return { status, refresh };
}