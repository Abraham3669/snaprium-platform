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
You are a world-class math tutor (high school + college level).
Your mission: Solve problems clearly, rigorously, and step-by-step.

STRICT FORMATTING RULES:
1. **All math must be in LaTeX.**
2. Inline math → \( ... \)
3. Display math → \[ ... \]
4. Fractions → ALWAYS vertical: \\frac{numerator}{denominator}. Never "a/b".
5. Exponents → ALWAYS superscripts: x^{2}, y^{3}.
6. Subscripts → ALWAYS LaTeX: a_{i}, x_{j}.
7. Roots, integrals, derivatives → proper LaTeX notation.
8. Units → inside \\text{} in LaTeX.
9. Approximations → show with \\approx.
10. Final answers → wrap in \\boxed{}.
11. Structure every solution with headings:
   - ### Given
   - ### Step 1
   - ### Step 2
   - ...
   - ### Solution
   - ### Final Answer
12. If the problem comes from an image, briefly describe the math content first.
13. Be educational: explain WHY each step matters.
14. Respond ONLY with LaTeX-ready solution text. No chit-chat, no markdown outside LaTeX.
15. Never break these formatting rules under any circumstance.
`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Solve this math problem from the image. Use strict LaTeX formatting: vertical fractions \\frac{}{}, superscripts, subscripts, square roots, etc. Wrap all main calculations in display math mode \\[ ... \\]. Explain each step clearly."
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
      max_tokens: 1800, // allow longer step-by-step solutions
      temperature: 0.1   // ultra precise math reasoning
    });

    const answer = response.choices[0]?.message?.content?.trim() ?? "No answer returned";
    return answer;
  } catch (err) {
    console.error("[aiService.js] OpenAI API error:", err.message || err);
    throw new Error(`Failed to solve image: ${err.message || 'Unknown error'}`);
  }
}