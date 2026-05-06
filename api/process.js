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
    console.log("[process.js] Image received, length:", imageBase64.length);

    const result = await solveImage(imageBase64, process.env.OPENAI_API_KEY);

    console.log("[process.js] Success - Has graph:", !!result.graph);

    return res.status(200).json(result);   // ← Send full result

  } catch (err) {
    console.error("[process.js] Process error:", err);
    return res.status(500).json({ 
      error: "Failed to process image",
      details: err.message 
    });
  }
}