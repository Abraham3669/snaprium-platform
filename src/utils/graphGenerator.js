// src/utils/graphGenerator.js

export function autoGenerateGraph(text) {
  if (!text) return null;

  const lowerText = text.toLowerCase();

  // Linear Equation Detection (y = mx + b)
  const linearMatch = text.match(/y\s*=\s*([-\d.]+)?\s*\*?\s*x\s*([+-]?\s*[\d.]+)?/i);

  if (linearMatch || lowerText.includes("slope") || lowerText.includes("y =") || lowerText.includes("straight line")) {
    const x = Array.from({ length: 61 }, (_, i) => -15 + i * 0.5);
    const y = x.map(val => 2 * val + 3); // Default to y=2x+3, can be improved later

    return {
      data: [{
        x,
        y,
        type: 'scatter',
        mode: 'lines',
        name: 'y = 2x + 3',
        line: { color: '#2563eb', width: 5, shape: 'linear' }
      }],
      layout: {
        title: 'Graph of y = 2x + 3',
        xaxis: { title: 'x', range: [-15, 15] },
        yaxis: { title: 'y', range: [-25, 35] },
        hovermode: 'closest'
      }
    };
  }

  // Quadratic (y = x² style)
  if (lowerText.includes("x²") || lowerText.includes("x^2") || lowerText.includes("quadratic")) {
    const x = Array.from({ length: 81 }, (_, i) => -4 + i * 0.1);
    const y = x.map(val => val * val);

    return {
      data: [{
        x,
        y,
        type: 'scatter',
        mode: 'lines',
        name: 'y = x²',
        line: { color: '#2563eb', width: 5 }
      }],
      layout: {
        title: 'Graph of Quadratic Function',
        xaxis: { title: 'x' },
        yaxis: { title: 'y' }
      }
    };
  }

  return null;
}