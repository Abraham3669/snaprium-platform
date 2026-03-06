// JESUS CHRIST IS LORD AND SAVIOR

import OpenAI from "openai";

/**
 * Solve a math problem from a base64 image using a vision-capable model.
 * @param {string} base64Image - Base64 encoded image (without data: prefix)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} - AI answer text (LaTeX-ready)
 */
export async function solveImage(base64Image, apiKey) {
  if (!base64Image) throw new Error("No image provided");
  if (!apiKey) throw new Error("No API key provided");

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1", // high-quality math reasoning
      messages: [
        {
          role: "system",
          content:  `
const extractFinalAnswer = (text) => {
  if (!text?.trim()) return '$$\\text{No solution found}$$';

  let cleaned = text
    .trim()
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+/g, '\n');

  let candidate = null;

  // 1. Last \boxed{...} — highest priority
  const boxedMatches = [...cleaned.matchAll(/\\boxed\{([\s\S]*?)\}/g)];
  if (boxedMatches.length > 0) {
    candidate = boxedMatches[boxedMatches.length - 1][1].trim();
  }

  // 2. Last display math block
  if (!candidate) {
    const displayMatches = [...cleaned.matchAll(/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g)];
    if (displayMatches.length > 0) {
      const last = displayMatches[displayMatches.length - 1];
      candidate = (last[1] || last[2] || '').trim();
    }
  }

  // 3. Keyword phrase
  if (!candidate) {
    const keywordRegex = /(?:final answer|answer|result|solution|therefore|thus|conclusion|so|we get)[:=\s→-]?\s*([\s\S]*?)(?=\n{2,}|$)/is;
    const match = cleaned.match(keywordRegex);
    if (match?.[1]) candidate = match[1].trim();
  }

  // 4. Last plausible math line — very permissive now
  if (!candidate) {
    const lines = cleaned.split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.length < 5) continue;
      if (
        line.includes('\\boxed') ||
        line.includes('\\frac') ||
        line.includes('=') ||                  // ← important for equations
        line.match(/(f'|f''|[a-z]\(x\))/) ||   // functions/derivatives
        line.match(/\\(sqrt|sum|int|prod|lim|e\^{|sin|cos|ln|log|x\^)/)
      ) {
        candidate = line;
        break;
      }
    }
  }

  if (!candidate) {
    return '$$\\text{See the detailed steps below}$$';
  }

  // Cleanup outer junk
  candidate = candidate
    .replace(/^[\s$\\[\]]+|[\s$\\[\]]+$/g, '')
    .replace(/^\\boxed\{([\s\S]*)\}$/, '$1')
    .replace(/\\boxed\{([\s\S]*?)\}/g, '$1')
    .trim();

  // Apply same fixes as steps section
  candidate = prepareMathForKaTeX(candidate);

  // ── Very relaxed broken check ── only block extreme junk
  const fracCount = (candidate.match(/\\frac|\\dfrac/g) || []).length;
  const openBraces  = (candidate.match(/\{/g)  || []).length;
  const closeBraces = (candidate.match(/\}/g) || []).length;

  const isVeryBroken =
    candidate.length < 4 ||
    candidate.trim() === '' ||
    candidate.startsWith('frac{') ||
    candidate === 'frac' ||
    (fracCount > 0 && openBraces === 0 && closeBraces === 0);  // no braces at all

  if (isVeryBroken) {
    return '$$\\text{See steps below}$$';
  }

  // ── Wrapping logic – safe concatenation ────────────────────────────────
  const eqMatch = candidate.match(/^(.+?)\s*=\s*(.+)$/);
  if (eqMatch) {
    const left  = eqMatch[1].trim();
    const right = eqMatch[2].trim();
    return left + ' = $' + right + '$';
  }

  // Short/symbolic → inline math
  if (!candidate.includes('=') && candidate.length < 80 && !candidate.includes('\\\\')) {
    return '$' + candidate.trim() + '$';
  }

  // Default: display math
  return '$$' + candidate + '$$';
};
`

        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Solve this math problem from the image. Use proper LaTeX: vertical fractions \\frac{}{}, superscripts, subscripts, square roots, etc. Wrap all main calculations in display math mode \\[ ... \\]. Explain each step clearly."
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
      max_tokens: 1500, // increase if you want longer step-by-step solutions
      temperature: 0.2   // lower for precise math reasoning
    });

    const answer = response.choices[0]?.message?.content?.trim() ?? "No answer returned";
    return answer;
  } catch (err) {
    console.error("[aiService.js] OpenAI API error:", err.message || err);
    throw new Error(`Failed to solve image: ${err.message || 'Unknown error'}`);
  }
}