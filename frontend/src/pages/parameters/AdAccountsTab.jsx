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

const PURPOSES = [
  { value: "genel", label: "Genel" },
  { value: "wix_kayit", label: "Wix Kayıt" },
  { value: "ig_dm", label: "Instagram DM" },
  { value: "wa_dm", label: "WhatsApp DM" },
];
const purposeLabel = (p) => PURPOSES.find((x) => x.value === p)?.label || p;

export default function AdAccountsTab() {
  const [items, setItems] = useState([]);
  const [actId, setActId] = useState("");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("genel");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => api.get("/ad-accounts").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditing(null); setActId(""); setName(""); setPurpose("genel"); setError("");
  };

  const save = async () => {
    if (!actId.trim()) { setError("Reklam hesabı ID'si zorunlu"); return; }
    setSaving(true);
    setError("");
    try {
      const body = { act_id: actId.trim(), name: name.trim(), purpose };
      if (editing) {
        await api.put(`/ad-accounts/${editing}`, body);
      } else {
        await api.post("/ad-accounts", body);
      }
      await load();
      reset();
    } catch (err) {
      setError(err.response?.data?.detail || "Kaydedilemedi");
    } finally { setSaving(false); }
  };

  const toggleActive = async (a) => {
    await api.put(`/ad-accounts/${a.id}`, { is_active: !a.is_active });
    await load();
  };

  const remove = async (id) => {
    if (!window.confirm("Bu reklam hesabını silmek istediğinden emin misin? (Geçmiş harcama kayıtları kalır)")) return;
    await api.delete(`/ad-accounts/${id}`);
    setItems((p) => p.filter((x) => x.id !== id));
  };

  return (
    <div>
      <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input value={actId} onChange={(e) => setActId(e.target.value)} placeholder="Hesap ID (act_123… veya 123…)"
            className={`${inputCls} font-mono`} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Görünen ad (örn. Wix Kampanyası)"
            className={inputCls} />
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={inputCls}>
            {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
          Amaç metriği belirler: <b>Wix Kayıt</b> → kayıt başı maliyet (CPA); <b>Instagram/WhatsApp DM</b> → konuşma başı maliyet; <b>Genel</b> → otomatik.
        </p>
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded-xl px-3 py-2 mb-3">{error}</div>
        )}
        <div className="flex gap-2">
          <button onClick={save} disabled={!actId.trim() || saving}
            className="py-2 px-5 rounded-xl text-sm font-semibold text-white transition-all min-w-[100px]
              bg-gradient-to-r from-indigo-500 to-violet-500
              hover:from-indigo-600 hover:to-violet-600
              shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
              disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700">
            {saving ? <Spinner /> : (editing ? "Güncelle" : "Ekle")}
          </button>
          {editing && <button onClick={reset} disabled={saving}
            className="py-2 px-5 rounded-xl text-sm font-medium transition-colors
              bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
              text-slate-700 dark:text-slate-200
              border border-slate-200/60 dark:border-white/10">İptal</button>}
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">Henüz reklam hesabı eklenmemiş</div>
        ) : items.map((a) => (
          <div key={a.id} className={`rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${!a.is_active ? "opacity-50" : ""}`}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-base shadow-md shadow-indigo-500/30 flex-shrink-0">
              📊
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{a.name}</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                  {purposeLabel(a.purpose)}
                </span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${a.is_active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400"}`}>
                  {a.is_active ? "Aktif" : "Pasif"}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{a.act_id}</div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => { setEditing(a.id); setActId(a.act_id); setName(a.name); setPurpose(a.purpose); setError(""); }}
                className="text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Düzenle</button>
              <button onClick={() => toggleActive(a)}
                className="text-slate-600 dark:text-slate-300 hover:bg-slate-500/10 rounded-lg px-3 py-1 text-xs transition-colors">{a.is_active ? "Pasifleştir" : "Aktifleştir"}</button>
              <button onClick={() => remove(a.id)}
                className="text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Sil</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
