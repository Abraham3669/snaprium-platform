// JESUS CHRIST IS LORD AND SAVIOR

import OpenAI from "openai";

/**
 * Solve a math problem from a base64 image
 */
export async function solveImage(base64Image, apiKey) {
  if (!base64Image) throw new Error("No image provided");
  if (!apiKey) throw new Error("No API key provided");

  const client = new OpenAI({ apiKey });
  let rawContent = null;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",   // Recommended for best quality + vision
      messages: [
        {
          role: "system",
          content: `You are Snaprium AI — a clear, friendly, and professional math tutor like Photomath.

**Response Style Rules:**
- Use short, simple, and clear sentences.
- Write step-by-step explanations that are easy for students to understand.
- Keep each step concise (1-2 sentences maximum per step).
- Use proper LaTeX: $$ for display math, $ for inline math.
- Always put the final answer in \\boxed{}.
- Explain concepts simply without unnecessary words.

**Graphing:**
If the question involves graphing a function (linear, quadratic, trig, etc.), include a "graph" section at the end with clear description.

**Important:** Be educational, accurate, and encouraging.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Solve this problem step by step. Use clear explanations and proper LaTeX. If it's a graphable function, mention the key features of the graph."
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
      max_tokens: 2200,
      temperature: 0.25,
    });

    rawContent = response.choices[0]?.message?.content?.trim();

    console.log("✅ AI Response Length:", rawContent?.length || 0);

    return {
      text: rawContent || "Sorry, I couldn't process this question.",
      graph: null   // Auto generator in frontend will handle graphs
    };

  } catch (err) {
    console.error("[aiService.js] Error:", err.message);
    
    return {
      text: "Sorry, I had trouble solving this question. Please try again with a clearer image.",
      graph: null
    };
  }
}