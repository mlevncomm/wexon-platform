import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#03150f",
          borderRadius: 36,
        }}
      >
        <svg width="128" height="77" viewBox="0 0 1198 718.8" fill="none">
          <path d="M237.09,0H0v245.46l473.34,473.34h241.28v-241.28L237.09,0Z" fill="#10b981" />
          <path d="M719.64,0h-237.09v245.46l473.33,473.34h241.27v-241.28L719.64,0Z" fill="#10b981" />
          <rect x="913.16" width="284.84" height="284.84" fill="#10b981" />
        </svg>
      </div>
    ),
    size,
  );
}
