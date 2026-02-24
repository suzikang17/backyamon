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
          background: "linear-gradient(180deg, #2a1f0e 0%, #1A1A0E 100%)",
          borderRadius: "36px",
        }}
      >
        {/* Rasta stripes at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "8px",
            display: "flex",
          }}
        >
          <div style={{ flex: 1, background: "#006B3F" }} />
          <div style={{ flex: 1, background: "#FFD700" }} />
          <div style={{ flex: 1, background: "#CE1126" }} />
        </div>
        {/* Triangle + pieces */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "-10px",
          }}
        >
          {/* Gold triangle */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "40px solid transparent",
              borderRight: "40px solid transparent",
              borderBottom: "80px solid #FFD700",
              marginBottom: "-20px",
            }}
          />
          {/* Gold piece */}
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: "#FFD700",
              border: "3px solid #D4A857",
              marginBottom: "-12px",
              zIndex: 2,
            }}
          />
          {/* Dark piece */}
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: "#1A1A0E",
              border: "3px solid #8B4513",
              zIndex: 1,
            }}
          />
        </div>
        {/* Rasta stripes at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "8px",
            display: "flex",
          }}
        >
          <div style={{ flex: 1, background: "#006B3F" }} />
          <div style={{ flex: 1, background: "#FFD700" }} />
          <div style={{ flex: 1, background: "#CE1126" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
