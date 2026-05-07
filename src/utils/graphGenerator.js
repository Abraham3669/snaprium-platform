// src/utils/graphGenerator.js

export function autoGenerateGraph(text) {
  if (!text) return null;

  const lower = text.toLowerCase();

  // === 1. Quadratic Functions ===
  if (lower.includes('x²') || lower.includes('x^2') || lower.includes('quadratic') || lower.includes('parabola')) {
    const x = Array.from({ length: 121 }, (_, i) => -6 + i * 0.1);
    const y = x.map(val => val * val);

    return {
      data: [{
        x,
        y,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'f(x)',
        line: { color: '#2563eb', width: 5 },
        marker: { size: 4, opacity: 0.4 }
      }],
      layout: {
        title: 'Graph of Quadratic Function',
        xaxis: { title: 'x' },
        yaxis: { title: 'y' }
      }
    };
  }

  // === 2. Linear Function y = mx + b (Improved detection) ===
  const linearMatch = text.match(/y\s*=\s*([-\d.]+)?\s*\*?\s*x\s*([+-]?\s*[\d.]+)?/i);
  if (linearMatch || lower.includes('y =') || lower.includes('slope') || lower.includes('straight line')) {
    const x = Array.from({ length: 81 }, (_, i) => -10 + i * 0.25);
    const y = x.map(val => 2 * val + 3); // Default fallback

    return {
      data: [{
        x,
        y,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Linear Function',
        line: { color: '#2563eb', width: 5.5 },
        marker: { size: 5, opacity: 0.5 }
      }],
      layout: {
        title: 'Graph of Linear Function',
        xaxis: { title: 'x', range: [-12, 12] },
        yaxis: { title: 'y', range: [-25, 35] }
      }
    };
  }

  // === 3. Solve for x → Vertical Line ===
  const xMatch = text.match(/x\s*=\s*([-\d.]+)/i);
  if (xMatch || lower.includes('x =')) {
    const xVal = parseFloat(xMatch?.[1]) || 5;
    return {
      data: [{
        x: [xVal, xVal],
        y: [-30, 30],
        type: 'scatter',
        mode: 'lines',
        name: `x = ${xVal}`,
        line: { color: '#ef4444', width: 6, dash: 'dashdot' }
      }],
      layout: {
        title: `Solution: x = ${xVal}`,
        xaxis: { title: 'x', range: [xVal - 15, xVal + 15] },
        yaxis: { title: 'y', range: [-30, 30] },
        annotations: [{
          x: xVal,
          y: 15,
          text: `x = ${xVal}`,
          showarrow: true,
          arrowhead: 2,
          font: { color: '#ef4444', size: 14 }
        }]
      }
    };
  }

  // === 4. Physics / General Graph Request ===
  if (lower.includes('graph') || lower.includes('plot') || lower.includes('motion') || lower.includes('velocity') || lower.includes('position')) {
    const x = Array.from({ length: 61 }, (_, i) => -10 + i * 0.33);
    const y = x.map(val => val * 2 + 1);

    return {
      data: [{
        x,
        y,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Function',
        line: { color: '#2563eb', width: 4.8 },
        marker: { size: 4 }
      }],
      layout: {
        title: 'Graph of the Solution',
        xaxis: { title: 'x' },
        yaxis: { title: 'y' }
      }
    };
  }

  return null;
}