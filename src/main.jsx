import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Global styles
import "./index.css";           // base resets
import "./App.css";             // app-level styles
import "./styles/globals.css";  // your custom design system

// Root component
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);