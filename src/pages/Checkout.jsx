// src/pages/Checkout.jsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePaddle } from "../context/PaddleContext";

const UNLIMITED_PRICE_ID = "pri_01ktdn3fppsgkgjhm8xm5ha015";

export default function Checkout() {
  const [params] = useSearchParams();
  const { openCheckout, isReady } = usePaddle();
  const [status, setStatus] = useState("Loading secure checkout...");
  const [error, setError] = useState("");

  const userId = params.get("userId") || "";
  const email = params.get("email") || "";
  const priceId = params.get("priceId") || UNLIMITED_PRICE_ID;

  useEffect(() => {
    if (!isReady) return;

    if (!userId) {
      setError("Missing user. Please go back to the app and try again.");
      setStatus("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setStatus("Opening Paddle checkout...");
        await openCheckout({
          priceId,
          userId,
          email,
          successUrl: "https://snaprium.com/checkout-return",
        });
        if (!cancelled) {
          setStatus("Complete payment in the window above.");
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(
            "Could not open checkout. Please close this tab and try again from the app."
          );
          setStatus("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, userId, email, priceId, openCheckout]);

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
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Snaprium Checkout</h1>
      {status && <p style={{ opacity: 0.9 }}>{status}</p>}
      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      <div
        id="paddle-checkout-container"
        style={{ width: "100%", maxWidth: 480, marginTop: 24 }}
      />
    </div>
  );
}