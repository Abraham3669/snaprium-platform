// src/lib/alerts.js
//
// Sound and desktop pop-ups for new messages while Snaprium is open in a browser tab (like Discord).
//   - A short chime plays when a new direct message or notification arrives. It is ON by default;
//     Profile → "Message sounds" turns it off for this device.
//   - A desktop pop-up shows only when the tab is hidden (background tab, minimised or covered window), once the person allows it in Profile.
//   - Message requests stay silent on purpose (they only show under Requests).
//   - No sound for your own messages, or for the chat you are looking at right now.
// Works while the app or tab is open. In the iPhone app only the chime plays (no desktop pop-up); when the app is
// closed or in the background the normal push alerts take over.
import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useBlocked } from "./moderation";
import { fetchProfileCard } from "./publicProfile";

const SOUND_KEY = "snaprium:alerts:sound";
const DESK_KEY = "snaprium:alerts:desktop";
const EVENT = "snaprium-alerts";
const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};
const read = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: the choice just lasts until reload */
  }
  window.dispatchEvent(new Event(EVENT));
};

export const soundOn = () => read(SOUND_KEY) !== "off"; // default: on
export const desktopSupported = () => typeof Notification !== "undefined" && !isNative();
export const desktopOn = () => desktopSupported() && Notification.permission === "granted" && read(DESK_KEY) !== "off";

export function setSoundOn(on) {
  write(SOUND_KEY, on ? "on" : "off");
  if (on) playChime();
}

// Turn desktop pop-ups on (asks the browser for permission the first time) or off.
export async function setDesktopOn(on) {
  if (!desktopSupported()) return false;
  if (!on) {
    write(DESK_KEY, "off");
    return false;
  }
  let perm = Notification.permission;
  if (perm === "default") {
    try {
      perm = await Notification.requestPermission();
    } catch {
      perm = "denied";
    }
  }
  write(DESK_KEY, perm === "granted" ? "on" : "off");
  return perm === "granted";
}

export function useAlertPrefs() {
  const [, force] = useState(0);
  useEffect(() => {
    const on = () => force((n) => n + 1);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return {
    sound: soundOn(),
    desktop: desktopOn(),
    desktopSupported: desktopSupported(),
    denied: desktopSupported() && Notification.permission === "denied",
  };
}

// A soft two-note chime made in code (no audio file to ship).
let ctx = null;
export function playChime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + 0.01;
    [[880, 0], [1318.5, 0.11]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + delay);
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + 0.34);
    });
  } catch {
    /* the browser may block sound until the first click: ignore */
  }
}

function popup({ title, body, tag, onClick }) {
  if (!desktopOn()) return;
  try {
    const n = new Notification(title, { body: String(body || "").slice(0, 140), tag });
    n.onclick = () => {
      window.focus();
      n.close();
      onClick?.();
    };
    setTimeout(() => n.close(), 8000);
  } catch {
    /* some browsers refuse; ignore */
  }
}

const ms = (t) => t?.toMillis?.() || (t instanceof Date ? t.getTime() : 0);
// Are you actually using the app right now? On a PC that means the window has focus. The iPhone app and phone
// browsers often report "no focus" even while you are using them, so there "visible on screen" is what counts.
// The desktop pop-up is only for when you cannot see the app (tab in the background, window minimised or covered).
// If the app is on your screen you get the chime only, even when another window has the keyboard focus.
const tabHidden = () => document.visibilityState === "hidden";
const looking = () => {
  if (document.visibilityState !== "visible") return false;
  if (isNative() || window.matchMedia?.("(pointer: coarse)")?.matches) return true;
  return document.hasFocus();
};

// Call once in App. inbox = useInbox(me).list, items = useNotifications(me).items
export function useMessageAlerts({ me, inbox, items, pathname, navigate }) {
  const { blocked } = useBlocked(me);
  const seenDm = useRef(new Map());
  const seenNote = useRef(new Set());
  const armed = useRef(false);
  const latest = useRef({});
  latest.current = { pathname, navigate, blocked };

  // The first snapshots only record what is already there; alerts start a moment after sign-in.
  useEffect(() => {
    armed.current = false;
    seenDm.current = new Map();
    seenNote.current = new Set();
    if (!me) return undefined;
    const t = setTimeout(() => {
      armed.current = true;
    }, 3000);
    return () => clearTimeout(t);
  }, [me]);

  useEffect(() => {
    if (!me) return;
    for (const c of inbox || []) {
      const at = ms(c.lastAt);
      const before = seenDm.current.get(c.id) || 0;
      if (at <= before) continue;
      seenDm.current.set(c.id, at);
      if (!armed.current || c.lastFrom === me || c.incomingRequest || c.declined) continue;
      if (latest.current.blocked?.has?.(c.other)) continue;
      if (latest.current.pathname === `/messages/${c.other}` && looking()) continue; // you are reading it
      if (soundOn()) playChime();
      if (tabHidden()) {
        fetchProfileCard(c.other)
          .catch(() => null)
          .then((card) =>
            popup({
              title: card?.displayName || "New message",
              body: c.lastText,
              tag: `dm-${c.id}`,
              onClick: () => latest.current.navigate?.(`/messages/${c.other}`),
            })
          );
      }
    }
  }, [inbox, me]);

  useEffect(() => {
    if (!me) return;
    for (const n of items || []) {
      if (seenNote.current.has(n.id)) continue;
      seenNote.current.add(n.id);
      if (!armed.current || n.read || n.type === "dm") continue; // new messages already chime above
      if (latest.current.blocked?.has?.(n.fromUid)) continue;
      if (soundOn()) playChime();
      if (tabHidden()) {
        popup({
          title: n.fromName || "Snaprium",
          body: n.preview || "New notification",
          tag: `n-${n.id}`,
          onClick: () => latest.current.navigate?.(n.url || "/notifications"),
        });
      }
    }
  }, [items, me]);
}