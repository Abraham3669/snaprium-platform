import { useEffect, useRef, useState } from "react";
import { onAppError, setConfirmedOffline } from "../utils/errorReporter";

// "Online" means a tiny request to the internet really goes through. The browser's own
// online/offline events fire by mistake (Wi-Fi handoffs, sleep, VPNs), so we double-check.
const PROBES = [
  "https://www.gstatic.com/generate_204",
  "https://www.google.com/generate_204",
  "https://snaprium.com/favicon.ico",
];

async function reachable(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    await fetch(`${url}?t=${Date.now()}`, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function probeOnce() {
  // On the website, our own server answering also proves we are online.
  const urls = [];
  if (typeof location !== "undefined" && location.protocol.startsWith("http") && !/^(localhost|127\.)/.test(location.hostname)) {
    urls.push(`${location.origin}/favicon.ico`);
  }
  urls.push(...PROBES);
  for (const url of urls) {
    if (await reachable(url, 4000)) return true;
  }
  return false;
}

// Two failed rounds, a moment apart, before we believe it.
async function confirmOnline() {
  if (await probeOnce()) return true;
  await new Promise((r) => setTimeout(r, 1500));
  return probeOnce();
}

const TONES = {
  offline: { bg: "#1f2937", dot: "#fbbf24" },
  online: { bg: "#14532d", dot: "#86efac" },
  error: { bg: "#1f2937", dot: "#f87171" },
};

function Icon({ kind }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (kind === "online") {
    return (
      <svg {...common}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    );
  }
  if (kind === "offline") {
    return (
      <svg {...common}>
        <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
        <path d="M3 3l18 18" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5v.01" />
    </svg>
  );
}

export default function ErrorBanner() {
  const [offline, setOffline] = useState(false);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState("");
  const offlineRef = useRef(false);
  const runRef = useRef(0);
  const restoredTimer = useRef(null);
  const errorTimer = useRef(null);

  const apply = (isOffline) => {
    if (offlineRef.current === isOffline) return;
    offlineRef.current = isOffline;
    setConfirmedOffline(isOffline);
    setOffline(isOffline);
    if (isOffline) {
      setRestored(false);
      clearTimeout(restoredTimer.current);
    } else {
      setRestored(true);
      clearTimeout(restoredTimer.current);
      restoredTimer.current = setTimeout(() => setRestored(false), 2500);
    }
  };

  // Ask the network for the truth. Newest check wins if several overlap.
  const check = async () => {
    const run = ++runRef.current;
    const online = await confirmOnline();
    if (run !== runRef.current) return;
    apply(!online);
  };

  useEffect(() => {
    const onBrowserOffline = () => check();
    const onBrowserOnline = () => check();
    const onVisible = () => {
      if (document.visibilityState === "visible" && (offlineRef.current || navigator.onLine === false)) check();
    };

    window.addEventListener("offline", onBrowserOffline);
    window.addEventListener("online", onBrowserOnline);
    document.addEventListener("visibilitychange", onVisible);
    if (navigator.onLine === false) check();

    // While we believe we are offline, keep checking so the banner clears by itself.
    const poll = setInterval(() => {
      if (offlineRef.current) check();
    }, 5000);

    return () => {
      window.removeEventListener("offline", onBrowserOffline);
      window.removeEventListener("online", onBrowserOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
      clearTimeout(restoredTimer.current);
      clearTimeout(errorTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return onAppError((text) => {
      if (offlineRef.current) return;
      setError(text);
      clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setError(""), 4000);
    });
  }, []);

  let kind = "";
  let text = "";
  if (offline) {
    kind = "offline";
    text = "You’re offline. Check your internet connection.";
  } else if (restored) {
    kind = "online";
    text = "Back online";
  } else if (error) {
    kind = "error";
    text = error;
  }

  if (!kind) return null;
  const tone = TONES[kind];

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      aria-live="polite"
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 10px)",
        left: 12,
        right: 12,
        zIndex: 99999,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <style>{`@keyframes snaprium-banner-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}`}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: tone.bg,
          color: "#f9fafb",
          padding: "11px 16px",
          borderRadius: 14,
          fontSize: 14,
          fontWeight: 550,
          lineHeight: 1.35,
          maxWidth: 420,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
          animation: "snaprium-banner-in 0.2s ease",
          pointerEvents: "auto",
        }}
      >
        <span style={{ color: tone.dot, display: "inline-flex", flex: "0 0 auto" }}>
          <Icon kind={kind} />
        </span>
        <span>{text}</span>
      </div>
    </div>
  );
}