"use client";

import { useState } from "react";

const COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
];

function colorFor(id: string) {
  const sum = id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return COLORS[sum % COLORS.length];
}

interface AvatarProps {
  id: string;
  name: string;
  avatarUrl?: string | null;
  size?: number;
  ringColor?: string;
}

export default function Avatar({ id, name, avatarUrl, size = 32, ringColor = "white" }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = name.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  const bg = colorFor(id);

  const sharedStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    border: `2px solid ${ringColor}`,
    boxShadow: "0 1px 4px rgba(0,0,0,0.14)",
  };

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgError(true)}
        style={{ ...sharedStyle, objectFit: "cover" }}
      />
    );
  }

  return (
    <div style={{
      ...sharedStyle,
      background: `linear-gradient(135deg, ${bg}, ${bg}bb)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.38), fontWeight: 700, color: "#fff",
      userSelect: "none",
    }}>
      {initials}
    </div>
  );
}
