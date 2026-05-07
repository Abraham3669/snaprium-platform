// src/components/GraphDisplay.jsx
import React from 'react';
import Plot from 'react-plotly.js';

const GraphDisplay = ({ graphData, title = "Solution Graph" }) => {
  if (!graphData?.data) return null;

  return (
    <div className="my-8 bg-white dark:bg-gray-900 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
          {title}
        </h3>
      </div>

      <div className="p-4">
        <Plot
          data={graphData.data}
          layout={{
            autosize: true,
            height: 460,
            margin: { t: 40, r: 40, b: 70, l: 70 },
            plot_bgcolor: "#ffffff",
            paper_bgcolor: "#ffffff",
            font: { family: "Inter, sans-serif", size: 13 },
            title: {
              text: graphData.layout?.title || "",
              font: { size: 18 }
            },
            xaxis: {
              title: graphData.layout?.xaxis?.title || "x",
              gridcolor: "#e5e7eb",
              zerolinecolor: "#6b7280",
              zerolinewidth: 2,
              showline: true,
              linewidth: 1,
              linecolor: "#9ca3af",
              ...graphData.layout?.xaxis
            },
            yaxis: {
              title: graphData.layout?.yaxis?.title || "y",
              gridcolor: "#e5e7eb",
              zerolinecolor: "#6b7280",
              zerolinewidth: 2,
              showline: true,
              linewidth: 1,
              linecolor: "#9ca3af",
              ...graphData.layout?.yaxis
            },
            showlegend: true,
            legend: {
              orientation: "h",
              yanchor: "bottom",
              y: 1.02,
              xanchor: "center",
              x: 0.5
            }
          }}
          config={{
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            toImageButtonOptions: {
              format: 'png',
              filename: 'snaprium-graph',
              height: 600,
              width: 800,
              scale: 2
            }
          }}
          style={{ width: "100%" }}
          useResizeHandler
        />
      </div>

      <div className="px-6 py-3 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-700">
        Interactive Graph • Zoom & Pan available
      </div>
    </div>
  );
};

export default GraphDisplay;