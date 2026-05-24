import { useCallback, useEffect, useState } from "react";
import api from "../../api";
import { formatTime } from "../../utils";
import PaymentFormModal from "../payments/PaymentFormModal";

const fmt = (n) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n || 0);

const openDocument = async (paymentId) => {
  try {
    const res = await api.get(`/payments/${paymentId}/document`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    alert("Belge açılamadı");
  }
};

export default function ContactPaymentsTab({ contactId, contactName }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, net: 0 });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, baRes] = await Promise.all([
        api.get("/payments", { params: { contact_id: contactId, type: "income", limit: 200 } }),
        api.get("/bank-accounts"),
      ]);
      setItems(pRes.data.items);
      setSummary(pRes.data.summary || { income: 0, expense: 0, net: 0 });
      setBankAccounts(baRes.data);
    } finally { setLoading(false); }
  }, [contactId]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id) => {
    if (!window.confirm("Bu ödemeyi silmek istediğinden emin misin?")) return;
    await api.delete(`/payments/${id}`);
    load();
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Ödemeler</h3>
            <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">
              Toplam Tahsilat: <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(summary.income)}</span>
            </div>
          </div>
          <button onClick={() => setShowForm(true)}
            className="text-xs px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30 hover:from-indigo-600 hover:to-violet-600">
            + Yeni Tahsilat
          </button>
        </div>

        {loading && items.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-slate-200/60 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">Henüz tahsilat kaydı yok</div>
        ) : (
          <div className="space-y-2">
            {items.map((p) => (
              <div key={p.id} className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 flex items-center gap-4 transition-all hover:-translate-y-0.5">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white text-base flex-shrink-0 shadow-md bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-emerald-500/30">
                  ↑
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.bank_account && (
                      <span className="text-sm text-slate-800 dark:text-slate-100">🏦 {p.bank_account.bank_name} · {p.bank_account.iban.slice(-4)}</span>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400">📅 {formatTime(p.paid_at)}</span>
                  </div>
                  {p.description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{p.description}</div>}
                  {p.created_by && <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">👤 {p.created_by.full_name || p.created_by.username}</div>}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    + {fmt(p.amount)}
                  </div>
                  <div className="flex items-center gap-1">
                    {p.has_document && (
                      <button onClick={() => openDocument(p.id)}
                        title={p.document_filename}
                        className="text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 rounded-lg px-2 py-1 text-xs">📎 Dekont</button>
                    )}
                    <button onClick={() => remove(p.id)}
                      className="text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg px-2 py-1 text-xs">Sil</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <PaymentFormModal
            bankAccounts={bankAccounts}
            presetContact={{ id: contactId, name: contactName }}
            lockType="income"
            onClose={() => setShowForm(false)}
            onSaved={load}
          />
        )}
      </div>
    </div>
  );
}
