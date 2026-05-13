import "./globals.css";
import type { Metadata, Viewport } from "next";
import Sidebar from "../components/layout/sidebar";
import Header from "../components/layout/header";
import AppShell from "../components/layout/app-shell";
import { auth } from "../auth";

const metadataBase = (() => {
  const configuredBaseUrl =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "https://mfnhr.mfncuso.com";

  try {
    return new URL(configuredBaseUrl);
  } catch {
    return new URL("https://mfnhr.mfncuso.com");
  }
})();

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "MFN HR",
    template: "%s | MFN HR",
  },
  description: "Managed Financial Networks Human Resources Platform",
  applicationName: "MFN HR",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.ico" }],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    title: "MFN HR",
    description: "Managed Financial Networks Human Resources Platform",
    siteName: "MFN HR",
  },
  appleWebApp: {
    capable: true,
    title: "MFN HR",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isSignedIn = !!session?.user;

  return (
    <html lang="en">
      <body className="bg-slate-100">
        {isSignedIn ? (
          <AppShell
            desktopSidebar={<Sidebar />}
            mobileSidebar={<Sidebar mobile />}
            header={<Header />}
          >
            {children}
          </AppShell>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}
