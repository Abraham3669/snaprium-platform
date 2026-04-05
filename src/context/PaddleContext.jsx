import { createContext, useContext, useEffect, useState } from "react";
import { initializePaddle } from "@paddle/paddle-js";

const PaddleContext = createContext(null);

export const usePaddle = () => {
  const context = useContext(PaddleContext);
  if (!context) {
    throw new Error("usePaddle must be used within PaddleProvider");
  }
  return context;
};

export const PaddleProvider = ({ children }) => {
  const [paddle, setPaddle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;

    if (!token) {
      console.warn("⚠️ Missing VITE_PADDLE_CLIENT_TOKEN in environment variables");
      setError("Paddle token is missing");
      setLoading(false);
      return;
    }

    const env = import.meta.env.PROD ? "production" : "sandbox";

    initializePaddle({
      environment: env,           // Automatically uses production on Vercel
      token: token,
    })
      .then((paddleInstance) => {
        setPaddle(paddleInstance);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Paddle initialization failed:", err);
        setError("Failed to load payment system");
        setLoading(false);
      });
  }, []);

  const openCheckout = (priceId, onSuccess = null) => {
    if (!paddle) {
      alert("Payment system is still loading. Please refresh and try again.");
      return;
    }

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      settings: {
        theme: "light",
        locale: "en",
        displayMode: "overlay",
      },
      eventCallback: (data) => {
        console.log("Paddle Event:", data);

        if (data.name === "checkout.completed") {
          console.log("✅ Payment successful!");
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