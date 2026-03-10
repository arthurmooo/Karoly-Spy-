import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function CoachLayout() {
  return (
    <div className="flex min-h-screen bg-bg-light dark:bg-bg-dark text-slate-800 dark:text-slate-100 font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
