import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Crash caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
          }}
        >
          <div>
            <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ marginBottom: 16, opacity: 0.75 }}>
              Please reload the app and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: "#111",
                color: "white",
                fontWeight: 600,
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}