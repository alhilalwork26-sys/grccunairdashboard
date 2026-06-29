export default function DashboardLoading() {
  return (
    <div style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, background: "#f9fafb" }}>
      {/* Topbar skeleton */}
      <div style={{ height: 52, background: "#fff", borderRadius: 14, border: "1px solid #f3f4f6" }} />
      {/* Content skeletons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ height: 88, background: "#fff", borderRadius: 14, border: "1px solid #f3f4f6", overflow: "hidden", position: "relative" }}>
            <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {[0,1].map(i => (
          <div key={i} style={{ height: 220, background: "#fff", borderRadius: 14, border: "1px solid #f3f4f6", overflow: "hidden", position: "relative" }}>
            <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
          </div>
        ))}
      </div>
      <style>{`
        .skeleton-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.04) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </div>
  );
}
