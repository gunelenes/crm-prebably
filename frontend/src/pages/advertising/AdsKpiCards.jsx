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

export default function AdsKpiCards({ overall }) {
  const o = overall || {};
  const cur = o.multi_currency ? "TRY" : (o.by_currency?.[0]?.currency || "TRY");
  const cpConv = o.conversations ? (o.spend || 0) / o.conversations : null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard icon="💸" label="Toplam Harcama" value={fmtCurrency(o.spend, cur)} accent="text-rose-500"
        sub={o.multi_currency ? "⚠️ Çoklu para birimi" : null} />
      <KpiCard icon="💬" label="Konuşma (DM)" value={fmtNum(o.conversations)} accent="text-emerald-500" />
      <KpiCard icon="🖱️" label="Tıklama" value={fmtNum(o.clicks)} accent="text-indigo-500" />
      <KpiCard icon="🎯" label="Konuşma Başı Maliyet" value={cpConv != null ? fmtCurrency(cpConv, cur) : "—"} accent="text-amber-500" />
    </div>
  );
}
