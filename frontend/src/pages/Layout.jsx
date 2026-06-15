import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

function PageFallback() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-8 h-8" />
    </div>
  );
}

export default function Layout() {
  return (
    <div className="relative flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40 text-slate-900 dark:text-slate-100">
      {/* Decoratif mesh blob'lar — sayfa scroll'undan etkilenmez, blur ile yumuşar */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-300/40 dark:bg-indigo-600/20 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-violet-300/40 dark:bg-violet-600/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-fuchsia-200/40 dark:bg-fuchsia-700/15 blur-3xl" />
      </div>
      <Sidebar />
      <main className="flex flex-1 overflow-hidden">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
