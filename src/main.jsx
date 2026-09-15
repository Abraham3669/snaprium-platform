import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import "./App.css";
import "./styles/globals.css";

import App from "./App.jsx";
import "katex/dist/katex.min.css";

import { AuthProvider } from "./context/AuthContext.jsx";
import { PaddleProvider } from "./context/PaddleContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <PaddleProvider>
            <App />
          </PaddleProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);