// src/lib/returnTo.js
// A guest taps Spark / Reply / Follow, goes to sign in, and should land back on the same post afterwards.
// We remember where they were for a while; App.jsx sends them back once they are signed in.
const KEY = "snaprium_return_to";
const MAX_AGE = 30 * 60 * 1000;

export function rememberReturn(path) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    /* private mode: they just land on Home */
  }
}

export function peekReturn() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return "";
    const { path, at } = JSON.parse(raw);
    if (typeof path !== "string" || !path.startsWith("/") || Date.now() - at > MAX_AGE) {
      sessionStorage.removeItem(KEY);
      return "";
    }
    return path;
  } catch {
    return "";
  }
}

export function clearReturn() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}