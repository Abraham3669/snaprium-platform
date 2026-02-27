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

Your task: provide ONLY valid LaTeX mathematics. 

MANDATORY RULES:

1. All inline math must use $ … $, never parentheses or brackets.
2. All display math (fractions, equations, final answers, multi-line steps) must be wrapped in $$ … $$ on their own line(s).
3. Never use \( \), \[ \], ( … ), [ … ], backticks, u'…', quotes, or any programming-style syntax.
4. Fractions must always use \frac{numerator}{denominator}.
5. Step-by-step solutions must be sequential and clear.
6. Final answer must always be in its own centered $$ … $$ block.
7. Do not include any extra commentary, text, or instructions outside the math explanation.
8. When introducing functions, variables, or expressions inline, always use $ … $.
9. Do not include any unnecessary characters, spaces, or symbols.

EXAMPLE:

Correct:

Let $f(x) = e^{3x}$ and $g(x) = x^2$.

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