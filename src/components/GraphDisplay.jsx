// src/components/GraphDisplay.jsx
import React from 'react';
import Plot from 'react-plotly.js';

const GraphDisplay = ({ graphData, title = "Solution Graph" }) => {
  if (!graphData?.data) return null;

  // Add markers (points) for better visual clarity
  const enhancedData = graphData.data.map(trace => ({
    ...trace,
    mode: trace.mode || 'lines+markers',
    marker: trace.marker || { 
      color: trace.line?.color || '#2563eb', 
      size: 5, 
      opacity: 0.6 
    }
  }));

  return (
    <div className="my-10 bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
        <h3 className="text-2xl font-bold text-white">{title}</h3>
        <p className="text-blue-100 text-sm mt-1 flex items-center gap-2">
          Interactive Graph • Zoom, Pan & Export Available
        </p>
      </div>

      {/* Plot Area */}
      <div className="p-6 md:p-8">
        <Plot
          data={enhancedData}
          layout={{
            autosize: true,
            height: 560,
            margin: { t: 20, r: 40, b: 70, l: 80 },
            plot_bgcolor: "#fafafa",
            paper_bgcolor: "#ffffff",
            font: { 
              family: "Inter, system-ui, sans-serif", 
              size: 14 
            },
            title: { 
              text: graphData.layout?.title || "", 
              font: { size: 20, color: "#1f2937" } 
            },
            xaxis: {
              title: graphData.layout?.xaxis?.title || "x",
              gridcolor: "#e2e8f0",
              zerolinecolor: "#64748b",
              zerolinewidth: 2.5,
              tickfont: { size: 13 },
              ...graphData.layout?.xaxis
            },
            yaxis: {
              title: graphData.layout?.yaxis?.title || "y",
              gridcolor: "#e2e8f0",
              zerolinecolor: "#64748b",
              zerolinewidth: 2.5,
              tickfont: { size: 13 },
              ...graphData.layout?.yaxis
            },
            showlegend: true,
            legend: { 
              orientation: "h", 
              y: 1.12,
              x: 0.5,
              xanchor: "center",
              font: { size: 13 }
            },
            hoverlabel: {
              bgcolor: "#1f2937",
              font: { color: "#fff", size: 13 }
            }
          }}
          config={{
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            toImageButtonOptions: { 
              format: 'png', 
              filename: 'snaprium-graph', 
              scale: 3 
            }
          }}
          style={{ width: "100%" }}
          useResizeHandler
        />
      </div>

      {/* Footer Info */}
      <div className="px-8 py-4 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 flex justify-between items-center">
        <span>Tap and drag to zoom • Scroll to pan</span>
        <span className="text-blue-600 hover:underline cursor-pointer" 
              onClick={() => window.print()}>
          Export as Image
        </span>
      </div>
    </div>
  );
};

export default GraphDisplay;