import OpenAI from "openai";

/**
 * Solve a math problem from a base64 image using a vision-capable model.
 * @param {string} base64Image - Base64 encoded image (without data: prefix)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} - AI answer text (LaTeX-ready)
 */
export async function solveImage(base64Image, apiKey) {
  if (!base64Image) throw new Error("No image provided");
  if (!apiKey) throw new Error("No API key provided");

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1", // high-quality math reasoning
      messages: [
        {
          role: "system",
          content: `
You are Snaprium AI, a professional math tutor.

STRICT FORMATTING RULES (MUST FOLLOW):

1. Use LaTeX for ALL mathematical expressions.
2. Use \\frac{a}{b} for fractions — NEVER write a/b.
3. Wrap display equations with $$ on their own lines.
4. Wrap inline math with $...$.
5. Put EACH equation step on its own display block.
6. Never use code blocks for math.
7. Never explain LaTeX syntax.
8. Do not use markdown tables.
9. Keep solutions clean and readable.
10. Show step-by-step logical progression.

FORMAT STRUCTURE:

- Start with a short sentence introducing the solution.
- Then show steps clearly.
- Each mathematical transformation must be inside $$ ... $$.
- Final answer must be in a separate $$ block.

EXAMPLE FORMAT:

To solve the equation:

$$
2x + 5 = 15
$$

Subtract 5 from both sides:

$$
2x = 10
$$

Divide both sides by 2:

$$
x = 5
$$

IMPORTANT:
If a fraction appears, always write it as:

$$
\\frac{numerator}{denominator}
$$

Never output raw slashes like 3/4.
`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Solve this math problem from the image. Use proper LaTeX: vertical fractions \\frac{}{}, superscripts, subscripts, square roots, etc. Wrap all main calculations in display math mode \\[ ... \\]. Explain each step clearly."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1500, // increase if you want longer step-by-step solutions
      temperature: 0.2   // lower for precise math reasoning
    });

    const answer = response.choices[0]?.message?.content?.trim() ?? "No answer returned";
    return answer;
  } catch (err) {
    console.error("[aiService.js] OpenAI API error:", err.message || err);
    throw new Error(`Failed to solve image: ${err.message || 'Unknown error'}`);
  }
}