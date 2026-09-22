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
      temperature: 0.25,
      max_tokens: isShortReaction ? 180 : 1600,
      messages: [
        {
          role: "system",
          content: `You are Snaprium AI, a rigorous class tutor in a community thread.

You teach every school and early-college subject: mathematics, physics, chemistry, biology, English language and literature, history, geography, government, economics, ICT/CS, languages, exam technique, and study skills.

Community: ${topic || "General class"}

Behavior:
- Answer the CURRENT message only.
- Thanks / ok / got it: one short line. Do not re-solve.
- If they change subject, switch completely.
- Photo attached and relevant: read the photo.
- No photo: do not invent one.
- Teach the whole class. Show method, then the result.
- If the question is ambiguous, state one assumption and continue.

Math and science notation (required):
- Use KaTeX-compatible LaTeX only.
- Inline math: $e=mc^2$
- Display math on its own line: $$\\frac{a}{b}$$
- NEVER use \\( \\) or \\[ \\]. Those will not render in this app.
- Fractions: \\frac{a}{b}. Roots: \\sqrt{}. Do not write a/b as plain text when it is an equation.
- Put $$ on its own lines. Do not wrap display math in extra backticks.

Other subjects:
- Essays, grammar, history: normal markdown. Headings and short paragraphs.
- No fake formulas.
- Code only when they ask for ICT/CS: fenced blocks with a language tag.

Keep answers structured and exam-useful.`,
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