import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 675 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 44,
          padding: "48px 64px",
          background: "linear-gradient(180deg, #10242A 0%, #1A1A0E 50%, #0F1512 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 16,
            display: "flex",
          }}
        >
          <div style={{ flex: 1, background: "#006B3F" }} />
          <div style={{ flex: 1, background: "#FFD700" }} />
          <div style={{ flex: 1, background: "#CE1126" }} />
        </div>

        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: 56,
            border: "8px solid #8B4513",
            background: "linear-gradient(180deg, #10242A 0%, #1A1A0E 50%, #0F1512 100%)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 14, display: "flex" }}>
            <div style={{ flex: 1, background: "#006B3F" }} />
            <div style={{ flex: 1, background: "#FFD700" }} />
            <div style={{ flex: 1, background: "#CE1126" }} />
          </div>
          <div
            style={{
              position: "absolute",
              width: 102,
              height: 102,
              borderRadius: 999,
              background: "linear-gradient(180deg, #FFD700 0%, #CE1126 100%)",
              left: 89,
              top: 48,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 138,
              height: 112,
              background: "linear-gradient(90deg, #006B3F 0%, #0077BE 100%)",
              borderTopLeftRadius: "60% 45%",
              borderTopRightRadius: "40% 40%",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 62,
              left: 102,
              width: 0,
              height: 0,
              borderLeft: "38px solid transparent",
              borderRight: "38px solid transparent",
              borderBottom: "130px solid #FFD700",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 150,
              left: 95,
              width: 88,
              height: 88,
              borderRadius: "50%",
              background: "#1A1A0E",
              border: "8px solid #D4A857",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 100,
              left: 95,
              width: 88,
              height: 88,
              borderRadius: "50%",
              background: "#FFD700",
              border: "8px solid #D4A857",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", color: "#F4E1C1", maxWidth: 640 }}>
          <div style={{ fontSize: 78, fontWeight: 900, lineHeight: 1 }}>BACK YA'MON!</div>
          <div style={{ marginTop: 20, fontSize: 34, color: "#D9C8A6", lineHeight: 1.2 }}>
            Play backgammon with island vibes, reactive audio, and dub sound system flavor.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
