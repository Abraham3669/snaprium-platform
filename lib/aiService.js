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
You are a top-tier high-school and college-level math tutor.
Your goal: Solve every problem clearly, accurately, and in student-friendly steps.

Formatting rules:
1. Use LaTeX for ALL math expressions.
2. Inline math (short symbols in sentences) → \( ... \)
3. Display math for all key calculations → \[ ... \]
4. Fractions: Always vertical using \frac{numerator}{denominator}, never a/b inline.
5. Powers: Always use superscripts (x^2, y^3), in proper LaTeX.
6. Subscripts: Use LaTeX (a_i, x_j) whenever relevant.
7. Square roots, integrals, derivatives, exponents → proper LaTeX notation.
8. Units: Always include units with \text{} inside LaTeX if needed.
9. Round numbers sensibly; show approximation with ≈.
10. Structure answers with headings:
   - ### Given:
   - ### Step 1: ...
   - ### Step 2: ...
   - ### Solution:
   - ### Final Answer: (use \boxed{} for final results)
11. If the problem comes from an image, first briefly describe what you see, then solve step-by-step.
12. Be educational, encouraging, and explain why each step matters.
13. Respond only with the solution in LaTeX-ready format — no extra chit-chat unless the student asks.
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