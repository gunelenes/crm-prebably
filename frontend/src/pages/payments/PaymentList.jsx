import api from "../../api";
import { formatTime } from "../../utils";

const fmt = (n) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n || 0);

const openDocument = async (paymentId) => {
  try {
    const res = await api.get(`/payments/${paymentId}/document`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    alert("Belge açılamadı");
  }
};

export default function PaymentList({ items, loading, onDelete }) {
  const remove = async (id) => {
    if (!window.confirm("Bu ödemeyi silmek istediğinden emin misin?")) return;
    await api.delete(`/payments/${id}`);
    onDelete?.();
  };

  if (loading && items.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-slate-200/60 dark:bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">Henüz ödeme kaydı yok</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((p) => {
        const isIncome = p.type === "income";
        return (
          <div key={p.id} className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-white text-base flex-shrink-0 shadow-md ${isIncome
              ? "bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-emerald-500/30"
              : "bg-gradient-to-br from-rose-400 to-rose-500 shadow-rose-500/30"}`}>
              {isIncome ? "↑" : "↓"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
                  {isIncome ? (p.contact?.name || "?") : "Şirket Masrafı"}
                </span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${isIncome ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/15 text-rose-700 dark:text-rose-300"}`}>
                  {isIncome ? "Gelir" : "Gider"}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                {p.bank_account && (
                  <span>🏦 {p.bank_account.bank_name} · {p.bank_account.iban.slice(-4)}</span>
                )}
                <span>📅 {formatTime(p.paid_at)}</span>
                {p.created_by && (
                  <span>👤 {p.created_by.full_name || p.created_by.username}</span>
                )}
              </div>
              {p.description && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{p.description}</div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className={`text-base font-bold ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"} font-mono`}>
                {isIncome ? "+" : "−"} {fmt(p.amount)}
              </div>
              <div className="flex items-center gap-1">
                {p.has_document && (
                  <button onClick={() => openDocument(p.id)}
                    title={p.document_filename}
                    className="text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 rounded-lg px-2 py-1 text-xs transition-colors">
                    📎 Dekont
                  </button>
                )}
                <button onClick={() => remove(p.id)}
                  className="text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg px-2 py-1 text-xs transition-colors">Sil</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
