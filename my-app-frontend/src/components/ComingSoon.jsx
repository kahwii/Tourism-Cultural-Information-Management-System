export default function ComingSoon({ title = "This Page" }) {
  return (
    <div style={{
      background: "#fff", borderRadius: "16px", border: "1px solid #eef2f8",
      boxShadow: "0 4px 12px rgba(0,0,0,0.04)", padding: "60px 30px", textAlign: "center"
    }}>
      <div style={{ fontSize: "48px", marginBottom: "12px" }}></div>
      <h1 style={{ margin: "0 0 8px", fontSize: "24px", color: "#111827" }}>{title}</h1>
      <p style={{ margin: 0, color: "#6b7280" }}>This section is coming soon.</p>
    </div>
  );
}
