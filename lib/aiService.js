// lib/aiService.js
import OpenAI from "openai";

export async function solveImage(base64Image, apiKey) {
  const client = new OpenAI({ apiKey });

  const response = await client.responses.create({
    model: "gpt-4.1-vision",  // <-- switch to full vision model
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "Solve this math problem from the image" },
          { type: "input_image", image_url: `data:image/png;base64,${base64Image}` }
        ]
      }
    ]
  });

  return response.output_text;
}