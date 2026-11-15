const listeners = new Set();

export function onAppError(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// ErrorBanner checks the connection for real (not just the browser's guess) and tells us here,
// so network errors don't show a second, wrong message while the offline banner is already up.
let confirmedOffline = false;
export function setConfirmedOffline(value) {
  confirmedOffline = Boolean(value);
}
export function isConfirmedOffline() {
  return confirmedOffline;
}

// Things that are not real problems: the person closed a popup, a request was cancelled
// on purpose, a background read was refused while signing in/out, and so on.
const QUIET_CODES = new Set([
  "cancelled",
  "aborted",
  "permission-denied",
  "unauthenticated",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
  "auth/web-storage-unsupported",
]);

const QUIET_TEXT = ["resizeobserver", "abort", "user cancelled", "user canceled", "the operation was cancelled"];

function friendlyMessage(source, error) {
  const code = String(error?.code || "");
  const raw = String(error?.message || error || "").toLowerCase();

  if (error?.name === "AbortError" || QUIET_CODES.has(code) || QUIET_TEXT.some((t) => raw.includes(t))) {
    return null;
  }

  const looksLikeNetwork =
    code === "unavailable" ||
    code === "auth/network-request-failed" ||
    raw.includes("offline") ||
    raw.includes("network") ||
    raw.includes("failed to fetch") ||
    raw.includes("load failed");

  if (looksLikeNetwork) {
    // Really offline: the banner already says so. Browser thinks it is offline: let the banner confirm first.
    if (confirmedOffline || (typeof navigator !== "undefined" && navigator.onLine === false)) return null;
    // Online, and the database is just retrying by itself: nothing for the person to do.
    if (code === "unavailable") return null;
    return "Couldn’t reach the server. Please try again.";
  }

  if (source === "Google Sign-In" || source === "Google Sign-Up") {
    return "Google sign-in failed. Please try again.";
  }

  if (source === "Process Image") {
    return "Couldn’t process that image. Please try again.";
  }

  if (source === "Create profile" || source === "Auth Snapshot Listener") {
    return null;
  }

  return "Something went wrong. Please try again.";
}

let lastText = "";
let lastAt = 0;

export function showAppError(source, error) {
  console.error(`[${source}]`, error?.code, error);
  const message = friendlyMessage(source, error);
  if (!message) return;
  // Same message again within a few seconds: show it once.
  const now = Date.now();
  if (message === lastText && now - lastAt < 6000) return;
  lastText = message;
  lastAt = now;
  listeners.forEach((cb) => cb(message));
}