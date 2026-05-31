import { fmtCurrency, fmtNum, PURPOSE_LABELS } from "./format";

const PURPOSE_BADGE = {
  wix_kayit: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  ig_dm: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  wa_dm: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  genel: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
};

function AccountCard({ acc }) {
  const cur = acc.currency || "TRY";
  const isDm = acc.purpose === "ig_dm" || acc.purpose === "wa_dm";
  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{acc.name}</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate font-mono">{acc.account_act_id}</div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${PURPOSE_BADGE[acc.purpose] || PURPOSE_BADGE.genel}`}>
          {PURPOSE_LABELS[acc.purpose] || acc.purpose}
        </span>
      </div>

      {/* Vurgulu metrik */}
      {isDm ? (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Konuşma Başı Maliyet</div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {acc.cost_per_conversation != null ? fmtCurrency(acc.cost_per_conversation, cur) : "—"}
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Toplam Harcama</div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">{fmtCurrency(acc.spend, cur)}</div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        {isDm ? (
          <Stat label="Harcama" value={fmtCurrency(acc.spend, cur)} />
        ) : (
          <Stat label="Tıklama" value={fmtNum(acc.clicks)} />
        )}
        <Stat label={isDm ? "Konuşma" : "Gösterim"} value={fmtNum(isDm ? acc.results : acc.impressions)} />
        <Stat label="Erişim" value={fmtNum(acc.reach)} />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-100/60 dark:bg-white/5 py-2 px-1">
      <div className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</div>
      <div className="text-sm font-semibold font-mono text-slate-700 dark:text-slate-200 truncate">{value}</div>
    </div>
  );
}

export default function AdAccountCards({ byAccount }) {
  const rows = byAccount || [];
  if (!rows.length) return null;
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-2">
        Reklam Hesapları
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((acc) => <AccountCard key={acc.account_act_id} acc={acc} />)}
      </div>
    </div>
  );
}
