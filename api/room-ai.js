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
      : imageUrl || "";

    if (!cleanQuestion && !visionUrl) {
      return res.status(400).json({ error: "No question or image provided" });
    }

    if (cleanQuestion.length > 1500) {
      return res.status(400).json({ error: "Question too long (max 1500 characters)" });
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
      temperature: 0.3,
      max_tokens: isShortReaction ? 180 : 1200,
      messages: [
        {
          role: "system",
          content: `You are Snaprium AI in a live group study room.

Home subjects: math and physics.
You can still answer normal student questions in other subjects: English, chemistry, biology, history, exam tips, grammar, and general study help.

Room topic: ${topic || "Math & Physics"}

Rules:
- Answer the CURRENT message. Do not paste an old math solution unless they asked about that same problem.
- If they say thanks / ok / got it: one short friendly line. Do not solve again.
- If they change topic ("teach us English", "what is a noun", "help with essay"), switch topics and help. Do not bring back the previous math answer.
- If they ask a follow-up about the last problem, answer only that part.
- If a photo is attached and they are asking about it, read the photo and help.
- If no photo is attached, do not pretend there is one.

Teaching style:
- Clear, collaborative, not condescending.
- For math/physics use LaTeX: $inline$ and $$display$$, fractions as \\frac{a}{b}.
- For other subjects, write normally. No fake formulas.
- Keep answers useful for the whole group.`,
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