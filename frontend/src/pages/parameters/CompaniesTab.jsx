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

export default function CompaniesTab() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/companies").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditing(null); setName(""); setEmail(""); setLogoUrl("");
  };

  const save = async () => {
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    try {
      const body = { name, email, logo_url: logoUrl };
      if (editing) {
        await api.put(`/companies/${editing}`, body);
      } else {
        await api.post("/companies", body);
      }
      await load();
      reset();
    } finally { setSaving(false); }
  };

  const toggleActive = async (c) => {
    await api.put(`/companies/${c.id}`, { is_active: !c.is_active });
    await load();
  };

  const remove = async (id) => {
    if (!window.confirm("Bu şirketi silmek istediğinden emin misin?")) return;
    await api.delete(`/companies/${id}`);
    setItems((p) => p.filter((x) => x.id !== id));
  };

  return (
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Seminer formlarında gönderen olarak kullanılır. Form oluştururken seçtiğin şirketin
        e-postası, kayıt olanlara giden mailin "yanıt adresi" olur.
      </p>

      <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Şirket adı (örn. Baharat Medya)"
            className={inputCls} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="İletişim e-postası (yanıt adresi)"
            type="email" className={inputCls} />
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="Logo URL (opsiyonel, https://... .png/.jpg)"
            className={`${inputCls} md:col-span-2`} />
        </div>
        {logoUrl.trim() && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Önizleme:</span>
            <img src={logoUrl} alt="logo" className="h-8 max-w-[140px] object-contain rounded bg-white/60 p-1"
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={save} disabled={!name.trim() || !email.trim() || saving}
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
          <div className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">Henüz şirket tanımlanmamış</div>
        ) : items.map((c) => (
          <div key={c.id} className={`rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${!c.is_active ? "opacity-50" : ""}`}>
            {c.logo_url ? (
              <img src={c.logo_url} alt="" className="h-10 w-10 rounded-xl object-contain bg-white shadow-md flex-shrink-0 p-1"
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-base shadow-md shadow-indigo-500/30 flex-shrink-0">
                🏢
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{c.name}</span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${c.is_active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400"}`}>
                  {c.is_active ? "Aktif" : "Pasif"}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">✉️ {c.email}</div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => { setEditing(c.id); setName(c.name); setEmail(c.email); setLogoUrl(c.logo_url || ""); }}
                className="text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Düzenle</button>
              <button onClick={() => toggleActive(c)}
                className="text-slate-600 dark:text-slate-300 hover:bg-slate-500/10 rounded-lg px-3 py-1 text-xs transition-colors">{c.is_active ? "Pasifleştir" : "Aktifleştir"}</button>
              <button onClick={() => remove(c.id)}
                className="text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Sil</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
