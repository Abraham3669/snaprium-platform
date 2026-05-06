// JESUS CHRIST IS LORD AND SAVIOR

import OpenAI from "openai";

export async function solveImage(base64Image, apiKey) {
  if (!base64Image) throw new Error("No image provided");
  if (!apiKey) throw new Error("No API key provided");

  const client = new OpenAI({ apiKey });
  let rawContent = null;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",                    // ← Best for JSON + Vision
      messages: [
        {
          role: "system",
          content: `You are Snaprium AI. Always respond with valid JSON only.

{
  "text": "step by step solution with LaTeX",
  "graph": null
}

If the problem contains any graphable equation (y=..., f(x)=..., quadratic, linear, sin, cos, etc.), include a proper graph.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Solve the problem in the image. Return ONLY JSON." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` }}
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    rawContent = response.choices[0]?.message?.content?.trim();
    const parsed = JSON.parse(rawContent);

    return {
      text: parsed.text || rawContent,
      graph: parsed.graph || null
    };

  } catch (err) {
    console.error("AI Error:", err.message);
    console.log("Raw output:", rawContent?.substring(0, 500));

    // Fallback: Return the text anyway
    return {
      text: rawContent || "Could not solve the question.",
      graph: null
    };
  }
}