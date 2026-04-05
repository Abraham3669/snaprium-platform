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

    // Force sandbox for testing
    console.log("🔧 Setting Paddle to SANDBOX mode");
    
    // Important: Set environment BEFORE initializing
    window.Paddle?.Environment?.set("sandbox");

    initializePaddle({
      environment: "sandbox",     // Force sandbox
      token: token,               // Must be your SANDBOX token (starts with test_)
    })
      .then((paddleInstance) => {
        console.log("✅ Paddle initialized successfully in sandbox");
        setPaddle(paddleInstance);
        setLoading(false);
      })
      .catch((err) => {
        console.error("🚨 Paddle initialization failed:", err);
        setError("Failed to load Paddle payment system. Check console for details.");
        setLoading(false);
      });
  }, []);

  const openCheckout = (priceId, onSuccess = null) => {
    if (!paddle) {
      alert("Payment system is still loading. Please wait a moment and try again.");
      return;
    }

    console.log(`🚀 Opening sandbox checkout for price: ${priceId}`);

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      settings: {
        theme: "light",
        locale: "en",
        displayMode: "overlay",
      },
      customer: {
        email: "test-customer@example.com",   // Optional: helps with testing
      },
      eventCallback: (data) => {
        console.log("Paddle Event:", data);

        if (data.name === "checkout.completed") {
          console.log("✅ Sandbox payment completed successfully!");
          if (onSuccess) onSuccess(data);
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