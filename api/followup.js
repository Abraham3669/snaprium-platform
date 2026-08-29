import { explainFollowUp } from "../lib/aiService.js";
import { applyCors } from "../lib/cors.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { originalText, question, history } = req.body;

    if (!originalText || typeof originalText !== "string") {
      return res.status(400).json({ error: "No originalText provided" });
    }

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "No question provided" });
    }

    if (question.length > 300) {
      return res.status(400).json({ error: "Question too long" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Server configuration error" });
    }

    const answer = await explainFollowUp(
      { originalText, question, history: Array.isArray(history) ? history : [] },
      process.env.OPENAI_API_KEY
    );

    return res.status(200).json({ answer });
  } catch (err) {
    console.error("[followup.js]", err);
    return res.status(500).json({
      error: "Failed to explain that part",
      details: err.message || "Unknown error",
    });
  }
}