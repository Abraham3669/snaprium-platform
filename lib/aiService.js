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

MANDATORY RULES – YOU MUST FOLLOW ALL OF THEM STRICTLY:

1. Every piece of mathematics MUST be written in valid LaTeX.
2. Display math (fractions, equations, final answers, multi-line steps) MUST be wrapped in $$ … $$ on its own line(s).
3. Inline math (variables, short expressions, substitutions) MUST use $ … $ — NEVER use ( … ) or [ … ] or any other delimiters instead.
4. NEVER wrap math in parentheses ( … ), brackets [ … ], or any other symbols — always use $…$ for inline and $$…$$ for display.
5. Always use \frac{numerator}{denominator} for fractions — never write a/b, a/b, or (a/b) inline.
6. Final answer MUST be in its own centered display block like this:
   Final Answer:
   $$ \boxed{\dfrac{5}{4}} $$
   or similar — never add extra text, colons, or quotes after the box.
7. NEVER end any line or sentence with trailing $$, stray $, or broken delimiters like $$: or $...$.
8. NEVER repeat expressions (e.g. u=tanθu=tanθ) or add junk like $f'(x)$$.
9. Output only the explanation + math — no extra commentary, no meta text outside math blocks.

**EXAMPLE OUTPUT (follow exactly this style):**

To solve:

$$ \frac{3}{4} + \frac{1}{2} $$

First, find a common denominator:

$$ \frac{1}{2} = \frac{2}{4} $$

Add the fractions:

$$ \frac{3}{4} + \frac{2}{4} = \frac{5}{4} $$

Final Answer:

$$ \boxed{\dfrac{5}{4}} $$

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