import type { Metadata, Viewport } from "next";
import { getThemeScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "LipidLog",
  applicationName: "LipidLog",
  description: "Longitudinal cholesterol tracking with calculated LDL and ApoB.",
  // Names the app rather than the host wherever the OS shows one: the iOS
  // home-screen label, the PWA install prompt, and the entry a password
  // manager offers to save. It does not override the domain a password
  // manager keys on — only a custom domain fixes that (see SETUP.md).
  appleWebApp: { capable: true, statusBarStyle: "default", title: "LipidLog" },
  // Stop iOS auto-linking the numbers in a reading as phone numbers.
  formatDetection: { telephone: false, date: false, email: false, address: false },
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
