// api/process.js
import { solveWithGPTVision } from "../lib/aiService.js";

export async function POST(req, res) {
  try {
    const { imageBase64, text } = await req.json();

    if (imageBase64) {
      // Solve using GPT-4.1 Vision
      const solution = await solveWithGPTVision(imageBase64);
      return res.status(200).json({ solution });
    } else if (text) {
      // Existing text-based solution logic (if any)
      // Example: call GPT text model
      const solution = `Text solution placeholder for: ${text}`;
      return res.status(200).json({ solution });
    } else {
      return res.status(400).json({ error: "No input provided" });
    }
  } catch (error) {
    console.error("Error in process:", error);
    res.status(500).json({ error: error.message });
  }
}