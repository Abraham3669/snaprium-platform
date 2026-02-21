// lib/aiService.js
import OpenAI from "openai";

/**
 * Solve a math problem from a base64 image using GPT-4.1 Vision.
 * @param {string} base64Image - The image encoded in base64.
 * @param {string} apiKey - Your OpenAI API key.
 * @returns {Promise<string>} - The AI's answer.
 */
export async function solveImage(base64Image, apiKey) {
  if (!base64Image) throw new Error("No image provided");
  if (!apiKey) throw new Error("No API key provided");

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.responses.create({
      model: "gpt-4.1",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Solve this math problem from the image." },
            {
  type: "input_image",
  image_url: `data:image/jpeg;base64,${base64Image}`
}
          ]
        }
      ]
    });

    // Return the text output
    return response.output_text ?? "No answer returned";
  } catch (err) {
    console.error("OpenAI API error:", err);
    throw new Error("Failed to solve image");
  }
}