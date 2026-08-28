import { applyCors } from "../lib/cors.js";

function stripSolution(text) {
  if (!text) return "";

  let out = text.trim();

  out = out.replace(/```[\s\S]*?```/g, "");
  out = out.replace(/\\boxed\{[\s\S]*?\}/g, "");

  const cut = out.search(
    /(\n\s*)?(step\s*\d+|solution|final answer|therefore|hence|thus|answer\s*:|worked solution)/i
  );
  if (cut > 40) out = out.slice(0, cut);

  out = out
    .replace(/^#+\s*/gm, "")
    .replace(/^\**question:\**\s*/i, "")
    .replace(/\*\*/g, "")
    .trim();

  return out;
}

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

    const source = originalText.slice(0, 2500);

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.9,
        max_tokens: 250,
        messages: [
          {
            role: "system",
            content: `You create a short practice question only.

Never solve.
Never give an answer.
Never write steps.
Never repeat the original problem.
If you include an equals result or "therefore", you failed.`,
          },
          {
            role: "user",
            content: `This is a solved problem. Ignore every answer and every step. Use only the topic.

"""
${source}
"""

Write one NEW question on the same topic.
Change every number and the story/wording.

Output format:
- 2 to 5 short sentences, or one short problem statement
- Math in KaTeX: $inline$ and $$display$$
- No title
- No "Question:"
- No solution`,
          },
        ],
      }),
    });

    const data = await r.json();
    let question = stripSolution(data?.choices?.[0]?.message?.content || "");

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