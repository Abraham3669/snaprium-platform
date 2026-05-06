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
    console.log("[process.js] Received image length:", imageBase64.length);

    // Call AI service
    const result = await solveImage(imageBase64, process.env.OPENAI_API_KEY);

    // Debug log
    console.log("[process.js] AI result received. Has graph:", !!result.graph);

    // Return in format expected by frontend
    return res.status(200).json({
      text: result.text,
      graph: result.graph
    });

  } catch (err) {
    console.error("[process.js] API process error:", err);
    return res.status(500).json({ 
      error: "Failed to process image",
      details: err.message 
    });
  }
}