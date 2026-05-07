// src/utils/graphGenerator.js

export function autoGenerateGraph(text) {
  if (!text) return null;

  const lower = text.toLowerCase();

  // Case 1: Linear function y = mx + b
  if (lower.includes('y =') || lower.match(/y\s*=\s*.*x/)) {
    const x = Array.from({ length: 61 }, (_, i) => -15 + i * 0.5);
    const y = x.map(val => 2 * val + 3); // Default, can be smarter later

    return {
      data: [{ x, y, type: 'scatter', mode: 'lines', name: 'Line', line: { color: '#2563eb', width: 5 } }],
      layout: { title: 'Graph of the Line', xaxis: { title: 'x' }, yaxis: { title: 'y' } }
    };
  }

  // Case 2: Quadratic
  if (lower.includes('x²') || lower.includes('x^2') || lower.includes('quadratic')) {
    const x = Array.from({ length: 81 }, (_, i) => -5 + i * 0.125);
    const y = x.map(val => val * val);
    return {
      data: [{ x, y, type: 'scatter', mode: 'lines', name: 'Quadratic', line: { color: '#2563eb', width: 5 } }],
      layout: { title: 'Quadratic Function Graph', xaxis: { title: 'x' }, yaxis: { title: 'y' } }
    };
  }

  // Case 3: Linear Equation (solve for x) → Vertical Line
  const xSolution = text.match(/x\s*=\s*([-\d.]+)/i);
  if (xSolution || lower.includes('vertical line') || lower.includes('x =')) {
    const xValue = xSolution ? parseFloat(xSolution[1]) : 5;
    const x = [xValue, xValue];
    const y = [-20, 20];

    return {
      data: [{
        x,
        y,
        type: 'scatter',
        mode: 'lines',
        name: `x = ${xValue}`,
        line: { color: '#ef4444', width: 6, dash: 'dashdot' }
      }],
      layout: {
        title: `Solution: x = ${xValue}`,
        xaxis: { title: 'x', range: [xValue - 10, xValue + 10] },
        yaxis: { title: 'y', range: [-20, 20] },
        annotations: [{
          x: xValue,
          y: 10,
          text: `x = ${xValue}`,
          showarrow: true,
          arrowhead: 2,
          font: { color: '#ef4444' }
        }]
      }
    };
  }

  // Case 4: General "graph" keyword
  if (lower.includes('graph') || lower.includes('plot') || lower.includes('draw')) {
    const x = Array.from({ length: 41 }, (_, i) => -10 + i * 0.5);
    const y = x.map(val => val * 2 + 3);

    return {
      data: [{ x, y, type: 'scatter', mode: 'lines', line: { color: '#2563eb', width: 4 } }],
      layout: { title: 'Solution Graph', xaxis: { title: 'x' }, yaxis: { title: 'y' } }
    };
  }

  return null;
}