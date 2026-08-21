// src/utils/errorReporter.js

// Simple pub-sub so any file can trigger a visible error banner
const listeners = new Set();

export function onAppError(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function showAppError(source, error) {
  const message = error?.message || String(error);
  const code = error?.code ? ` (${error.code})` : '';
  const fullMessage = `[${source}]${code} ${message}`;

  console.error(fullMessage, error);
  listeners.forEach((cb) => cb(fullMessage));
}