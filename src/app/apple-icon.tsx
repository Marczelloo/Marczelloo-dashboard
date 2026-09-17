import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Crimson variant, full bleed: iOS applies its own corner mask. Ring perimeter 157.12.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#cf3339" }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <rect x="10" y="10" width="44" height="44" rx="11" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="5" />
          <rect x="10" y="10" width="44" height="44" rx="11" fill="none" stroke="#ffffff" strokeWidth="5" strokeDasharray="94.27 157.12" />
          <rect x="10" y="10" width="44" height="44" rx="11" fill="none" stroke="#1b0708" strokeWidth="5" strokeDasharray="20.43 157.12" strokeDashoffset="-98.99" />
          <path fill="#ffffff" d="M23.5 39.5V24.5h4.1L32 31l4.4-6.5h4.1v15h-4v-8.6L32 37.3l-4.5-6.4v8.6Z" />
        </svg>
      </div>
    ),
    size
  );
}
