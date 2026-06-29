import { fmtNum } from "../advertising/format";

// Kampanya bazında gelen kişi yatay bar grafiği.
// Her satır: dış bar = toplam gelen kişi (contacts), içindeki yeşil dolgu = ilk kez gelen
// (new_customers, contacts'ın alt kümesi). El yapımı (charting kütüphanesi yok),
// DashboardStatusChart deseni iki metriğe genişletildi.
export default function CampaignArrivalsChart({ items }) {
  if (!items?.length) {
    return (
      <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
        Bu aralıkta reklamla gelen kişi yok.
      </div>
    );
  }
  const max = Math.max(...items.map((c) => c.contacts), 1);

  return (
    <div className="space-y-3">
      {items.map((c) => {
        const pct = (c.contacts / max) * 100;
        const ftPct = c.contacts ? (c.new_customers / c.contacts) * 100 : 0;
        return (
          <div key={c.campaign_name}>
            <div className="flex items-center justify-between mb-1 gap-3">
              <span className="text-sm text-slate-700 dark:text-slate-200 truncate min-w-0">{c.campaign_name}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono flex-shrink-0 whitespace-nowrap">
                {fmtNum(c.contacts)} kişi
                <span className="text-emerald-600 dark:text-emerald-400"> · {fmtNum(c.new_customers)} ilk kez</span>
              </span>
            </div>
            <div className="h-3 rounded-full bg-slate-200/60 dark:bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all relative"
                style={{ width: `${Math.max(pct, 4)}%`, background: "linear-gradient(90deg, #6366f1, #6366f1aa)" }}>
                {/* İlk kez gelenler (new_customers) — toplam barın içinde yeşil dilim */}
                <div className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${ftPct}%`, background: "linear-gradient(90deg, #10b981, #10b981cc)" }} />
              </div>
            </div>
          </div>
        );
      })}
      {/* Açıklama */}
      <div className="flex items-center gap-4 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#6366f1" }} />Toplam gelen kişi</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#10b981" }} />İlk kez bu reklamla gelen</span>
      </div>
    </div>
  );
}
