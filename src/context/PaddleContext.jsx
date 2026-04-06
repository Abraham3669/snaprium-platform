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
      console.error("❌ Missing VITE_PADDLE_CLIENT_TOKEN in .env");
      setError("Paddle token is missing. Check your environment variables.");
      setLoading(false);
      return;
    }

    console.log("🔧 Setting Paddle to SANDBOX mode");

    if (typeof window !== "undefined" && window.Paddle?.Environment) {
      window.Paddle.Environment.set("sandbox");
    }

    initializePaddle({
      environment: "sandbox",
      token: token,
    })
      .then((paddleInstance) => {
        console.log("✅ Paddle sandbox initialized successfully");
        setPaddle(paddleInstance);
        setLoading(false);
      })
      .catch((err) => {
        console.error("🚨 Paddle initialization failed:", err);
        setError("Failed to load Paddle payment system. Check console.");
        setLoading(false);
      });
  }, []);

  const openCheckout = (priceId, user, onSuccess = null) => {
    if (!paddle) {
      alert("Payment system is still loading. Please wait a moment and try again.");
      return;
    }

    if (!user?.uid) {
      alert("Please sign in to upgrade your plan.");
      return;
    }

    console.log(`🚀 Opening sandbox checkout for price: ${priceId} | User: ${user.uid}`);

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: {
        email: user.email || undefined,
      },
      customData: {
        user_id: user.uid,           // Required for webhook
        source: "web_upgrade",
      },
      settings: {
        theme: "light",
        locale: "en",
        displayMode: "overlay",
      },
      eventCallback: (data) => {
        console.log("Paddle Event:", data.name);

        if (data.name === "checkout.completed") {
          console.log("✅ Sandbox checkout completed successfully!");
          
          // Call the success handler passed from Upgrade page (confetti, alert, etc.)
          if (onSuccess) {
            onSuccess(data);
          }
        }

        if (data.name === "checkout.payment.failed") {
          console.warn("❌ Sandbox payment failed:", data);
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