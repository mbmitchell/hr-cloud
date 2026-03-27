import "./globals.css";
import Sidebar from "../components/layout/sidebar";
import Header from "../components/layout/header";
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
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1">
              <Header />
              <main className="p-6">{children}</main>
            </div>
          </div>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}