// api/room-ai.js
import { applyCors } from "../lib/cors.js";
import OpenAI from "openai";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const {
      topic,
      question = "",
      recentMessages = [],
      imageUrl = "",
      imageBase64 = "",
    } = req.body;

    const cleanBase64 = String(imageBase64 || "").replace(
      /^data:image\/[a-zA-Z]+;base64,/,
      ""
    );

    const visionUrl = cleanBase64
      ? `data:image/jpeg;base64,${cleanBase64}`
      : imageUrl;

    if (!question.trim() && !visionUrl) {
      return res.status(400).json({ error: "No question or image provided" });
    }

    if (question.length > 800) {
      return res.status(400).json({ error: "Question too long (max 800 characters)" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Server configuration error" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const history = (Array.isArray(recentMessages) ? recentMessages : [])
      .slice(-6)
      .filter((m) => !/can't see|cannot see|can't view|no photo/i.test(m.content || ""))
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: (m.content || "").slice(0, 400),
      }))
      .filter((m) => m.content && m.content.trim().length > 0);

    const userContent = [];

    if (visionUrl) {
      userContent.push({
        type: "image_url",
        image_url: { url: visionUrl, detail: "high" },
      });
    }

    userContent.push({
      type: "text",
      text: visionUrl
        ? `${question.trim() || "Help the group with this photo."}\n\nA photo IS attached. Read the problem from the image. Do not say you cannot see images.`
        : question.trim(),
    });

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 1100,
      messages: [
        {
          role: "system",
          content: `You are Snaprium AI in a group study room.
Topic: ${topic || "Math & Physics"}

If an image is attached, you CAN see it.
Read the problem from the photo first.
Never say you cannot view images.
Restate the problem, give a hint, then solve with LaTeX: $inline$ and $$display$$.`,
        },
        ...history,
        { role: "user", content: userContent },
      ],
    });

    const answer =
      response.choices?.[0]?.message?.content?.trim() ||
      "I couldn't generate a response right now. Please try again.";

    return res.status(200).json({
      answer,
      sawImage: Boolean(visionUrl),
    });
  } catch (err) {
    console.error("[room-ai.js] Error:", err);
    return res.status(500).json({
      error: "Failed to get AI response",
      details: err.message || "Unknown error",
    });
  }
}