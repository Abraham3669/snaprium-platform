import { solveImage } from "../lib/aiService.js";
import { applyCors } from "../lib/cors.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Safety check for body
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { imageBase64 } = req.body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "No imageBase64 provided" });
    }

    // Optional: reject very large images early (Vercel limit is ~4.5 MB total body)
    if (imageBase64.length > 5_000_000) {
      return res.status(413).json({
        error: "Image too large. Please use a smaller photo (max ~3–4 MB).",
      });
    }

    console.log("[process.js] Received image length:", imageBase64.length);

    if (!process.env.OPENAI_API_KEY) {
      console.error("[process.js] OPENAI_API_KEY is missing!");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const answer = await solveImage(imageBase64, process.env.OPENAI_API_KEY);

    console.log("[process.js] AI answer received");
    return res.status(200).json({ answer });
  } catch (err) {
    console.error("[process.js] API process error:", err);
    // Return a safe message to the client
    return res.status(500).json({
      error: "Failed to process image",
      details: err.message || "Unknown error",
    });
  }
}