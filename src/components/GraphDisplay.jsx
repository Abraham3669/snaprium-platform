// src/components/GraphDisplay.jsx
import React from 'react';
import Plot from 'react-plotly.js';

const GraphDisplay = ({ graphData, title = "Solution Graph" }) => {
  if (!graphData?.data) return null;

  return (
    <div className="my-10 bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
        <h3 className="text-2xl font-bold text-white">{title}</h3>
        <p className="text-blue-100 text-sm mt-1">Interactive • Zoom • Export</p>
      </div>

      <div className="p-6">
        <Plot
          data={graphData.data}
          layout={{
            autosize: true,
            height: 520,
            margin: { t: 30, r: 30, b: 70, l: 80 },
            plot_bgcolor: "#fafafa",
            paper_bgcolor: "#ffffff",
            font: { family: "Inter, system-ui, sans-serif" },
            title: { text: graphData.layout?.title || "", font: { size: 20 } },
            xaxis: {
              title: graphData.layout?.xaxis?.title || "x",
              gridcolor: "#e2e8f0",
              zerolinecolor: "#64748b",
              zerolinewidth: 2.5,
              ...graphData.layout?.xaxis
            },
            yaxis: {
              title: graphData.layout?.yaxis?.title || "y",
              gridcolor: "#e2e8f0",
              zerolinecolor: "#64748b",
              zerolinewidth: 2.5,
              ...graphData.layout?.yaxis
            },
            showlegend: true,
            legend: { orientation: "h", y: 1.1 },
          }}
          config={{
            responsive: true,
            displayModeBar: true,
            toImageButtonOptions: { format: 'png', filename: 'snaprium-graph', scale: 3 }
          }}
          style={{ width: "100%" }}
          useResizeHandler
        />
      </div>
    </div>
  );
};

export default GraphDisplay;