// src/utils/graphGenerator.js

export function autoGenerateGraph(text) {
  if (!text) return null;

  const lower = text.toLowerCase();

  // === 1. Quadratic Functions ===
  if (lower.includes('x²') || lower.includes('x^2') || lower.includes('quadratic')) {
    const x = Array.from({ length: 101 }, (_, i) => -5 + i * 0.1);
    const y = x.map(val => val * val);
    return {
      data: [{ x, y, type: 'scatter', mode: 'lines', name: 'f(x)', line: { color: '#2563eb', width: 5 } }],
      layout: { title: 'Graph of Quadratic Function', xaxis: { title: 'x' }, yaxis: { title: 'y' } }
    };
  }

  // === 2. Linear Equation y = mx + b ===
  const linearMatch = text.match(/y\s*=\s*([-\d.]+)?\s*\*?\s*x\s*([+-]?\s*[\d.]+)?/i);
  if (linearMatch || lower.includes('y =') || lower.includes('slope')) {
    const x = Array.from({ length: 81 }, (_, i) => -10 + i * 0.25);
    const y = x.map(val => 2 * val + 3); // Default - can be improved

    return {
      data: [{
        x, y,
        type: 'scatter',
        mode: 'lines',
        name: 'y = 2x + 3',
        line: { color: '#2563eb', width: 5.5 }
      }],
      layout: {
        title: 'Graph of Linear Function',
        xaxis: { title: 'x', range: [-12, 12] },
        yaxis: { title: 'y', range: [-20, 30] }
      }
    };
  }

  // === 3. Solve for x (Vertical Line) ===
  const xMatch = text.match(/x\s*=\s*([-\d.]+)/i);
  if (xMatch || lower.includes('x =')) {
    const xVal = parseFloat(xMatch[1]) || 5;
    return {
      data: [{
        x: [xVal, xVal],
        y: [-30, 30],
        type: 'scatter',
        mode: 'lines',
        name: `x = ${xVal}`,
        line: { color: '#ef4444', width: 6, dash: 'dash' }
      }],
      layout: {
        title: `Solution: x = ${xVal}`,
        xaxis: { title: 'x', range: [xVal - 15, xVal + 15] },
        yaxis: { title: 'y', range: [-30, 30] }
      }
    };
  }

  // === 4. General Graph Request ===
  if (lower.includes('graph') || lower.includes('plot') || lower.includes('draw the line')) {
    const x = Array.from({ length: 61 }, (_, i) => -10 + i * 0.33);
    const y = x.map(val => val * 2 + 1);

    return {
      data: [{ x, y, type: 'scatter', mode: 'lines', line: { color: '#2563eb', width: 4.5 } }],
      layout: { title: 'Solution Graph', xaxis: { title: 'x' }, yaxis: { title: 'y' } }
    };
  }

  return null;
}