// JESUS CHRIST IS LORD AND SAVIOR

import OpenAI from "openai";

export async function solveImage(base64Image, apiKey) {
  if (!base64Image) throw new Error("No image provided");
  if (!apiKey) throw new Error("No API key provided");

  const client = new OpenAI({ apiKey });
  let rawContent = null;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",           // ← Strongly recommended
      messages: [
        {
          role: "system",
          content: `You are Snaprium AI, a helpful math and physics tutor.

You solve problems step by step and use proper LaTeX.

After solving, if the question is about graphing or contains an equation like y = ..., f(x) = ..., quadratic, etc., create a graph.

But you can answer normally. Do not force JSON if it's not working well.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Solve this math problem step by step. Use LaTeX. If it's graphable, describe the graph at the end."
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            }
          ]
        }
      ],
      max_tokens: 1800,
      temperature: 0.3,
    });

    rawContent = response.choices[0]?.message?.content?.trim();
    console.log("Raw AI Response:", rawContent?.substring(0, 400));

    return {
      text: rawContent,
      graph: null   // We will use auto generator in frontend
    };

  } catch (err) {
    console.error("AI Service Error:", err);
    return {
      text: "Sorry, I couldn't process the image. Please try again.",
      graph: null
    };
  }
}