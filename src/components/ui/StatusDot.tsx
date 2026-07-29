import type { PresenceStatus } from "@/types";
import { PRESENCE_CFG } from "@/types";

interface Props {
  status: PresenceStatus | null | undefined;
  size?: number;
  borderColor?: string;
}

export default function StatusDot({ status, size = 9, borderColor = "#fff" }: Props) {
  const cfg = PRESENCE_CFG.find(c => c.key === status);
  const color = cfg?.color ?? "#9ca3af";
  const dot = cfg?.dot ?? "outline";

  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    border: `1.5px solid ${borderColor}`,
    boxSizing: "border-box",
  };

  if (dot === "outline" || !status || status === "offline") {
    return (
      <div style={{
        ...base,
        background: "transparent",
        border: `${Math.max(1.5, size * 0.18)}px solid ${color}`,
      }} />
    );
  }

  if (dot === "dnd") {
    return (
      <div style={{
        ...base,
        background: color,
        border: `1.5px solid ${borderColor}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          width: "55%",
          height: Math.max(1.5, size * 0.18),
          background: "#fff",
          borderRadius: 1,
        }} />
      </div>
    );
  }

  // filled
  return (
    <div style={{
      ...base,
      background: color,
    }} />
  );
}
