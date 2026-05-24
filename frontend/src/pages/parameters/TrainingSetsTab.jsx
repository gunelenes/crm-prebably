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

export default function TrainingSetsTab() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/training-sets").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/training-sets/${editing}`, { name, description });
      } else {
        await api.post("/training-sets", { name, description });
      }
      await load();
      setName(""); setDescription(""); setEditing(null);
    } finally { setSaving(false); }
  };

  const toggleActive = async (t) => {
    await api.put(`/training-sets/${t.id}`, { is_active: !t.is_active });
    await load();
  };

  const remove = async (id) => {
    if (!window.confirm("Bu eğitim setini silmek istediğinden emin misin?")) return;
    await api.delete(`/training-sets/${id}`);
    setItems((p) => p.filter((t) => t.id !== id));
  };

  return (
    <div>
      <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 mb-6">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Eğitim seti adı (örn. 21 Günlük Instagram)"
          className={`${inputCls} mb-3`} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Açıklama / video linki / notlar (opsiyonel)" rows={2}
          className={`${inputCls} resize-none mb-3`} />
        <div className="flex gap-2">
          <button onClick={save} disabled={!name.trim() || saving}
            className="py-2 px-5 rounded-xl text-sm font-semibold text-white transition-all min-w-[100px]
              bg-gradient-to-r from-indigo-500 to-violet-500
              hover:from-indigo-600 hover:to-violet-600
              shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
              disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700">
            {saving ? <Spinner /> : (editing ? "Güncelle" : "Ekle")}
          </button>
          {editing && <button onClick={() => { setEditing(null); setName(""); setDescription(""); }} disabled={saving}
            className="py-2 px-5 rounded-xl text-sm font-medium transition-colors
              bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
              text-slate-700 dark:text-slate-200
              border border-slate-200/60 dark:border-white/10">İptal</button>}
        </div>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">Henüz eğitim seti tanımlanmamış</div>
        ) : items.map((t) => (
          <div key={t.id} className={`rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 flex items-start gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${!t.is_active ? "opacity-50" : ""}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-slate-800 dark:text-slate-100 text-sm">{t.name}</span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${t.is_active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400"}`}>
                  {t.is_active ? "Aktif" : "Pasif"}
                </span>
              </div>
              {t.description && <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap">{t.description}</div>}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => { setEditing(t.id); setName(t.name); setDescription(t.description || ""); }}
                className="text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Düzenle</button>
              <button onClick={() => toggleActive(t)}
                className="text-slate-600 dark:text-slate-300 hover:bg-slate-500/10 rounded-lg px-3 py-1 text-xs transition-colors">{t.is_active ? "Pasifleştir" : "Aktifleştir"}</button>
              <button onClick={() => remove(t.id)}
                className="text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Sil</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
