import { ImageResponse } from "next/og";

/** The 180×180 PNG Safari uses for "Add to Dock" and the iOS home screen.
 *  Without it macOS falls back to a grey letter tile. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#161618",
        }}
      >
        <svg
          width="112"
          height="112"
          viewBox="0 0 18 18"
          fill="none"
          stroke="#df3f2e"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1.5 13.5 L6 8 L10 10.5 L16.5 3" />
        </svg>
      </div>
    ),
    size,
  );
}
