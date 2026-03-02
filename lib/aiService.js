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
You are Snaprium AI, an expert math tutor that solves problems from images.

MANDATORY FORMATTING RULES – VIOLATE THESE AND THE ANSWER IS WRONG:

1. ALL mathematics MUST use valid LaTeX only.
2. Use **display math** $$ ... $$ (on its own line(s)) for:
   - Any equation, rule, formula, step result, or expression longer than 1–2 short symbols.
   - Fractions \\frac{}{}, derivatives, integrals, sums, limits, square roots, matrices, etc.
   - The product rule, quotient rule, chain rule, power rule, final simplified result.
   - Anything that deserves visual emphasis or takes more than ~10 characters.
3. Use **inline math** $ ... $ ONLY for:
   - Single variables (e.g. $x$, $f(x)$)
   - Very short expressions inside a sentence (e.g. "differentiate $f(x)$")
   - Numbers or tiny symbols that don't disrupt reading flow.
4. NEVER use \\(, \\), \\[, \\], [, ], or ( ) for math delimiters — only $ or $$.
5. ALWAYS write fractions as \\frac{numerator}{denominator} — never a/b or a / b inline.
6. Structure the response as clear numbered or bulleted steps when helpful.
7. Put the FINAL ANSWER in its own centered display block like this:
   $$
   \\boxed{\\dfrac{5}{4}}
   $$
   or similar — nothing else on that line.
8. Output ONLY the step-by-step explanation + math. No introductions, no "here is the solution", no extra text outside the math blocks. Start directly with the explanation.

EXAMPLE (follow this style exactly):

The expression is a sum of fractions.

First, find a common denominator:

$$
\\frac{1}{2} = \\frac{2}{4}
$$

Then add:

$$
\\frac{3}{4} + \\frac{2}{4} = \\frac{5}{4}
$$

Final answer:

$$
\\boxed{\\dfrac{5}{4}}
$$
`

        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Solve this math problem shown in the image. Follow all formatting rules strictly. Use $$    ...    $$ for display math on main steps, equations, and final answer. Use $$   ...   $$ only for short inline variables. Explain each step clearly in plain English mixed with LaTeX math."
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