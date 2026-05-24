import { useEffect, useState } from "react";
import api from "../../api";
import Spinner from "../../components/Spinner";

const inputCls =
  "w-full rounded-xl px-4 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

export default function StatusesTab() {
  const [statuses, setStatuses] = useState([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366F1");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/statuses").then((r) => setStatuses(r.data));
  }, []);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/statuses/${editing}`, { name, color });
      } else {
        await api.post("/statuses", { name, color });
      }
      const res = await api.get("/statuses");
      setStatuses(res.data);
      setName(""); setColor("#6366F1"); setEditing(null);
    } finally { setSaving(false); }
  };

  const toggleActive = async (s) => {
    await api.put(`/statuses/${s.id}`, { is_active: !s.is_active });
    const res = await api.get("/statuses");
    setStatuses(res.data);
  };

  const remove = async (id) => {
    if (!window.confirm("Bu statüyü silmek istediğinden emin misin?")) return;
    await api.delete(`/statuses/${id}`);
    setStatuses((p) => p.filter((s) => s.id !== id));
  };

  return (
    <div>
      <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 mb-6">
        <div className="flex gap-3 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Statü adı"
            className={`flex-1 ${inputCls}`} />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            className="w-12 h-10 rounded-xl border border-slate-200/60 dark:border-white/10 cursor-pointer p-1 bg-white/60 dark:bg-slate-800/50" />
        </div>
        {name && (
          <div className="mb-4">
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium text-white shadow-md" style={{ backgroundColor: color, boxShadow: `0 6px 18px ${color}40` }}>{name}</span>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={save} disabled={!name.trim() || saving}
            className="py-2 px-5 rounded-xl text-sm font-semibold text-white transition-all min-w-[100px]
              bg-gradient-to-r from-indigo-500 to-violet-500
              hover:from-indigo-600 hover:to-violet-600
              shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
              disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700">
            {saving ? <Spinner /> : (editing ? "Güncelle" : "Ekle")}
          </button>
          {editing && <button onClick={() => { setEditing(null); setName(""); setColor("#6366F1"); }} disabled={saving}
            className="py-2 px-5 rounded-xl text-sm font-medium transition-colors
              bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
              text-slate-700 dark:text-slate-200
              border border-slate-200/60 dark:border-white/10">İptal</button>}
        </div>
      </div>
      <div className="space-y-3">
        {statuses.map((s) => (
          <div key={s.id} className={`rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${!s.is_active ? "opacity-50" : ""}`}>
            <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-md" style={{ backgroundColor: s.color, boxShadow: `0 4px 12px ${s.color}50` }} />
            <div className="flex-1">
              <span className="font-medium text-slate-800 dark:text-slate-100 text-sm">{s.name}</span>
              <span className={`ml-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${s.is_active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400"}`}>
                {s.is_active ? "Aktif" : "Pasif"}
              </span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(s.id); setName(s.name); setColor(s.color); }}
                className="text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Düzenle</button>
              <button onClick={() => toggleActive(s)}
                className="text-slate-600 dark:text-slate-300 hover:bg-slate-500/10 rounded-lg px-3 py-1 text-xs transition-colors">{s.is_active ? "Pasifleştir" : "Aktifleştir"}</button>
              <button onClick={() => remove(s.id)}
                className="text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Sil</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
