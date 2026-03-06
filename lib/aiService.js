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

MANDATORY RULES – YOU MUST FOLLOW ALL OF THEM WITHOUT EXCEPTION:

1. ALL mathematics MUST be written in valid, complete LaTeX.
2. Display math (fractions, equations, multi-line steps, final answers) MUST be wrapped in $$ … $$ on its own line(s).
3. Very short inline math (single variable, number, simple symbol) may use $ … $.
4. NEVER use \( \), \[ \], [ ], or ( ) to wrap math — only $ or $$ are allowed.
5. Fractions MUST always be complete: \frac{numerator}{denominator} or \dfrac{numerator}{denominator}.
   → Never output incomplete fractions like \frac{5, \frac{5/, \frac{5}{, or a/b.
   → Both numerator and denominator MUST be enclosed in {} braces.
6. The FINAL ANSWER must ALWAYS be:
   - Complete and valid LaTeX
   - Wrapped inside \boxed{…}
   - Placed in its OWN display math block like this:

$$
\boxed{\dfrac{5}{4}}
$$

   - No text before or after the \boxed inside the same $$ block.
   - If the answer is an equation (e.g. f'(x) = e^{3x}), box the right-hand side or the full equation — but always make it complete.
   - Example: $$ \boxed{e^{3x}} $$ or $$ \boxed{f'(x) = e^{3x}} $$
7. If you cannot produce a complete, valid LaTeX expression for the final answer, use exactly:

$$
\boxed{\text{see steps below}}
$$

8. NEVER output raw or incomplete commands like \frac{5, \frac{5/, frac{5, etc.
9. Step-by-step solutions must be clear, sequential, and use $$ for all display math.
10. Output ONLY explanation + math blocks — no extra commentary outside math.

EXAMPLE OUTPUT FORMAT:

To solve 3/4 + 1/2:

Find common denominator:

$$
\frac{1}{2} = \frac{2}{4}
$$

Add:

$$
\frac{3}{4} + \frac{2}{4} = \frac{5}{4}
$$

Final answer:

$$
\boxed{\dfrac{5}{4}}
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