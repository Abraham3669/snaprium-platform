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

    const { originalText } = req.body;

    if (!originalText || typeof originalText !== "string") {
      return res.status(400).json({ error: "No originalText provided" });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("[practice.js] OPENAI_API_KEY is missing!");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You write practice questions for Snaprium. Output must render in KaTeX/markdown.",
          },
          {
            role: "user",
            content: `Write ONE similar practice question for a student.

From this solved problem:
"""
${originalText.slice(0, 4000)}
"""

Rules:
- Same subject and difficulty (math or physics only)
- New numbers and wording
- Return ONLY the question text
- No answer, no steps, no title, no "Question:" label
- Write every formula in LaTeX
- Inline math: $v = u + at$
- Display math: $$\\frac{1}{2}mv^2$$
- Do not use \\boxed
- Do not use \\begin{align} unless needed
- Use plain sentences around the math
- Do not escape dollars as \\$`,
          },
        ],
      }),
    });

    const data = await r.json();
    let question = data?.choices?.[0]?.message?.content?.trim() || "";

    question = question
      .replace(/^#+\s*/gm, "")
      .replace(/^\**Question:\**\s*/i, "")
      .replace(/\\boxed\{([\s\S]*?)\}/g, "$1")
      .trim();

    if (!question) {
      console.error("[practice.js] empty model response", data);
      return res.status(500).json({ error: "Could not generate practice question" });
    }

    return res.status(200).json({ question });
  } catch (err) {
    console.error("[practice.js] error:", err);
    return res.status(500).json({
      error: "Failed to generate practice question",
      details: err.message || "Unknown error",
    });
  }
}