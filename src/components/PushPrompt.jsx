// src/components/PushPrompt.jsx
//
// Asks (nicely) for iPhone notification permission, on its own, a few seconds after sign-in.
// The real iOS pop-up only appears if the person taps "Turn on", because iOS lets an app
// trigger it once. "Not now" asks again after 3 days, at most 3 times in total.

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { enablePush, getPushState } from "../lib/push";

const KEY = "snaprium_push_ask";
const MAX_ASKS = 3;
const GAP_MS = 3 * 24 * 60 * 60 * 1000;
const QUIET_PATHS = ["/login", "/signup", "/onboarding", "/study", "/solo"];

function readAsk() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAsk(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {}
}

export default function PushPrompt({ user }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { pathname } = useLocation();
  const quiet = QUIET_PATHS.some((p) => pathname.startsWith(p));
  const uid = user?.uid;

  useEffect(() => {
    if (!uid || quiet || !Capacitor.isNativePlatform()) return undefined;
    const ask = readAsk();
    const count = ask.count || 0;
    if (count >= MAX_ASKS) return undefined;
    if (count > 0 && Date.now() - (ask.last || 0) < GAP_MS) return undefined;

    let cancelled = false;
    const t = setTimeout(async () => {
      const state = await getPushState();
      if (!cancelled && state === "prompt") setOpen(true);
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [uid, quiet]);

  if (!open || quiet) return null;

  const later = () => {
    const ask = readAsk();
    writeAsk({ count: (ask.count || 0) + 1, last: Date.now() });
    setOpen(false);
  };

  const turnOn = async () => {
    setBusy(true);
    writeAsk({ count: MAX_ASKS, last: Date.now() });
    await enablePush();
    setBusy(false);
    setOpen(false);
  };

  return (
    <div className="pp-backdrop" role="dialog" aria-modal="true" aria-label="Turn on notifications">
      <div className="pp-sheet">
        <span className="pp-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5z" />
            <path d="M10 19a2 2 0 0 0 4 0" />
          </svg>
        </span>
        <h2>Don't miss an answer</h2>
        <p>Get an alert when someone replies to you, answers your question, mentions you or starts a live session.</p>
        <button type="button" className="pp-primary" onClick={turnOn} disabled={busy}>
          {busy ? "One moment…" : "Turn on notifications"}
        </button>
        <button type="button" className="pp-secondary" onClick={later} disabled={busy}>
          Not now
        </button>
      </div>
    </div>
  );
}