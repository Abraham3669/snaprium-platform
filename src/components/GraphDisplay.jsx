import React from 'react';
import Plot from 'react-plotly.js';

const GraphDisplay = ({ graphData, title = "Graph" }) => {
  if (!graphData?.data) return null;

  return (
    <div className="graph-container my-8 p-5 border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-900 shadow-sm">
      <h3 className="text-xl font-semibold mb-4 text-center">
        {title}
      </h3>
      <Plot
        data={graphData.data}
        layout={{
          autosize: true,
          height: 420,
          margin: { t: 30, r: 30, b: 60, l: 60 },
          ...graphData.layout,
        }}
        config={{
          responsive: true,
          displayModeBar: true,
          modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toImage'],
        }}
        style={{ width: '100%' }}
        useResizeHandler
      />
    </div>
  );
};

export default GraphDisplay;