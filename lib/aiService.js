// JESUS CHRIST IS LORD AND SAVIOR

import OpenAI from "openai";

/**
 * Solve a math problem from a base64 image using a vision-capable model.
 * @param {string} base64Image - Base64 encoded image (without data: prefix)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} - Returns { text: string, graph?: object }
 */
export async function solveImage(base64Image, apiKey) {
  if (!base64Image) throw new Error("No image provided");
  if (!apiKey) throw new Error("No API key provided");

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1",   // ← Using your preferred model
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
    "data": [
      {
        "x": [array of numbers],
        "y": [array of numbers],
        "type": "scatter",
        "mode": "lines",
        "name": "Function name",
        "line": { "color": "#3b82f6", "width": 3 }
      }
    ],
    "layout": {
      "title": "Graph Title",
      "xaxis": { "title": "x" },
      "yaxis": { "title": "y" }
    }
  }
}

**RULES:**
1. ALWAYS return valid JSON only.
2. "text" must contain the complete step-by-step solution using proper LaTeX.
3. Use $$ ... $$ for display math and $ ... $ for inline math.
4. Final answer must be in \\boxed{}.
5. Generate a "graph" object ONLY when the question involves graphing functions, equations, inequalities, systems, or physics motion graphs.
6. Use at least 100 points for smooth curves (e.g. x from -10 to 10).
7. You can add multiple traces if needed.

Do not add any text outside the JSON.
`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Solve this math/physics problem from the image. Return your response in the exact JSON format specified."
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
      max_tokens: 2000,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);

    return {
      text: parsed.text || content,
      graph: parsed.graph || null
    };

  } catch (err) {
    console.error("[aiService.js] OpenAI API error:", err.message || err);
    
    // Fallback if JSON parsing fails
    if (err.message.includes("JSON")) {
      return {
        text: content || "Sorry, I couldn't process this question properly.",
        graph: null
      };
    }
    
    throw new Error(`Failed to solve image: ${err.message || 'Unknown error'}`);
  }
}