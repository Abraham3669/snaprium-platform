// lib/cors.js

const ALLOWED_ORIGINS = [
  "https://snaprium.com",
  "https://www.snaprium.com",
  "https://localhost",       // Capacitor Android (androidScheme: "https")
  "capacitor://localhost",   // Capacitor iOS / some Android configs
  "http://localhost",        // local dev fallback (optional, remove if you want)
];

export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight request
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true; // caller should stop here, don't run the rest of the handler
  }
  return false;
}