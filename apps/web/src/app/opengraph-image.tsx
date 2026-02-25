import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "56px 72px",
          background: "linear-gradient(180deg, #10242A 0%, #1A1A0E 48%, #0F1512 100%)",
          color: "#F4E1C1",
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
            height: 18,
            display: "flex",
          }}
        >
          <div style={{ flex: 1, background: "#006B3F" }} />
          <div style={{ flex: 1, background: "#FFD700" }} />
          <div style={{ flex: 1, background: "#CE1126" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 700 }}>
          <div style={{ fontSize: 74, fontWeight: 800, letterSpacing: 1, lineHeight: 1.02 }}>
            BACK YA'MON!
          </div>
          <div style={{ fontSize: 34, color: "#D9C8A6" }}>
            Backgammon with island rhythm, reggae flavor, and sound system style.
          </div>
        </div>

        <div
          style={{
            width: 330,
            height: 330,
            borderRadius: 64,
            border: "8px solid #8B4513",
            background: "linear-gradient(180deg, #10242A 0%, #1A1A0E 50%, #0F1512 100%)",
            position: "relative",
            overflow: "hidden",
            display: "flex",
          }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 16, display: "flex" }}>
            <div style={{ flex: 1, background: "#006B3F" }} />
            <div style={{ flex: 1, background: "#FFD700" }} />
            <div style={{ flex: 1, background: "#CE1126" }} />
          </div>
          <div
            style={{
              position: "absolute",
              width: 124,
              height: 124,
              borderRadius: 999,
              background: "linear-gradient(180deg, #FFD700 0%, #CE1126 100%)",
              left: 104,
              top: 56,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 164,
              height: 122,
              background: "linear-gradient(90deg, #006B3F 0%, #0077BE 100%)",
              borderTopLeftRadius: "62% 45%",
              borderTopRightRadius: "38% 42%",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 76,
              left: 122,
              width: 0,
              height: 0,
              borderLeft: "42px solid transparent",
              borderRight: "42px solid transparent",
              borderBottom: "146px solid #FFD700",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 178,
              left: 118,
              width: 94,
              height: 94,
              borderRadius: "50%",
              background: "#1A1A0E",
              border: "8px solid #D4A857",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 124,
              left: 118,
              width: 94,
              height: 94,
              borderRadius: "50%",
              background: "#FFD700",
              border: "8px solid #D4A857",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
