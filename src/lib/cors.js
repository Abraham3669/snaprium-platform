// lib/cors.js

const ALLOWED_ORIGINS = [
  "https://snaprium.com",
  "https://www.snaprium.com",
  "https://localhost",          // Capacitor Android (androidScheme: "https") ← this is the one failing right now
  "http://localhost",           // Capacitor Android fallback / some configs
  "capacitor://localhost",      // Capacitor iOS
  "http://localhost:5173",      // Vite dev
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

export function applyCors(req, res) {
  const origin = req.headers.origin;

  // Only reflect the origin if it is in the allow-list
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version, X-CSRF-Token"
  );
  res.setHeader("Access-Control-Max-Age", "86400"); // cache preflight for 24h
  res.setHeader("Vary", "Origin");

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true; // tell the caller to stop
  }

  return false;
}