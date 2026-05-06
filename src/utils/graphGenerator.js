// src/utils/graphGenerator.js
export function autoGenerateGraph(text) {
  // Simple regex to detect common equations like y = 2x + 3, y = x^2, etc.
  const linearMatch = text.match(/y\s*=\s*([-\d]+)?x?\s*([+-]?\s*\d+)?/i);
  const quadraticMatch = text.match(/y\s*=\s*.*x\^?2/i);

  if (quadraticMatch) {
    // Generate y = x² style graph
    const x = Array.from({ length: 81 }, (_, i) => -4 + i * 0.1);
    const y = x.map(val => val * val);
    return {
      data: [{
        x,
        y,
        type: 'scatter',
        mode: 'lines',
        name: 'Quadratic',
        line: { color: '#3b82f6', width: 4 }
      }],
      layout: {
        title: 'Graph of Quadratic Function',
        xaxis: { title: 'x' },
        yaxis: { title: 'y' }
      }
    };
  }

  if (linearMatch) {
    const x = Array.from({ length: 41 }, (_, i) => -10 + i * 0.5);
    const y = x.map(val => 2 * val + 3);   // default to y=2x+3 for now
    return {
      data: [{
        x,
        y,
        type: 'scatter',
        mode: 'lines',
        name: 'y = 2x + 3',
        line: { color: '#3b82f6', width: 4 }
      }],
      layout: {
        title: 'Graph of y = 2x + 3',
        xaxis: { title: 'x' },
        yaxis: { title: 'y' }
      }
    };
  }

  return null;
}