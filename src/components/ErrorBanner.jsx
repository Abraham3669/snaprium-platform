import { useEffect, useState } from "react";
import { onAppError } from "../utils/errorReporter";

export default function ErrorBanner() {
  const [message, setMessage] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => {
      setOffline(true);
      setMessage("You’re offline. Check your internet connection.");
    };
    const goOnline = () => {
      setOffline(false);
      setMessage("Back online.");
      setTimeout(() => setMessage(""), 2500);
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  useEffect(() => {
    return onAppError((text) => {
      setMessage(text);
      setTimeout(() => {
        setMessage((current) => (current === text ? "" : current));
      }, 4000);
    });
  }, []);

  if (!message && !offline) return null;

  const text = offline ? "You’re offline. Check your internet connection." : message;
  const isOffline = offline || text.toLowerCase().includes("offline");

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        right: 12,
        zIndex: 99999,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: isOffline ? "#333" : "#c62828",
          color: "white",
          padding: "12px 16px",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 500,
          textAlign: "center",
          maxWidth: 420,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}
      >
        {text}
      </div>
    </div>
  );
}