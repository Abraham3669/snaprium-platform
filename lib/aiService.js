// JESUS CHRIST IS LORD AND SAVIOR

import OpenAI from "openai";

export async function solveImage(base64Image, apiKey) {
  if (!base64Image) throw new Error("No image provided");
  if (!apiKey) throw new Error("No API key provided");

  const client = new OpenAI({ apiKey });

  let rawContent = null;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are Snaprium AI, an expert math and physics tutor.

You MUST ALWAYS reply with valid JSON only, in this exact format:

{
  "text": "Your full step-by-step solution with LaTeX here. Use $$ for display math and \\boxed{} for final answer.",
  "graph": {
    "data": [
      {
        "x": [-10, -9, ..., 10],
        "y": [values...],
        "type": "scatter",
        "mode": "lines",
        "name": "y = 2x + 3",
        "line": { "color": "#3b82f6", "width": 3.5 }
      }
    ],
    "layout": {
      "title": "Graph of y = 2x + 3",
      "xaxis": { "title": "x" },
      "yaxis": { "title": "y" }
    }
  }
}

- If the question is about graphing a function or has a clear graphable equation, include the "graph" field.
- Otherwise, set "graph": null
- Do not add any extra text, explanation, or markdown outside the JSON.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Solve the problem in the image and respond with the JSON format above."
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            }
          ]
        }
      ],
      max_tokens: 2500,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    rawContent = response.choices[0]?.message?.content?.trim();

    if (!rawContent) throw new Error("Empty response");

    const parsed = JSON.parse(rawContent);

    return {
      text: parsed.text || rawContent,
      graph: parsed.graph || null
    };

  } catch (err) {
    console.error("[aiService.js] Error:", err.message);

    return {
      text: rawContent || "I couldn't process this question properly. Please try a clearer image.",
      graph: null
    };
  }
}