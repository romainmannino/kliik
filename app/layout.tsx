import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./multiplayer.css";
import "./upgrade.css";
import "./stable.css";
import "./home-hotfix.css";
import "./f1-brand.css";
import "./f1-final.css";
import PresenceGuard from "./PresenceGuard";
import InstallPrompt from "./InstallPrompt";

export const metadata: Metadata = {
  title: "KLIIK — mini-jeux, gros défis",
  description: "Joue, défie tes amis et lance des parties multijoueurs instantanées.",
  applicationName: "KLIIK",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    shortcut: "/logo.png",
    apple: [{ url: "/logo.png", sizes: "2000x2000", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "KLIIK",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1d16f5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}<PresenceGuard/><InstallPrompt/></body>
    </html>
  );
}
