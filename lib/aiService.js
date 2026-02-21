// lib/aiService.js
import fetch from 'node-fetch';

export async function solveWithGPTVision(imageBase64) {
  const apiKey = process.env.VITE_OPENAI_API_KEY;

  const body = {
    model: "gpt-4.1-mini", // or "gpt-4.1" if available
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "Solve the math problem in this image." },
          { type: "input_image", image_data: imageBase64 }
        ]
      }
    ]
  };

  const response = await fetch(process.env.VITE_OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const data = await response.json();
  return data.output_text || data.output?.[0]?.content?.[0]?.text || "No solution found.";
}