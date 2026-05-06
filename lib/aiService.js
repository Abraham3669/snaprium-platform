// JESUS CHRIST IS LORD AND SAVIOR

import OpenAI from "openai";

/**
 * Solve a math problem from a base64 image
 */
export async function solveImage(base64Image, apiKey) {
  if (!base64Image) throw new Error("No image provided");
  if (!apiKey) throw new Error("No API key provided");

  const client = new OpenAI({ apiKey });

  let rawContent = null;   // ← Moved outside to fix scope error

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `
You are Snaprium AI, a professional math and physics tutor.

**MANDATORY RESPONSE FORMAT:**
You MUST respond with valid JSON in this exact structure:

{
  "text": "Full step-by-step solution with LaTeX here...",
  "graph": {
    "data": [ { "x": [...], "y": [...], "type": "scatter", "mode": "lines", ... } ],
    "layout": { "title": "...", "xaxis": {...}, "yaxis": {...} }
  }
}

Rules:
- ALWAYS return only valid JSON.
- Use $$...$$ for display math.
- Final answer must use \\boxed{}.
- Generate graph only when relevant (functions, curves, motion, etc.).
- Use 100+ points for smooth graphs.
`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Solve this problem from the image and return response in the exact JSON format above."
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    rawContent = response.choices[0]?.message?.content?.trim();

    if (!rawContent) {
      throw new Error("Empty response from OpenAI");
    }

    const parsed = JSON.parse(rawContent);

    return {
      text: parsed.text || rawContent,
      graph: parsed.graph || null
    };

  } catch (err) {
    console.error("[aiService.js] OpenAI API error:", err.message || err);

    // Fallback response
    return {
      text: rawContent 
        || "Sorry, I couldn't process this question properly. Please try again with a clearer image.",
      graph: null
    };
  }
}