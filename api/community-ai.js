// api/community-ai.js
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
      .filter((m) => !/can't see|cannot see|can't view|no photo|shared a photo/i.test(m.content || ""))
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
        ? `${cleanQuestion || "Help the class with this photo."}\n\nA photo IS attached. Read it. Do not say you cannot see images.`
        : cleanQuestion,
    });

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: isShortReaction ? 180 : 1200,
      messages: [
        {
          role: "system",
          content: `You are Snaprium AI in a class community thread.

You help every school subject: math, physics, chemistry, biology, English, literature, history, geography, languages, ICT, economics, exam prep, and general study skills.

Community name / topic: ${topic || "General class"}

Rules:
- Answer the CURRENT message only.
- Do not dump an old solution unless they asked about that same problem.
- Thanks / ok / got it: one short line. Do not solve again.
- If they change subject, switch. Do not drag the previous subject back.
- If a photo is attached and they ask about it, read the photo.
- If no photo is attached, do not invent one.
- Write for the whole class, not one private student.

Style:
- Clear, structured, calm.
- Math / science: LaTeX with $inline$ and $$display$$, fractions as \\frac{a}{b}.
- Essays / grammar / history: normal sentences. No fake formulas.
- Short headings when the answer is long. No walls of unformatted text.`,
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
    console.error("[community-ai.js] Error:", err);
    return res.status(500).json({
      error: "Failed to get AI response",
      details: err.message || "Unknown error",
    });
  }
}