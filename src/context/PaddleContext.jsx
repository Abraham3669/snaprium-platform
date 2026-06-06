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
    const env = import.meta.env.VITE_PADDLE_ENV || "production";

    if (!token) {
      console.error("❌ Missing VITE_PADDLE_CLIENT_TOKEN");
      setError("Paddle token missing");
      setLoading(false);
      return;
    }

    initializePaddle({
      environment: env,
      token,
    })
      .then((instance) => {
        console.log(`✅ Paddle initialized successfully (${env})`);
        setPaddle(instance);
        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ Paddle initialization failed:", err);
        setError("Failed to initialize Paddle");
        setLoading(false);
      });
  }, []);

  // FIXED: Accept object parameter
  const openCheckout = async ({ priceId, userId, email }) => {
    if (!paddle) {
      console.error("Paddle not initialized yet");
      throw new Error("Paddle not ready");
    }

    if (!userId) {
      console.error("No userId provided");
      throw new Error("User ID is required");
    }

    console.log("Opening Paddle Checkout for user:", userId);

    return new Promise((resolve, reject) => {
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: {
          email: email || undefined,
        },
        customData: {
          user_id: userId,
          source: "web_upgrade",
        },
        settings: {
  theme: "light",
  locale: "en",
  displayMode: "inline",
  variant: "multi-page",
},
        eventCallback: (data) => {
          if (data.name === "checkout.completed") {
            console.log("✅ Checkout completed successfully");
            resolve(data);
          }
          if (data.name === "checkout.error") {
            console.error("Paddle Checkout Error:", data);
            reject(data);
          }
        },
      });
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