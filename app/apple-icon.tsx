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
        <svg width="112" height="67" viewBox="0 0 1198 718" fill="none">
          <path
            d="M237.088 0H0V245.465L473.337 718.801H714.612V477.525L237.088 0Z"
            fill="#5DFF65"
          />
          <path
            d="M719.637 0H482.551V245.465L955.887 718.801H1197.16V477.525L719.637 0Z"
            fill="#5DFF65"
          />
          <rect x="913.16" width="284.839" height="284.839" fill="#5DFF65" />
        </svg>
      </div>
    ),
    size,
  );
}
