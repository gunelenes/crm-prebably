import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="relative flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-300/40 dark:bg-indigo-600/20 blur-3xl" />
          <div className="absolute -bottom-32 right-1/4 h-96 w-96 rounded-full bg-violet-300/40 dark:bg-violet-600/20 blur-3xl" />
        </div>
        <div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-10 h-10" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}
