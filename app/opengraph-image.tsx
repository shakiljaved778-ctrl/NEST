import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "QatarStore — Premium website design in Qatar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#0B1B33",
          backgroundImage:
            "radial-gradient(600px 400px at 10% 0%, rgba(201,162,75,0.18), transparent 60%)",
          color: "#F5F2EA",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34 }}>
          <div
            style={{
              width: 56,
              height: 56,
              border: "2px solid #C9A24B",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#C9A24B",
            }}
          >
            Q
          </div>
          <span>
            Qatar<span style={{ color: "#C9A24B" }}>Store</span>
          </span>
        </div>
        <div style={{ marginTop: 40, fontSize: 66, lineHeight: 1.1, maxWidth: 900 }}>
          Websites that make Qatar businesses look world-class.
        </div>
        <div style={{ marginTop: 32, fontSize: 28, color: "#C9A24B" }}>
          Built in Doha · Arabic + English · Delivered in 14 days · Fixed pricing
        </div>
      </div>
    ),
    { ...size }
  );
}
