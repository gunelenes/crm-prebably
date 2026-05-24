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

const maskIban = (iban) => {
  if (!iban) return "";
  const s = iban.replace(/\s/g, "");
  if (s.length <= 8) return s;
  return s.slice(0, 6) + "…" + s.slice(-4);
};

export default function BankAccountsTab() {
  const [items, setItems] = useState([]);
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [holder, setHolder] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/bank-accounts").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditing(null); setBankName(""); setIban(""); setHolder(""); setDescription("");
  };

  const save = async () => {
    if (!bankName.trim() || !iban.trim()) return;
    setSaving(true);
    try {
      const body = { bank_name: bankName, iban, account_holder: holder, description };
      if (editing) {
        await api.put(`/bank-accounts/${editing}`, body);
      } else {
        await api.post("/bank-accounts", body);
      }
      await load();
      reset();
    } finally { setSaving(false); }
  };

  const toggleActive = async (b) => {
    await api.put(`/bank-accounts/${b.id}`, { is_active: !b.is_active });
    await load();
  };

  const remove = async (id) => {
    if (!window.confirm("Bu banka hesabını silmek istediğinden emin misin?")) return;
    await api.delete(`/bank-accounts/${id}`);
    setItems((p) => p.filter((x) => x.id !== id));
  };

  return (
    <div>
      <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Banka adı (örn. Garanti)"
            className={inputCls} />
          <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IBAN (TR...)"
            className={`${inputCls} font-mono`} />
          <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Hesap sahibi (örn. Şirket Ltd.)"
            className={inputCls} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Açıklama (opsiyonel)"
            className={inputCls} />
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={!bankName.trim() || !iban.trim() || saving}
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
          <div className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">Henüz banka hesabı tanımlanmamış</div>
        ) : items.map((b) => (
          <div key={b.id} className={`rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${!b.is_active ? "opacity-50" : ""}`}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-base shadow-md shadow-indigo-500/30 flex-shrink-0">
              🏦
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{b.bank_name}</span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${b.is_active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400"}`}>
                  {b.is_active ? "Aktif" : "Pasif"}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{b.iban}</div>
              {(b.account_holder || b.description) && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {b.account_holder && <span>👤 {b.account_holder}</span>}
                  {b.description && <span className="ml-2 opacity-80">{b.description}</span>}
                </div>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => { setEditing(b.id); setBankName(b.bank_name); setIban(b.iban); setHolder(b.account_holder || ""); setDescription(b.description || ""); }}
                className="text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Düzenle</button>
              <button onClick={() => toggleActive(b)}
                className="text-slate-600 dark:text-slate-300 hover:bg-slate-500/10 rounded-lg px-3 py-1 text-xs transition-colors">{b.is_active ? "Pasifleştir" : "Aktifleştir"}</button>
              <button onClick={() => remove(b.id)}
                className="text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Sil</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
