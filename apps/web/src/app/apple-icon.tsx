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
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(180deg, #10242A 0%, #1A1A0E 48%, #0F1512 100%)",
          borderRadius: "36px",
          border: "4px solid #8B4513",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "9px",
            display: "flex",
          }}
        >
          <div style={{ flex: 1, background: "#006B3F" }} />
          <div style={{ flex: 1, background: "#FFD700" }} />
          <div style={{ flex: 1, background: "#CE1126" }} />
        </div>

        <div
          style={{
            position: "absolute",
            top: "24px",
            left: "58px",
            width: "64px",
            height: "64px",
            borderRadius: "999px",
            background: "linear-gradient(180deg, #FFD700 0%, #CE1126 100%)",
            opacity: 0.95,
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "86px",
            height: "70px",
            background: "linear-gradient(90deg, #006B3F 0%, #0077BE 100%)",
            borderTopLeftRadius: "60% 50%",
            borderTopRightRadius: "40% 40%",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "42px",
            left: "67px",
            width: 0,
            height: 0,
            borderLeft: "24px solid transparent",
            borderRight: "24px solid transparent",
            borderBottom: "78px solid #FFD700",
            opacity: 0.95,
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "90px",
            left: "64px",
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            background: "#1A1A0E",
            border: "4px solid #D4A857",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "58px",
            left: "64px",
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            background: "#FFD700",
            border: "4px solid #D4A857",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "90px",
            right: "18px",
            width: "38px",
            height: "38px",
            borderRadius: "8px",
            background: "#1A1A0E",
            border: "3px solid #D4A857",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#F4E1C1",
              position: "absolute",
              left: "9px",
              top: "9px",
            }}
          />
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#F4E1C1",
              position: "absolute",
              right: "9px",
              bottom: "9px",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
