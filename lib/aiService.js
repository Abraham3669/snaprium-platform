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

MANDATORY RULES – YOU MUST FOLLOW EVERY SINGLE ONE WITHOUT EXCEPTION:

1. ALL mathematics MUST be written in **valid, complete LaTeX**.
2. Display math (fractions, equations, sums, integrals, final answers, multi-line steps) MUST be wrapped in $$ … $$ on its own line(s).
3. Very short inline math (single variable, number, simple symbol) may use $ … $.
4. NEVER use \( \), \[ \], [ ], or ( ) to wrap math — only $ or $$ delimiters are allowed.
5. Fractions MUST always be written as \frac{numerator}{denominator} or \dfrac{numerator}{denominator}.  
   → Never write a/b, 5/2, \frac{5, \frac{5/, or any incomplete fraction.
   → Both numerator and denominator MUST be enclosed in {} braces.
6. The FINAL ANSWER must always be:
   - Complete and valid LaTeX
   - Wrapped inside \boxed{…}
   - Placed in its own display math block like this:

$$
\boxed{\dfrac{5}{4}}
$$

   - Nothing else is allowed in the same math block (no text before/after the \boxed).
   - If the answer is an equation (e.g. f'(x) = e^{3x}), box the entire right-hand side or the full equation.
7. If you cannot produce a complete, valid LaTeX expression for the final answer, use:

$$
\boxed{\text{see steps below}}
$$

8. NEVER output raw or incomplete commands like \frac{5, \frac{5}{, \frac{5/2, etc.
9. Step-by-step solutions must be clear, numbered or bulleted, and sequential.
10. Output ONLY the explanation + math blocks — no extra commentary, no "here is the answer", no chit-chat outside math.

EXAMPLE OUTPUT FORMAT:

Problem: Add 3/4 + 1/2

Explanation:

To add fractions, find a common denominator:

$$
\frac{1}{2} = \frac{2}{4}
$$

Now add:

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