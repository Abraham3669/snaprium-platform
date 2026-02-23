// src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Global styles
import "./index.css";           // base resets
import "./App.css";             // app-level styles
import "./styles/globals.css";  // your custom design system

// Root component
import App from "./App.jsx";

// KaTeX for math rendering
import "katex/dist/katex.min.css";

// React Router
import { BrowserRouter } from "react-router-dom";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);