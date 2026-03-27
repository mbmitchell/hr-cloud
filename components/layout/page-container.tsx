import Sidebar from "./sidebar";
import Header from "./header";
import { ReactNode } from "react";

export default function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">

      <Sidebar />

      <div className="flex flex-col flex-1">

        <Header />

        <main className="flex-1 p-6 bg-slate-50 overflow-auto">
          {children}
        </main>

      </div>

    </div>
  );
}