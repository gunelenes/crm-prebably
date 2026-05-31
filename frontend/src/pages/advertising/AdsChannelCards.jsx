import { fmtCurrency, fmtNum, CHANNEL_META } from "./format";

function ChannelCard({ channel, spend, conversations, clicks, costPer }) {
  const meta = CHANNEL_META[channel] || CHANNEL_META.other;
  return (
    <div className={`rounded-2xl p-5 text-white shadow-xl ${meta.gradient} ${meta.shadow}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold opacity-95">{meta.icon} {meta.label}</span>
        <span className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">Harcama</span>
      </div>
      <div className="text-2xl font-bold">{fmtCurrency(spend)}</div>
      <div className="mt-3 flex items-center justify-between text-xs opacity-90">
        <div>
          <div className="opacity-80">Konuşma / Tıklama</div>
          <div className="font-semibold text-sm">{fmtNum(conversations)} / {fmtNum(clicks)}</div>
        </div>
        <div className="text-right">
          <div className="opacity-80">Konuşma Başı</div>
          <div className="font-semibold text-sm">{costPer != null ? fmtCurrency(costPer) : "—"}</div>
        </div>
      </div>
    </div>
  );
}

export default function AdsChannelCards({ byChannel }) {
  const rows = (byChannel || []).filter((c) => c.spend > 0 || c.conversations > 0 || c.clicks > 0);
  if (!rows.length) return null;
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-2">
        Kanal Bazında
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {rows.map((c) => (
          <ChannelCard key={c.channel} channel={c.channel} spend={c.spend}
            conversations={c.conversations} clicks={c.clicks} costPer={c.cost_per_conversation} />
        ))}
      </div>
    </div>
  );
}
