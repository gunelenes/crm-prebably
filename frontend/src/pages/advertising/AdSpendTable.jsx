import { fmtCurrency, fmtNum, CHANNEL_META } from "./format";

export default function AdSpendTable({ rows, loading }) {
  if (loading) {
    return <div className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Yükleniyor…</div>;
  }
  if (!rows?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300/70 dark:border-white/10 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
        Bu tarih aralığında harcama kaydı yok. Meta verisini çekmek için “Senkronize Et”e basın.
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-white/10">
            <th className="text-left font-semibold px-3 py-2.5">Tarih</th>
            <th className="text-left font-semibold px-3 py-2.5">Hesap</th>
            <th className="text-left font-semibold px-3 py-2.5">Kampanya / Ad Set</th>
            <th className="text-left font-semibold px-3 py-2.5">Kanal</th>
            <th className="text-right font-semibold px-3 py-2.5">Harcama</th>
            <th className="text-right font-semibold px-3 py-2.5" title="Kampanya amacına göre konuşma (DM) ya da tıklama">Sonuç</th>
            <th className="text-right font-semibold px-3 py-2.5">Sonuç Başına</th>
            <th className="text-right font-semibold px-3 py-2.5">Tıklama</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ch = CHANNEL_META[r.channel] || CHANNEL_META.other;
            return (
              <tr key={r.id} className="border-b border-slate-100/60 dark:border-white/5 last:border-0 hover:bg-slate-50/60 dark:hover:bg-white/5">
                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-slate-500 dark:text-slate-400">{r.date}</td>
                <td className="px-3 py-2 max-w-[160px] truncate text-slate-700 dark:text-slate-200">{r.account_name}</td>
                <td className="px-3 py-2 max-w-[240px]">
                  <div className="truncate text-slate-700 dark:text-slate-200 font-medium">{r.campaign_name || "—"}</div>
                  {r.adset_name ? <div className="truncate text-[11px] text-slate-400 dark:text-slate-500">{r.adset_name}</div> : null}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{ch.icon} {ch.label}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-slate-800 dark:text-slate-100">{fmtCurrency(r.spend, r.currency)}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-slate-700 dark:text-slate-200">{fmtNum(r.results)}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-slate-700 dark:text-slate-200">{r.results ? fmtCurrency(r.spend / r.results, r.currency) : "—"}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-slate-500 dark:text-slate-400">{fmtNum(r.clicks)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
