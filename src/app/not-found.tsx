import Link from "next/link";

export default function NotFound() {
  return (
    <div className="app-container">
      <div className="empty-state" style={{ paddingTop: "120px" }}>
        <div className="empty-state-icon">🔎</div>
        <h3>Article Not Found</h3>
        <p>
          This article may have been removed or the link is incorrect.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            marginTop: "24px",
            padding: "10px 24px",
            background: "var(--gradient-primary)",
            color: "white",
            borderRadius: "var(--radius-full)",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          ← Back to Feed
        </Link>
      </div>
    </div>
  );
}
