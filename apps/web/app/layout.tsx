import type { Metadata } from "next";
import "./globals.css";
import "./cyberpunk.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Arc Launchpad",
  description: "USDC-native token launches on Arc"
};

const themeScript = `
(() => {
  try {
    const saved = localStorage.getItem("celestial-theme");
    const theme = saved === "light" || saved === "dark"
      ? saved
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
