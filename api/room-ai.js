// api/room-ai.js
import { applyCors } from "../lib/cors.js";
import OpenAI from "openai";

const THANKS_RE =
  /^(thanks|thank you|thx|ty|ok|okay|cool|got it|great|nice|wow|perfect|yes|yep|yeah)\b[.!\s]*$/i;

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

    const cleanQuestion = String(question || "").trim();
    const isShortReaction = THANKS_RE.test(cleanQuestion);

    const cleanBase64 = String(imageBase64 || "").replace(
      /^data:image\/[a-zA-Z]+;base64,/,
      ""
    );

    const visionUrl = isShortReaction
      ? ""
      : cleanBase64
      ? `data:image/jpeg;base64,${cleanBase64}`
      : imageUrl;

    if (!cleanQuestion && !visionUrl) {
      return res.status(400).json({ error: "No question or image provided" });
    }

    if (cleanQuestion.length > 800) {
      return res.status(400).json({ error: "Question too long (max 800 characters)" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Server configuration error" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const history = (Array.isArray(recentMessages) ? recentMessages : [])
      .slice(-8)
      .filter((m) => !/can't see|cannot see|can't view|no photo/i.test(m.content || ""))
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: (m.content || "").slice(0, 500),
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
        ? `${cleanQuestion || "Help the group with this photo."}\n\nA photo IS attached. Read the problem from the image. Do not say you cannot see images.`
        : cleanQuestion,
    });

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.25,
      max_tokens: isShortReaction ? 180 : 1200,
      messages: [
        {
          role: "system",
          content: `You are Snaprium AI, a sharp math and physics tutor inside a live group study room.

Room topic: ${topic || "Math & Physics"}

How you teach:
- You are talking to the group, not one isolated student.
- Watch the recent chat. Do not repeat a solution that was already given.
- If someone says thanks, ok, got it, or a short reaction: reply in 1 short friendly sentence. Do NOT solve again.
- If they ask a follow-up ("why", "explain step 2", "what if", "check this"), answer only that part.
- If they ask to solve a new problem or share a new photo, then solve.
- Prefer a short hint first when they are stuck, then the working.
- After a full solve, end with one check-your-understanding question. Do not restart the whole solution.

When solving:
- Restate the problem in one line.
- Show clean working.
- Give the final answer clearly.
- Use LaTeX: $inline$ and $$display$$. Fractions as \\frac{a}{b}.

Tone:
- Calm, collaborative, not condescending.
- "Let's look at this together..."
- Never say you cannot see images if a photo is attached.`,
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