// src/pages/CheckoutReturn.jsx
import { useEffect } from "react";

export default function CheckoutReturn() {
  useEffect(() => {
    const appLink = "com.snaprium.app://upgrade-success";
    window.location.href = appLink;

    const t = setTimeout(() => {
      window.location.href = "https://snaprium.com/?upgraded=1";
    }, 1500);

    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        background: "#0f172a",
        color: "#e2e8f0",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 22 }}>Payment received</h1>
      <p style={{ marginTop: 12, opacity: 0.9 }}>
        Returning you to the Snaprium app…
      </p>
      <p style={{ marginTop: 24, fontSize: 14, opacity: 0.7 }}>
        If the app doesn’t open, switch back to Snaprium manually. Your Unlimited
        plan will appear shortly.
      </p>
    </div>
  );
}