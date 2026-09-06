import type { Metadata, Viewport } from "next";
import { getThemeScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "LipidLog",
  description: "Longitudinal cholesterol tracking with calculated LDL and ApoB.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before paint, so there is no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: getThemeScript() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
