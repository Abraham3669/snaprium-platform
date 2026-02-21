// api/process.js
import { solveImage } from "../lib/aiService.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: "No imageBase64 provided" });
  }

  try {
    console.log("Received image length:", imageBase64.length);
    const answer = await solveImage(imageBase64, process.env.OPENAI_API_KEY);
    return res.status(200).json({ answer });
  } catch (err) {
    console.error("API process error:", err);
    return res.status(500).json({ error: "Failed to process image" });
  }
}


console.log("API KEY EXISTS:", !!process.env.OPENAI_API_KEY);