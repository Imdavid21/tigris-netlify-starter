import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/base.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Celestial on Arc",
  description: "Permissionless token launches and onchain markets on Arc",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

const themeScript = `
(() => {
  try {
    const saved = localStorage.getItem("celestial-theme");
    const theme = saved === "dark" || saved === "light"
      ? saved
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch {}
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
