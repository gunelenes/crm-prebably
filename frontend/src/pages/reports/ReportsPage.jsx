import { useCallback, useEffect, useState } from "react";
import api from "../../api";
import TrendChart from "./TrendChart";
import { fmtCurrency, fmtNum, todayISO, daysAgoISO } from "../advertising/format";

const MSG_SERIES = [
  { key: "incoming", label: "Gelen Mesaj", color: "#6366f1" },
  { key: "outgoing", label: "Giden Mesaj", color: "#8b5cf6" },
  { key: "new_contacts", label: "Yeni Kişi", color: "#10b981" },
];
const FIN_SERIES = [
  { key: "income", label: "Gelir", color: "#10b981" },
  { key: "total_expense", label: "Toplam Gider", color: "#f43f5e" },
  { key: "ad_spend", label: "Reklam Harcaması", color: "#f59e0b" },
  { key: "net", label: "Net", color: "#6366f1" },
];

export default function ReportsPage() {
  const [from, setFrom] = useState(daysAgoISO(29));
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/dashboard/timeseries", { params: { from, to } });
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const t = setTimeout(() => { fetchData(); }, 200);
    return () => clearTimeout(t);
  }, [fetchData]);

  const days = data?.days || [];
  const t = data?.totals || {};

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Grafikler</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Geçmişe dönük günlük mesaj, kişi ve finans trendleri (reklam harcaması dahil)</p>
        </div>

        {/* Tarih aralığı */}
        <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Tarih Aralığı</span>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={dateCls} />
          <span className="text-slate-400">→</span>
          <input type="date" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} className={dateCls} />
          <div className="flex gap-1 ml-auto">
            <Preset label="Son 7g" onClick={() => { setFrom(daysAgoISO(6)); setTo(todayISO()); }} />
            <Preset label="Son 30g" onClick={() => { setFrom(daysAgoISO(29)); setTo(todayISO()); }} />
            <Preset label="Son 90g" onClick={() => { setFrom(daysAgoISO(89)); setTo(todayISO()); }} />
            <Preset label="Son 1y" onClick={() => { setFrom(daysAgoISO(364)); setTo(todayISO()); }} />
          </div>
        </div>

        {/* Özet kartlar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="Yeni Kişi" value={fmtNum(t.new_contacts)} accent="text-emerald-500" icon="👤" />
          <Card label="Gelen Mesaj" value={fmtNum(t.incoming)} accent="text-indigo-500" icon="💬" />
          <Card label="Giden Mesaj" value={fmtNum(t.outgoing)} accent="text-violet-500" icon="✉️" />
          <Card label="Gelir" value={fmtCurrency(t.income)} accent="text-emerald-500" icon="💰" />
          <Card label="Reklam Harcaması" value={fmtCurrency(t.ad_spend)} accent="text-amber-500" icon="📣" />
          <Card label="Ödeme Gideri" value={fmtCurrency(t.payment_expense)} accent="text-rose-400" icon="💸" />
          <Card label="Toplam Gider" value={fmtCurrency(t.total_expense)} accent="text-rose-500" icon="🧾" />
          <Card label="Net" value={fmtCurrency(t.net)} accent={(t.net || 0) >= 0 ? "text-emerald-500" : "text-rose-500"} icon="📊" />
        </div>

        {/* Grafik 1: Mesaj & Kişi */}
        <ChartCard title="Mesaj & Kişi Trendi" loading={loading}>
          <TrendChart data={days} series={MSG_SERIES} formatValue={(v) => fmtNum(v)} />
        </ChartCard>

        {/* Grafik 2: Finansal */}
        <ChartCard title="Finansal Trend (Reklam Harcaması Dahil)" loading={loading}>
          <TrendChart data={days} series={FIN_SERIES} formatValue={(v) => fmtCurrency(v)} />
        </ChartCard>
      </div>
    </div>
  );
}

const dateCls =
  "rounded-xl px-3 py-1.5 text-sm bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-slate-800 dark:text-slate-100";

function Preset({ label, onClick }) {
  return (
    <button onClick={onClick}
      className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10 transition-colors">
      {label}
    </button>
  );
}

function Card({ icon, label, value, accent }) {
  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`text-lg ${accent}`}>{icon}</span>
      </div>
      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">{value}</div>
    </div>
  );
}

function ChartCard({ title, loading, children }) {
  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5">
      <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-3">{title}</h3>
      {loading ? <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">Yükleniyor…</div> : children}
    </div>
  );
}
