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

1. Every piece of mathematics MUST be written in valid LaTeX.
2. Display math (fractions, equations, final answers, multi-line steps, important definitions) MUST be wrapped in $$ … $$ on its own line(s).
3. Very short inline math (single variable, number, simple expression) MUST use $ … $.
4. NEVER wrap math in parentheses ( ... ), brackets [ ... ], or any other delimiters — NEVER output math like ( u = e^{3x} ) or [v = x^2].
5. When defining variables or functions, ALWAYS use inline $...$ like: Let $u = e^{3x}$ and $v = x^2$.
6. Always use \frac{numerator}{denominator} for fractions — never write a/b inline or in parentheses.
7. Final answer MUST be in its own centered display block:  
   Final Answer:  
   $$ \boxed{ your final result } $$
8. Output only the explanation + math — no extra commentary outside the math blocks.
9. NEVER end any step or sentence with trailing $$ or stray $ delimiters.
10. NEVER write broken LaTeX like $v'$$ or $$: or v'$$ or ( ... )$ or $...($.
11. When continuing a step, do NOT repeat delimiters or add junk like "Next, find$v'$$:" or "Let (u = ... )".
12. Always close math blocks properly: open with $$ or $ and close with the same.
13. Do NOT add any extra characters, colons, or quotes after the boxed answer.
14. Do NOT repeat "Next," or "Then" in broken LaTeX form or with parentheses.

**EXAMPLE OUTPUT:**

To solve:

$$ \frac{3}{4} + \frac{1}{2} $$

First, find a common denominator:

$$ \frac{1}{2} = \frac{2}{4} $$

Add the fractions:

$$ \frac{3}{4} + \frac{2}{4} = \frac{5}{4} $$

Final Answer:

$$ \boxed{\dfrac{5}{4}} $$

**CORRECT VARIABLE DEFINITION EXAMPLE:**

Let $u = e^{3x}$ and $v = x^2$.
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