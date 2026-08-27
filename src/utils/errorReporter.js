const listeners = new Set();

export function onAppError(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function friendlyMessage(source, error) {
  const code = error?.code || "";
  const raw = (error?.message || String(error) || "").toLowerCase();

  if (
    code === "unavailable" ||
    raw.includes("offline") ||
    raw.includes("network") ||
    raw.includes("failed to fetch")
  ) {
    return "You’re offline. Check your internet connection.";
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

export function showAppError(source, error) {
  console.error(`[${source}]`, error?.code, error);
  const message = friendlyMessage(source, error);
  if (!message) return;
  listeners.forEach((cb) => cb(message));
}