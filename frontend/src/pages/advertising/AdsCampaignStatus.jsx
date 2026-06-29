// Kampanya durum tablosu (saf görünüm). Filtreleme/başlık üst sayfada (CampaignStatusPage).
import { CAMPAIGN_STATE_META } from "./format";

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
  } catch {
    return iso;
  }
}

export default function AdsCampaignStatus({ items, emptyText = "Kampanya durumu verisi yok." }) {
  if (!items?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300/70 dark:border-white/10 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-white/10">
            <th className="font-semibold px-3 py-2.5 text-left">Kampanya</th>
            <th className="font-semibold px-3 py-2.5 text-left">Hesap</th>
            <th className="font-semibold px-3 py-2.5 text-left">Durum</th>
            <th className="font-semibold px-3 py-2.5 text-left">Neden</th>
            <th className="font-semibold px-3 py-2.5 text-right" title="Bu kampanyanın kaydedilmiş son harcama günü">Son Harcama</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const meta = CAMPAIGN_STATE_META[c.state] || CAMPAIGN_STATE_META.diger;
            return (
              <tr key={`${c.account_act_id}:${c.campaign_id}`}
                className="border-b border-slate-100/60 dark:border-white/5 last:border-0 hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                <td className="px-3 py-2 max-w-[260px]">
                  <div className="truncate text-slate-700 dark:text-slate-200 font-medium">{c.campaign_name}</div>
                  {c.objective && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{c.objective}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400 truncate max-w-[160px]">{c.account_name}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    {c.state_label}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-[320px]">
                  <span className="line-clamp-2">{c.state === "aktif" ? "—" : (c.reason || "—")}</span>
                </td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {fmtDate(c.last_spend_date)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
