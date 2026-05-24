import { useEffect, useState } from "react";
import api from "../../api";
import Spinner from "../../components/Spinner";
import ContactSearchInput from "./ContactSearchInput";

const inputCls =
  "w-full rounded-xl px-3 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

const todayISO = () => new Date().toISOString().slice(0, 10);

const ALLOWED_MIMES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE = 10 * 1024 * 1024;

export default function PaymentFormModal({
  bankAccounts,
  presetContact = null,    // { id, name } gelirse kişi alanı kilitli
  lockType = null,         // 'income' | 'expense' kilidi
  onClose,
  onSaved,
}) {
  const [type, setType] = useState(lockType || "income");
  const [contact, setContact] = useState(presetContact);
  const [bankAccountId, setBankAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [document, setDocument] = useState(null); // File
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lockType) setType(lockType);
  }, [lockType]);

  const onPickFile = (f) => {
    setError("");
    if (!f) { setDocument(null); return; }
    if (!ALLOWED_MIMES.includes(f.type)) {
      setError("Sadece PDF, JPG veya PNG yüklenebilir");
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("Dosya 10MB'tan büyük olamaz");
      return;
    }
    setDocument(f);
  };

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    if (!amount || Number(amount) <= 0) {
      setError("Tutar 0'dan büyük olmalı"); return;
    }
    if (type === "income" && !contact?.id) {
      setError("Gelir kaydında kişi seçimi zorunlu"); return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("type", type);
      fd.append("amount", String(amount));
      fd.append("paid_at", new Date(paidAt).toISOString());
      if (type === "income" && contact?.id) fd.append("contact_id", String(contact.id));
      if (bankAccountId) fd.append("bank_account_id", String(bankAccountId));
      if (description) fd.append("description", description);
      if (document) fd.append("document", document);
      await api.post("/payments", fd);
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.detail || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <form onSubmit={submit}
        className="w-full max-w-xl rounded-3xl p-7 bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl shadow-indigo-500/20 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-5 flex items-center gap-2">
          <span>💳</span> Yeni Ödeme
        </h3>

        {/* Tip seçici */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Tip</div>
          <div className="flex gap-2">
            {[
              { id: "income", label: "💰 Gelir / Tahsilat", from: "emerald-400", to: "emerald-500" },
              { id: "expense", label: "💸 Gider / Masraf", from: "rose-400", to: "rose-500" },
            ].map((t) => {
              const active = type === t.id;
              const disabled = lockType && lockType !== t.id;
              return (
                <button type="button" key={t.id} onClick={() => !disabled && setType(t.id)} disabled={disabled}
                  className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${active
                    ? (t.id === "income"
                      ? "bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-md shadow-emerald-500/30"
                      : "bg-gradient-to-r from-rose-400 to-rose-500 text-white shadow-md shadow-rose-500/30")
                    : "bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"}`}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Kişi (sadece gelir) */}
        {type === "income" && (
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Kişi *</div>
            <ContactSearchInput value={contact} onChange={setContact} disabled={!!presetContact} />
          </div>
        )}

        {/* Banka hesabı + tutar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Banka Hesabı</div>
            <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inputCls}>
              <option value="">Seç (opsiyonel)</option>
              {bankAccounts.filter((b) => b.is_active).map((b) => (
                <option key={b.id} value={b.id}>{b.bank_name} — {b.iban.slice(0, 6)}…{b.iban.slice(-4)}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Tutar (₺) *</div>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00" className={`${inputCls} font-mono`} />
          </div>
        </div>

        {/* Tarih + açıklama */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Tarih *</div>
            <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Açıklama</div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notlar..." rows={2}
            className={`${inputCls} resize-none`} />
        </div>

        {/* Dekont */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Dekont (PDF/JPG/PNG, max 10MB)</div>
          {document ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
              <span className="text-2xl">{document.type === "application/pdf" ? "📄" : "🖼️"}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{document.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{(document.size / 1024).toFixed(1)} KB</div>
              </div>
              <button type="button" onClick={() => setDocument(null)}
                className="text-rose-500 hover:bg-rose-500/10 rounded-lg px-2 py-1 text-xs">Kaldır</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1 p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/10 cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors">
              <span className="text-2xl">📎</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Dosya seç veya sürükle</span>
              <input type="file" accept=".pdf,image/jpeg,image/png" onChange={(e) => onPickFile(e.target.files?.[0])}
                className="hidden" />
            </label>
          )}
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded-xl px-3 py-2 mb-3">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all
              bg-gradient-to-r from-indigo-500 to-violet-500
              hover:from-indigo-600 hover:to-violet-600
              shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
              disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700">
            {saving ? <Spinner /> : "Kaydet"}
          </button>
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors
              bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
              text-slate-700 dark:text-slate-200
              border border-slate-200/60 dark:border-white/10">İptal</button>
        </div>
      </form>
    </div>
  );
}
