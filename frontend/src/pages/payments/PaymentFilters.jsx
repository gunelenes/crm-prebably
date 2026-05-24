const inputCls =
  "rounded-xl px-3 py-1.5 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

function Pill({ active, onClick, children, variant = "default" }) {
  const activeCls = variant === "income"
    ? "bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-md shadow-emerald-500/30"
    : variant === "expense"
    ? "bg-gradient-to-r from-rose-400 to-rose-500 text-white shadow-md shadow-rose-500/30"
    : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30";
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${active ? activeCls : "bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10"}`}>
      {children}
    </button>
  );
}

export default function PaymentFilters({ filters, setFilters, bankAccounts }) {
  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill active={filters.type === null} onClick={() => setFilters((f) => ({ ...f, type: null }))}>Tümü</Pill>
        <Pill active={filters.type === "income"} variant="income" onClick={() => setFilters((f) => ({ ...f, type: "income" }))}>💰 Gelir</Pill>
        <Pill active={filters.type === "expense"} variant="expense" onClick={() => setFilters((f) => ({ ...f, type: "expense" }))}>💸 Gider</Pill>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <select value={filters.bankAccountId || ""} onChange={(e) => setFilters((f) => ({ ...f, bankAccountId: e.target.value ? Number(e.target.value) : null }))}
          className={inputCls}>
          <option value="">Tüm Bankalar</option>
          {bankAccounts.map((b) => (
            <option key={b.id} value={b.id}>{b.bank_name}</option>
          ))}
        </select>
        <input type="date" value={filters.dateFrom || ""} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          className={inputCls} placeholder="Başlangıç" />
        <input type="date" value={filters.dateTo || ""} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          className={inputCls} placeholder="Bitiş" />
        <input value={filters.q || ""} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder="Açıklama ara..." className={inputCls} />
      </div>
    </div>
  );
}
