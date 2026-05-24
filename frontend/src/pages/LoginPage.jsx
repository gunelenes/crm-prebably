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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40 text-slate-900 dark:text-slate-100">
      {/* Mesh blob'lar */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-indigo-300/40 dark:bg-indigo-600/20 blur-3xl" />
        <div className="absolute top-1/4 -right-32 h-[32rem] w-[32rem] rounded-full bg-violet-300/40 dark:bg-violet-600/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-fuchsia-200/40 dark:bg-fuchsia-700/15 blur-3xl" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm mx-4 rounded-3xl p-10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl shadow-indigo-500/20"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-xl shadow-indigo-500/40 flex items-center justify-center text-white text-2xl font-bold mb-4">
            C
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-violet-500">
            CRM'e Giriş
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Hesabınla devam et
          </p>
        </div>

        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
          Kullanıcı Adı
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
          className="w-full rounded-xl px-4 py-2.5 text-sm mb-4 transition-all
            bg-white/50 dark:bg-slate-800/50 backdrop-blur
            border border-slate-200/80 dark:border-white/10
            focus:bg-white dark:focus:bg-slate-800
            focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
        />

        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
          Parola
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-xl px-4 py-2.5 text-sm mb-4 transition-all
            bg-white/50 dark:bg-slate-800/50 backdrop-blur
            border border-slate-200/80 dark:border-white/10
            focus:bg-white dark:focus:bg-slate-800
            focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
        />

        {error && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded-xl px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !username || !password}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all
            bg-gradient-to-r from-indigo-500 to-violet-500
            hover:from-indigo-600 hover:to-violet-600
            shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
            disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none disabled:cursor-not-allowed dark:disabled:from-slate-700 dark:disabled:to-slate-700"
        >
          {submitting ? <Spinner /> : "Giriş Yap"}
        </button>
      </form>
    </div>
  );
}
