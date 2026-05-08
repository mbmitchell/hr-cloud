import "./globals.css";
import Sidebar from "../components/layout/sidebar";
import Header from "../components/layout/header";
import AppShell from "../components/layout/app-shell";
import { auth } from "../auth";

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
