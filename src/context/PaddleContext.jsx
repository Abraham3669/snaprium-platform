// src/context/PaddleContext.jsx
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
    const env = import.meta.env.VITE_PADDLE_ENV || "sandbox"; // "sandbox" or "production"

    if (!token) {
      console.error("❌ Missing VITE_PADDLE_CLIENT_TOKEN in .env");
      setError("Paddle token missing");
      setLoading(false);
      return;
    }

    initializePaddle({
      environment: env,
      token,
    })
      .then((instance) => {
        console.log(`✅ Paddle initialized (${env})`);
        setPaddle(instance);
        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ Paddle initialization failed:", err);
        setError("Failed to initialize Paddle");
        setLoading(false);
      });
  }, []);

  const openCheckout = (priceId, user, onSuccess = null) => {
    if (!paddle) {
      console.error("Paddle not initialized yet");
      return;
    }
    if (!user?.uid) {
      alert("Please sign in to upgrade.");
      return;
    }

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: {
        email: user.email || undefined,
      },
      customData: {
        user_id: user.uid,
        source: "web_upgrade",
      },
      settings: {
        theme: "light",
        locale: "en",
        displayMode: "overlay",
        variant: "multi-page",        // or "inline"
      },
      eventCallback: (data) => {
        if (data.name === "checkout.completed") {
          console.log("✅ Paddle Checkout Completed", data);
          if (onSuccess) onSuccess(data);
        }
        if (data.name === "checkout.error") {
          console.error("Paddle Checkout Error:", data);
        }
      },
    });
  };

  const value = { 
    openCheckout, 
    loading, 
    error,
    isReady: !!paddle 
  };

  return (
    <PaddleContext.Provider value={value}>
      {children}
    </PaddleContext.Provider>
  );
};