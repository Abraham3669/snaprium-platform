import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Crash caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 20, background: '#fff', minHeight: '100vh',
          fontFamily: 'monospace', fontSize: 13, color: '#d32f2f',
        }}>
          <h2 style={{ color: '#d32f2f' }}>App Crashed</h2>
          <p><strong>{this.state.error?.name}:</strong> {this.state.error?.message}</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, marginTop: 10 }}>
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}