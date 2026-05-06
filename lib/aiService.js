// JESUS CHRIST IS LORD AND SAVIOR

import OpenAI from "openai";

export async function solveImage(base64Image, apiKey) {
  if (!base64Image) throw new Error("No image provided");
  if (!apiKey) throw new Error("No API key provided");

  const client = new OpenAI({ apiKey });
  let rawContent = null;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1",   // or try "gpt-4o" if this keeps failing
      messages: [
        {
          role: "system",
          content: `You are Snaprium AI - a strict math tutor.

**YOU MUST RESPOND WITH ONLY VALID JSON. NOTHING ELSE.**

Use this exact structure:

{
  "text": "Full step-by-step solution with proper LaTeX. Use $$ for display math. End with \\boxed{answer}.",
  "graph": null
}

If the question involves graphing any function (linear, quadratic, exponential, trig, etc.) or physics motion, then return a graph like this:

{
  "text": "... step by step ...",
  "graph": {
    "data": [
      {
        "x": [-10, -9, -8, ..., 9, 10],
        "y": [values here],
        "type": "scatter",
        "mode": "lines",
        "name": "y = 2x + 3",
        "line": { "color": "#3b82f6", "width": 4 }
      }
    ],
    "layout": {
      "title": "Graph of y = 2x + 3",
      "xaxis": { "title": "x" },
      "yaxis": { "title": "y" }
    }
  }
}

For y = 2x + 3 example, generate proper x and y values.
Never output anything except the JSON.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Solve the problem shown in the image. Respond **only** with the JSON format above. Do not add any extra text."
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.0,           // Very low for consistency
      response_format: { type: "json_object" }
    });

    rawContent = response.choices[0]?.message?.content?.trim();
    
    console.log("🔍 RAW AI RESPONSE START:");
    console.log(rawContent);
    console.log("🔍 RAW AI RESPONSE END");

    const parsed = JSON.parse(rawContent);

    return {
      text: parsed.text || "Solution completed.",
      graph: parsed.graph || null
    };

  } catch (err) {
    console.error("❌ AI Service Error:", err.message);
    if (rawContent) console.log("Raw content was:", rawContent);

    return {
      text: rawContent || "Sorry, I couldn't solve this properly.",
      graph: null
    };
  }
}