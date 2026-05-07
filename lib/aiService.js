// JESUS CHRIST IS LORD AND SAVIOR

import OpenAI from "openai";

export async function solveImage(base64Image, apiKey) {
  if (!base64Image) throw new Error("No image provided");
  if (!apiKey) throw new Error("No API key provided");

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are Snaprium AI — a clean, concise math tutor like Photomath.

**Strict Rules:**
- Keep explanations **short and simple**. One idea per step.
- Use very clear, student-friendly language.
- Each step should be 1 short sentence when possible.
- Use proper LaTeX: $...$ for inline, $$...$$ for display equations.
- Always end with \\boxed{answer}.
- Do not write long paragraphs.
- For powers use ^{} properly (e.g. x^{2}, not x^2).
- For square roots use \\sqrt{}.
- Keep total response short and scannable.

**Example style:**
Step 1: Add 7 to both sides.

$$
3x = 15
$$

Step 2: Divide by 3.

$$
x = 5
$$

Final answer: $\\boxed{5}$`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Solve the problem step by step. Keep it short, clean and use proper LaTeX. Put final answer in \\boxed{}."
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
      max_tokens: 1800,
      temperature: 0.2,
    });

    const rawContent = response.choices[0]?.message?.content?.trim();

    console.log("AI Response Length:", rawContent?.length);

    return {
      text: rawContent || "Could not solve this question.",
      graph: null
    };

  } catch (err) {
    console.error("[aiService.js] Error:", err.message);
    return {
      text: "Sorry, I couldn't solve this. Please try a clearer image.",
      graph: null
    };
  }
}