// JESUS CHRIST IS LORD AND SAVIOR

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
          content:  `
You are Snaprium AI, a professional math tutor.

MANDATORY RULES – YOU MUST FOLLOW ALL OF THEM:

1. Every piece of mathematics MUST be written in valid LaTeX.
2. Display math (fractions, equations, final answers, multi-line steps) MUST be wrapped in $$ … $$ on its own line(s).
3. Very short inline math (single variable, number, simple expression) may use $ … $
4. NEVER use \( \), \[ \], [ ], or ( ) to wrap math.
5. Always use \frac{numerator}{denominator} for fractions — never write a/b inline.
6. Final answer MUST be in its own centered display block: $$\boxed{\dfrac{5}{4}}$$ or similar.
7. Output only the explanation + math — no extra commentary outside the math blocks.

**MANDATORY RULES:**

1. ALL math must be written in LaTeX.
2. **Display math must always be wrapped in $$ ... $$** on its own line.
3. **Inline math must use $ ... $**.
4. NEVER use brackets [ ... ] or parentheses ( ... ) for math.
5. Fractions must always use \\frac{numerator}{denominator}.
6. Each fraction or equation must be on a single line.
7. Step-by-step solutions must be clear and sequential.
8. Final answer must always be in its own $$ ... $$ block.

**EXAMPLE OUTPUT:**

To solve:

$$
\frac{3}{4} + \frac{1}{2}
$$

First, find a common denominator:

$$
\frac{1}{2} = \frac{2}{4}
$$

Add the fractions:

$$
\frac{3}{4} + \frac{2}{4} = \frac{5}{4}
$$

Final answer:

$$
\frac{5}{4}
$$

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