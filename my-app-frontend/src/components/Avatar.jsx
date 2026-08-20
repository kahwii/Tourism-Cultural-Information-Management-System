import { useState } from "react";
import { fileUrl } from "../api/api";

/*
  Profile picture with a graceful fallback.
  If the user has no picture (or it fails to load), we draw their initial
  on a colour derived from their name — so no two accounts look alike.
*/
const PALETTE = [
  ["#1D4ED8", "#123471"], // Mandaluyong blue
  ["#C8860D", "#8A5B06"], // heritage gold
  ["#15803D", "#0E5A2B"], // green
  ["#B91C1C", "#7F1414"], // red
  ["#7C3AED", "#55229F"], // violet
  ["#0E7490", "#0A4F62"], // teal
];

function hueFor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return PALETTE[h % PALETTE.length];
}

export default function Avatar({ user, size = 38, style, ring = false }) {
  const [broken, setBroken] = useState(false);
  const name = user?.username || "User";
  const src = user?.avatar && !broken ? fileUrl(user.avatar) : null;
  const [c1, c2] = hueFor(name);

  const base = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden", objectFit: "cover",
    ...(ring ? { boxShadow: "0 0 0 2px #fff, 0 0 0 4px rgba(29,78,216,.35)" } : {}),
    ...style,
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        title={name}
        style={base}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      title={name}
      style={{
        ...base,
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        color: "#fff",
        fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.42)),
        letterSpacing: 0.3,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
