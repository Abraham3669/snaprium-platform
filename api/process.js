import { solveImage } from "../lib/aiService.js";
import { applyCors } from "../lib/cors.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return; // handles preflight (OPTIONS) requests

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: "No imageBase64 provided" });
  }

  try {
    console.log("[process.js] Received image length:", imageBase64.length);

    const answer = await solveImage(imageBase64, process.env.OPENAI_API_KEY);

    console.log("[process.js] AI answer:", answer);

    return res.status(200).json({ answer });
  } catch (err) {
    console.error("[process.js] API process error:", err);
    return res.status(500).json({ error: "Failed to process image" });
  }
}