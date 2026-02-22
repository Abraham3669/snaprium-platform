import OpenAI from "openai";

/**
 * Solve a math problem from a base64 image using a vision-capable model.
 * @param {string} base64Image - Base64 encoded image (without data: prefix)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} - AI answer text
 */
export async function solveImage(base64Image, apiKey) {
  if (!base64Image) throw new Error("No image provided");
  if (!apiKey) throw new Error("No API key provided");

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",          // ← safe & cheap choice; change to "gpt-4o" or "gpt-4.1-mini" if you have access/budget
      messages: [
        {
          role: "system",
          content: `You are an excellent high-school/college level math tutor. Your goal is to help students understand problems clearly and deeply.

When solving math problems:
- Always explain step-by-step in clear, friendly language.
- Use LaTeX for ALL mathematical expressions.
- For inline math (short symbols or variables inside sentences) use \( ... \)
- For key equations, important steps, fractions, results, and anything that deserves emphasis — ALWAYS use display math mode: \[ ... \]  (this creates centered, larger, vertically stacked fractions that look professional and easy to read).
- Prefer display mode \[ \] for fractions like \frac{numerator}{denominator}, quadratic formulas, integrals, derivatives, etc. — never write them inline or as plain text a/b.
- Never use plain text fractions like 400/19.6 — always \frac{400}{19.6} in display mode when it's a main calculation.
- Use proper units, significant figures, and round sensibly (show ≈ when approximating).
- Structure answers with headings like ### Step 1: ..., ### Given:, ### Solution:, ### Final Answer: in bold.
- If the problem comes from an image, first describe what you see briefly, then solve.
- Be encouraging and educational — explain why each step matters.

Respond only with the solution — no extra chit-chat unless the student asks a question.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Solve this math problem shown in the image. Explain step by step." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,               // adjust as needed
      temperature: 0.3                // lower for more precise math solving
    });

    const answer = response.choices[0]?.message?.content?.trim() ?? "No answer returned";
    return answer;
  } catch (err) {
    console.error("[aiService.js] OpenAI API error:", err.message || err);
    throw new Error(`Failed to solve image: ${err.message || 'Unknown error'}`);
  }
}