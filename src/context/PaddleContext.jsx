import { createContext, useContext, useEffect, useState } from "react";
import { initializePaddle } from "@paddle/paddle-js";

const PaddleContext = createContext(null);

export const usePaddle = () => {
  const context = useContext(PaddleContext);
  if (!context) throw new Error("usePaddle must be used within PaddleProvider");
  return context;
};

export const PaddleProvider = ({ children }) => {
  const [paddle, setPaddle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
    if (!token) {
      console.error("❌ Missing VITE_PADDLE_CLIENT_TOKEN");
      setError("Paddle token missing");
      setLoading(false);
      return;
    }

    if (typeof window !== "undefined" && window.Paddle?.Environment) {
      window.Paddle.Environment.set("sandbox");
    }

    initializePaddle({
      environment: "sandbox",
      token,
    }).then((instance) => {
      console.log("✅ Paddle sandbox ready");
      setPaddle(instance);
      setLoading(false);
    }).catch((err) => {
      console.error("Paddle init failed:", err);
      setError("Failed to init Paddle");
      setLoading(false);
    });
  }, []);

  const openCheckout = (priceId, user, onSuccess = null) => {
    if (!paddle || !user?.uid) return;

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: user.email },
      customData: { user_id: user.uid, source: "web_upgrade" },
      settings: { theme: "light", locale: "en", displayMode: "overlay" },
      eventCallback: (data) => {
        if (data.name === "checkout.completed") {
          console.log("✅ Checkout completed");
          if (onSuccess) onSuccess(data);
        }
      },
    });
  };

  return (
    <PaddleContext.Provider value={{ openCheckout, loading, error }}>
      {children}
    </PaddleContext.Provider>
  );
};