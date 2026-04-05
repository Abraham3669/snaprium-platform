import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import "./App.css";
import "./styles/globals.css";

import App from "./App.jsx";
import 'katex/dist/katex.min.css';

// Context Providers
import { AuthProvider } from "./context/AuthContext.jsx";
import { PaddleProvider } from "./context/PaddleContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PaddleProvider>
          <App />
        </PaddleProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);