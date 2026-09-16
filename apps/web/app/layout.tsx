import type { Metadata } from "next";
import localFont from "next/font/local";
const geist = localFont({src:"../public/fonts/geist-latin.woff2",display:"swap",variable:"--font-sans"});
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Celestial on Arc",
  description: "Permissionless token launches and onchain markets on Arc"
};

const themeScript = `
(() => {
  try {
    const saved = localStorage.getItem("celestial-theme");
    document.documentElement.dataset.theme = saved === "dark" ? "dark" : "light";
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
      <body className={geist.variable}><Providers>{children}</Providers></body>
    </html>
  );
}
