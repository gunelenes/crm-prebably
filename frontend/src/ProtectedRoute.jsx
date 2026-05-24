import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="animate-spin border-4 border-blue-500 border-t-transparent rounded-full w-10 h-10" />
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
