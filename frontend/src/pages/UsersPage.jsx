import { useEffect, useState } from "react";
import api from "../api";
import Spinner from "../components/Spinner";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
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
      await api.post("/users", { username, password, full_name: fullName, role });
      setUsername(""); setFullName(""); setPassword(""); setRole("user");
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
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Kullanıcılar</h2>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="font-medium text-gray-700 mb-4">Yeni Kullanıcı</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Kullanıcı adı (login)"
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400" />
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ad Soyad"
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Parola (min 6)"
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400" />
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400">
            <option value="user">Normal kullanıcı</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">{error}</div>}
        <button onClick={createUser} disabled={saving || !username || !password}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl px-5 py-2 text-sm font-medium min-w-[120px]">
          {saving ? <Spinner /> : "Oluştur"}
        </button>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 ${!u.is_active ? "opacity-50" : ""}`}>
            <div className="flex-1">
              <div className="font-medium text-gray-800 text-sm">{u.full_name || u.username}</div>
              <div className="text-xs text-gray-500">@{u.username}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                  {u.role === "admin" ? "Admin" : "Kullanıcı"}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {u.is_active ? "Aktif" : "Pasif"}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => changeRole(u, u.role === "admin" ? "user" : "admin")}
                className="text-blue-500 hover:bg-blue-50 rounded-lg px-3 py-1 text-xs">
                {u.role === "admin" ? "Admin'liği kaldır" : "Admin yap"}
              </button>
              <button onClick={() => resetPassword(u)} disabled={resetting === u.id}
                className="text-orange-500 hover:bg-orange-50 rounded-lg px-3 py-1 text-xs">
                {resetting === u.id ? "..." : "Parola sıfırla"}
              </button>
              <button onClick={() => toggleActive(u)}
                className="text-gray-500 hover:bg-gray-50 rounded-lg px-3 py-1 text-xs">
                {u.is_active ? "Pasifleştir" : "Aktifleştir"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
