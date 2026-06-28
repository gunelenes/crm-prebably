import { useState } from "react";
import { fmtCurrency, fmtNum, CHANNEL_META } from "./format";

const COLS = [
  { key: "campaign_name", label: "Kampanya", align: "left", sortable: false },
  { key: "spend", label: "Harcama", align: "right", sortable: true },
  { key: "contacts", label: "Gelen Kişi", align: "right", sortable: true, hint: "Bu kampanyadan gelen toplam kişi (reklam atfı)" },
  { key: "new_customers", label: "Yeni Müşteri", align: "right", sortable: true, hint: "İlk teması bu kampanya olan (reklamla kazanılan) kişi" },
  { key: "cost_per_new_customer", label: "Müşteri Başına Maliyet", align: "right", sortable: true, hint: "Harcama / yeni müşteri" },
  { key: "results", label: "Sonuç", align: "right", sortable: true, hint: "Kampanya amacına göre konuşma (DM) veya tıklama" },
  { key: "cost_per_result", label: "Sonuç Başına Maliyet", align: "right", sortable: true },
  { key: "clicks", label: "Tıklama", align: "right", sortable: true },
];

export default function AdsCampaignTable({ rows, selected, onSelect }) {
  const [sortBy, setSortBy] = useState("spend");
  const [dir, setDir] = useState("desc");

  if (!rows?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300/70 dark:border-white/10 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
        Bu aralıkta kampanya verisi yok.
      </div>
    );
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortBy] ?? -Infinity;
    const bv = b[sortBy] ?? -Infinity;
    return dir === "asc" ? av - bv : bv - av;
  });

  const toggleSort = (key) => {
    if (sortBy === key) setDir(dir === "asc" ? "desc" : "asc");
    else { setSortBy(key); setDir("desc"); }
  };

  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-white/10">
            {COLS.map((c) => (
              <th key={c.key} title={c.hint || undefined}
                onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                className={`font-semibold px-3 py-2.5 ${c.align === "right" ? "text-right" : "text-left"} ${c.sortable ? "cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200" : ""}`}>
                {c.label}{c.sortable && sortBy === c.key ? (dir === "asc" ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const ch = CHANNEL_META[r.channel] || CHANNEL_META.other;
            const isSel = selected === r.campaign_name;
            return (
              <tr key={r.campaign_name}
                onClick={() => onSelect?.(isSel ? "" : r.campaign_name)}
                className={`border-b border-slate-100/60 dark:border-white/5 last:border-0 cursor-pointer transition-colors ${
                  isSel ? "bg-indigo-500/10" : "hover:bg-slate-50/60 dark:hover:bg-white/5"}`}>
                <td className="px-3 py-2 max-w-[280px]">
                  <div className="truncate text-slate-700 dark:text-slate-200 font-medium">{r.campaign_name}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">{ch.icon} {ch.label}</div>
                </td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-slate-800 dark:text-slate-100">{fmtCurrency(r.spend, r.currency)}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-slate-700 dark:text-slate-200">{fmtNum(r.contacts)}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap font-medium text-emerald-700 dark:text-emerald-300">{fmtNum(r.new_customers)}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-slate-700 dark:text-slate-200">
                  {r.cost_per_new_customer != null ? fmtCurrency(r.cost_per_new_customer, r.currency) : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-slate-700 dark:text-slate-200">{fmtNum(r.results)}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-slate-700 dark:text-slate-200">
                  {r.cost_per_result != null ? fmtCurrency(r.cost_per_result, r.currency) : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-slate-500 dark:text-slate-400">{fmtNum(r.clicks)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
