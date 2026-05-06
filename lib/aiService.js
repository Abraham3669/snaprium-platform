// JESUS CHRIST IS LORD AND SAVIOR

import OpenAI from "openai";

export async function solveImage(base64Image, apiKey) {
  if (!base64Image) throw new Error("No image provided");
  if (!apiKey) throw new Error("No API key provided");

  const client = new OpenAI({ apiKey });

  let rawContent = null;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",                    // ← Changed to gpt-4o (more reliable)
      messages: [
        {
          role: "system",
          content: `You are Snaprium AI. You are an expert math tutor.

You MUST reply with **valid JSON only** using this exact structure. No extra text.

{
  "text": "Write the full step-by-step solution here. Use LaTeX with $$ for display math. Put final answer in \\boxed{}.",
  "graph": null
}

OR if the question asks to graph a function or it is graphable:

{
  "text": "... step by step ...",
  "graph": {
    "data": [
      {
        "x": [-10,-9.5,-9,...,9.5,10],
        "y": [calculated values],
        "type": "scatter",
        "mode": "lines",
        "name": "y = 2x + 3",
        "line": { "color": "#2563eb", "width": 4 }
      }
    ],
    "layout": {
      "title": "Graph of y = 2x + 3",
      "xaxis": { "title": "x", "gridcolor": "#e5e7eb" },
      "yaxis": { "title": "y", "gridcolor": "#e5e7eb" }
    }
  }
}

Rules:
- Always return valid JSON.
- For any linear, quadratic, cubic, exponential, trigonometric, or physics motion question → include graph.
- Use at least 80 points for smooth curve.
- Never add any text outside the JSON.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Solve the problem in the image and strictly follow the JSON format above." },
            { 
              type: "image_url", 
              image_url: { url: `data:image/jpeg;base64,${base64Image}` } 
            }
          ]
        }
      ],
      max_tokens: 2500,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    rawContent = response.choices[0]?.message?.content?.trim();
    console.log("🔍 Raw AI Response:", rawContent?.substring(0, 300) + "...");

    const parsed = JSON.parse(rawContent);

    return {
      text: parsed.text || "Solution generated.",
      graph: parsed.graph || null
    };

  } catch (err) {
    console.error("[aiService.js] Error:", err.message);
    console.log("Raw content that failed:", rawContent);

    return {
      text: rawContent || "Could not process this question.",
      graph: null
    };
  }
}