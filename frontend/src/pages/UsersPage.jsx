import { useEffect, useState } from "react";
import api from "../api";
import Spinner from "../components/Spinner";

const inputCls =
  "w-full rounded-xl px-4 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(null);

  const load = async () => {
    const res = await api.get("/users");
    setUsers(res.data);
  };
  useEffect(() => { load(); }, []);

  const createUser = async () => {
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Kullanıcı adı ve parola zorunlu");
      return;
    }
    setSaving(true);
    try {
      await api.post("/users", { username, password, full_name: fullName, email, role });
      setUsername(""); setFullName(""); setEmail(""); setPassword(""); setRole("user");
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Oluşturulamadı");
    } finally { setSaving(false); }
  };

  const toggleActive = async (u) => {
    await api.put(`/users/${u.id}`, { is_active: !u.is_active });
    load();
  };

  const changeRole = async (u, newRole) => {
    await api.put(`/users/${u.id}`, { role: newRole });
    load();
  };

  const editEmail = async (u) => {
    const next = window.prompt(`E-posta (${u.username} için, boş bırakılırsa silinir):`, u.email || "");
    if (next === null) return; // iptal
    try {
      await api.put(`/users/${u.id}`, { email: next.trim() });
      load();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || "Bilinmeyen"));
    }
  };

  const resetPassword = async (u) => {
    const newPw = window.prompt(`Yeni parola (${u.username} için, en az 6 karakter):`);
    if (!newPw) return;
    setResetting(u.id);
    try {
      await api.put(`/users/${u.id}/password`, { password: newPw });
      alert("Parola güncellendi.");
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || "Bilinmeyen"));
    } finally { setResetting(null); }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Kullanıcılar</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ekip üyelerini yönet</p>
        </div>

        <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 mb-6">
          <h3 className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-3">Yeni Kullanıcı</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Kullanıcı adı (login)"
              className={inputCls} />
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ad Soyad"
              className={inputCls} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta (opsiyonel)"
              className={inputCls} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Parola (min 6)"
              className={inputCls} />
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className={inputCls}>
              <option value="user">Normal kullanıcı</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded-xl px-3 py-2 mb-3">
              {error}
            </div>
          )}
          <button onClick={createUser} disabled={saving || !username || !password}
            className="py-2 px-6 rounded-xl text-sm font-semibold text-white transition-all min-w-[120px]
              bg-gradient-to-r from-indigo-500 to-violet-500
              hover:from-indigo-600 hover:to-violet-600
              shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
              disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700">
            {saving ? <Spinner /> : "Oluştur"}
          </button>
        </div>

        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className={`rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${!u.is_active ? "opacity-50" : ""}`}>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-semibold shadow-md shadow-indigo-500/30 flex-shrink-0">
                {(u.full_name || u.username)[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-medium text-slate-800 dark:text-slate-100 text-sm">{u.full_name || u.username}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">@{u.username}</div>
                {u.email && <div className="text-xs text-slate-400 dark:text-slate-500">✉️ {u.email}</div>}
                <div className="mt-1 flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${u.role === "admin"
                    ? "bg-gradient-to-r from-indigo-500/20 to-violet-500/20 text-indigo-700 dark:text-indigo-300"
                    : "bg-slate-200/60 dark:bg-white/5 text-slate-700 dark:text-slate-300"}`}>
                    {u.role === "admin" ? "Admin" : "Kullanıcı"}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${u.is_active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400"}`}>
                    {u.is_active ? "Aktif" : "Pasif"}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => changeRole(u, u.role === "admin" ? "user" : "admin")}
                  className="text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 rounded-lg px-3 py-1 text-xs transition-colors">
                  {u.role === "admin" ? "Admin'liği kaldır" : "Admin yap"}
                </button>
                <button onClick={() => editEmail(u)}
                  className="text-sky-600 dark:text-sky-300 hover:bg-sky-500/10 rounded-lg px-3 py-1 text-xs transition-colors">
                  E-posta düzenle
                </button>
                <button onClick={() => resetPassword(u)} disabled={resetting === u.id}
                  className="text-orange-500 dark:text-orange-300 hover:bg-orange-500/10 rounded-lg px-3 py-1 text-xs transition-colors">
                  {resetting === u.id ? "..." : "Parola sıfırla"}
                </button>
                <button onClick={() => toggleActive(u)}
                  className="text-slate-600 dark:text-slate-300 hover:bg-slate-500/10 rounded-lg px-3 py-1 text-xs transition-colors">
                  {u.is_active ? "Pasifleştir" : "Aktifleştir"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
