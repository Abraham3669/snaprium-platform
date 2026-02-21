import { solveImage } from "../../lib/aiService";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { imageBase64 } = req.body;
    try {
      const answer = await solveImage(imageBase64, process.env.OPENAI_API_KEY);
      res.status(200).json({ answer });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to process image" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}