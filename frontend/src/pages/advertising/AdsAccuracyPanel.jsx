import { fmtNum, CHANNEL_META } from "./format";

// Fark hücresi: pozitif (CRM ≥ Meta) yeşil, negatif (Meta > CRM) amber/kırmızı.
function DiffBadge({ diff }) {
  if (diff == null) return <span className="text-slate-400">—</span>;
  if (diff >= 0)
    return <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{fmtNum(diff)}</span>;
  return <span className="text-amber-600 dark:text-amber-400 font-semibold">{fmtNum(diff)}</span>;
}

export default function AdsAccuracyPanel({ accuracy, loading }) {
  if (loading && !accuracy) {
    return <div className="h-40 rounded-2xl bg-slate-200/60 dark:bg-white/5 animate-pulse" />;
  }
  if (!accuracy) return null;

  const { total, rows = [] } = accuracy;
  const meta = total?.meta ?? 0;
  const crm = total?.crm ?? 0;
  const diff = total?.diff ?? crm - meta;
  const healthy = crm >= meta;
  const deviation = Math.round((Math.abs(meta - crm) / Math.max(meta, 1)) * 100);

  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-2">
        Doğruluk Kontrolü — Meta vs CRM
      </h3>
      <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          🔍 Meta'nın bildirdiği reklam konuşmaları, CRM'de gerçekten açılan konuşmalarla karşılaştırılır.
        </p>

        {/* Toplam karşılaştırma */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Meta (bildirilen)</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{fmtNum(meta)}</div>
          </div>
          <div className="rounded-xl bg-white/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">CRM (gerçek)</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{fmtNum(crm)}</div>
          </div>
          <div className="rounded-xl bg-white/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Fark</div>
            <div className="text-2xl font-bold"><DiffBadge diff={diff} /></div>
          </div>
        </div>

        {/* Durum rozeti */}
        <div className={`text-xs rounded-xl px-3 py-2 border ${healthy
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"}`}>
          {healthy
            ? `✅ Tüm reklam konuşmaları CRM'e düşmüş görünüyor (CRM ≥ Meta; fazlası organik trafik). Sapma ~%${deviation}.`
            : `⚠️ Meta ${fmtNum(meta)} konuşma bildiriyor ama CRM'de ${fmtNum(crm)} var (~%${deviation} eksik). Bu fark webhook kaybı, zamanlama ya da test mesajlarından olabilir — kontrol edin.`}
        </div>

        {/* Kanal kırılımı */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 text-left">
                <th className="py-2 pr-3 font-semibold">Kanal</th>
                <th className="py-2 px-3 font-semibold text-right">Meta</th>
                <th className="py-2 px-3 font-semibold text-right">CRM</th>
                <th className="py-2 pl-3 font-semibold text-right">Fark</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cm = CHANNEL_META[r.channel] || CHANNEL_META.other;
                return (
                  <tr key={r.channel} className="border-t border-slate-200/50 dark:border-white/5">
                    <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">
                      {cm.icon} {r.label}
                      {r.note && (
                        <span title={r.note} className="ml-1 cursor-help text-slate-400">ⓘ</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-200">{fmtNum(r.meta)}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-200">
                      {r.crm == null ? <span className="text-slate-400">—</span> : fmtNum(r.crm)}
                    </td>
                    <td className="py-2 pl-3 text-right font-mono"><DiffBadge diff={r.diff} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
          Hesap filtresinden bağımsızdır; tüm reklam hesaplarını ve tüm CRM konuşmalarını kapsar.
          CRM organik konuşmaları da içerdiği için CRM ≥ Meta normaldir. "Karma (IG/WA)" reklamları
          Meta tarafından IG/WA arasında ayrılamadığından CRM ile eşleştirilemez ama Meta toplamına dahildir.
          Zaman dilimi yaklaşıktır (UTC gün sınırı).
        </p>
      </div>
    </div>
  );
}
