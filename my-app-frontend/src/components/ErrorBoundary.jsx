import { Component } from "react";

/*
  Catches any rendering error in the app and shows a recoverable screen
  instead of a blank white page. Without this, a single component crash
  takes down the whole interface with no explanation.
*/
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, showDetail: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Keep a trace in the console for debugging; never expose it to the user.
    console.error("TCIMS caught an error:", error, info?.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null, showDetail: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={page}>
        <div style={card} className="fade-up">
          <div style={iconWrap}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          </div>

          <h1 style={title}>Something went wrong</h1>
          <p style={sub}>
            The page ran into an unexpected problem. Your data is safe — nothing was lost.
            You can go back to the page you were on, or return to the dashboard.
          </p>

          <div style={btnRow}>
            <button style={primaryBtn} className="tc-btn tc-btn-primary" onClick={this.reset}>
              Try again
            </button>
            <button
              style={ghostBtn}
              className="tc-btn"
              onClick={() => { this.reset(); window.location.href = "/"; }}
            >
              Go to sign in
            </button>
          </div>

          <button
            style={detailToggle}
            onClick={() => this.setState((s) => ({ showDetail: !s.showDetail }))}
          >
            {this.state.showDetail ? "Hide technical details" : "Show technical details"}
          </button>

          {this.state.showDetail && (
            <pre style={detailBox}>{String(this.state.error?.message || this.state.error)}</pre>
          )}
        </div>

        <div style={footNote}>
          Tourism &amp; Cultural Information Management System — City of Mandaluyong
        </div>
      </div>
    );
  }
}

/* ================= STYLES ================= */
const page = {
  minHeight: "100vh", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", padding: 24,
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
  background: "radial-gradient(1000px 500px at 50% 0%, #E8F0FF 0%, transparent 60%), #F5F8FC",
};
const card = {
  background: "#fff", borderRadius: 20, padding: "36px 34px", maxWidth: 520, width: "100%",
  textAlign: "center", border: "1px solid #E6ECF5", boxShadow: "0 24px 56px rgba(10,37,89,.14)",
};
const iconWrap = {
  width: 66, height: 66, borderRadius: "50%", margin: "0 auto 18px",
  background: "#FFF8E7", color: "#C8860D",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const title = { margin: "0 0 8px", fontSize: 23, fontWeight: 800, color: "#0F172A" };
const sub = { margin: 0, fontSize: 14.5, color: "#64748B", lineHeight: 1.65 };
const btnRow = { display: "flex", gap: 10, justifyContent: "center", marginTop: 24, flexWrap: "wrap" };
const primaryBtn = {
  background: "linear-gradient(135deg,#1D4ED8,#123471)", color: "#fff", border: "none",
  borderRadius: 11, padding: "12px 22px", fontSize: 14.5, fontWeight: 700, cursor: "pointer",
  boxShadow: "0 8px 20px rgba(29,78,216,.28)",
};
const ghostBtn = {
  background: "#F1F5F9", color: "#334155", border: "none",
  borderRadius: 11, padding: "12px 22px", fontSize: 14.5, fontWeight: 600, cursor: "pointer",
};
const detailToggle = {
  marginTop: 18, background: "none", border: "none", color: "#94A3B8",
  fontSize: 12.5, cursor: "pointer", textDecoration: "underline",
};
const detailBox = {
  marginTop: 12, textAlign: "left", background: "#F8FAFC", border: "1px solid #E6ECF5",
  borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#B91C1C",
  whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 160, overflowY: "auto",
};
const footNote = { marginTop: 22, fontSize: 12, color: "#94A3B8", textAlign: "center" };
