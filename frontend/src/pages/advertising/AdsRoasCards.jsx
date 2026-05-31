import { fmtCurrency, fmtNum } from "./format";

function KpiCard({ icon, label, value, accent, sub }) {
  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`text-lg ${accent}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AdsRoasCards({ overall }) {
  const o = overall || {};
  const cur = o.multi_currency ? "TRY" : (o.by_currency?.[0]?.currency || "TRY");
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
        Getiri (ROAS)
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon="💰" label="Gelir" value={fmtCurrency(o.revenue, cur)} accent="text-emerald-500" />
        <KpiCard icon="📈" label="ROAS" value={o.roas != null ? `${o.roas.toFixed(2)}x` : "—"} accent="text-green-500" />
        <KpiCard icon="🧾" label="Ödeyen Müşteri" value={fmtNum(o.paying_customers)} accent="text-indigo-500"
          sub={o.matched_registrations != null ? `${fmtNum(o.matched_registrations)} kayıttan` : null} />
        <KpiCard icon="🔁" label="Dönüşüm" value={o.conversion_rate != null ? `${(o.conversion_rate * 100).toFixed(0)}%` : "—"} accent="text-violet-500" />
        <KpiCard icon="🤝" label="Ort. Anlaşma" value={o.avg_deal != null ? fmtCurrency(o.avg_deal, cur) : "—"} accent="text-amber-500" />
      </div>
      {o.roas_note && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1">ℹ️ {o.roas_note}</p>
      )}
    </div>
  );
}
