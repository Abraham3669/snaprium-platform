// api/room-ai.js
import { applyCors } from "../lib/cors.js";
import OpenAI from "openai";

export default async function handler(req, res) {
  // Must be first
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { topic, question, recentMessages = [] } = req.body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "No question provided" });
    }

    if (question.length > 800) {
      return res.status(400).json({ error: "Question too long (max 800 characters)" });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("[room-ai] OPENAI_API_KEY is missing");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Keep only the last few messages for context
    const history = (Array.isArray(recentMessages) ? recentMessages : [])
      .slice(-6)
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: (m.content || "").slice(0, 600),
      }))
      .filter((m) => m.content.trim().length > 0);

    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.25,
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: `You are Snaprium AI, a friendly and clear math & physics tutor inside a group study room.

Current room topic: ${topic || "Math & Physics"}

STRICT RULES:
- You are speaking to a group of students studying together.
- Be clear, encouraging and collaborative.
- Always use proper LaTeX:
  • Display math → $$ ... $$
  • Inline math → $ ... $
  • Fractions → \\frac{a}{b}
- Prefer giving a helpful hint first when the student is stuck.
- Keep answers focused on the current question.
- Never be condescending.
- Do not invent completely different problems unless asked.`,
        },
        ...history,
        {
          role: "user",
          content: question.trim(),
        },
      ],
    });

    const answer =
      response.choices?.[0]?.message?.content?.trim() ||
      "I couldn't generate a response right now. Please try again.";

    return res.status(200).json({ answer });
  } catch (err) {
    console.error("[room-ai.js] Error:", err);
    return res.status(500).json({
      error: "Failed to get AI response",
      details: err.message || "Unknown error",
    });
  }
}