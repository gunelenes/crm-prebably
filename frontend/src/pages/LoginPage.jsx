import { useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import Spinner from "../components/Spinner";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const dest = location.state?.from?.pathname || "/";
    return <Navigate to={dest} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      const dest = location.state?.from?.pathname || "/";
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Giriş başarısız oldu");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-1 text-center">CRM Girişi</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">Hesabınla giriş yap</p>

        <label className="text-xs text-gray-500 mb-1 block">Kullanıcı Adı</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-4 focus:outline-none focus:border-blue-400" />

        <label className="text-xs text-gray-500 mb-1 block">Parola</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-4 focus:outline-none focus:border-blue-400" />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting || !username || !password}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl py-2.5 text-sm font-medium">
          {submitting ? <Spinner /> : "Giriş Yap"}
        </button>
      </form>
    </div>
  );
}
