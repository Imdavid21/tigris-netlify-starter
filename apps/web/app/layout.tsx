import type { Metadata } from "next";
import "./globals.css";
import "./utopia.css";
import "./utopia-app.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Celestial on Arc",
  description: "Permissionless token launches and onchain markets on Arc"
};

const themeScript = `
(() => {
  try {
    document.documentElement.dataset.theme = "dark";
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
