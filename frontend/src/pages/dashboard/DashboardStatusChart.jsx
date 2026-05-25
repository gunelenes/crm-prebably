export default function DashboardStatusChart({ items }) {
  const total = items.reduce((s, it) => s + (it.count || 0), 0);
  const max = items.reduce((m, it) => Math.max(m, it.count || 0), 0) || 1;

  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Statü Dağılımı</h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">{total} kişi</span>
      </div>

      {items.length === 0 ? (
        <div className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">Henüz statü yok</div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => {
            const pct = (s.count / max) * 100;
            return (
              <div key={s.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-sm text-slate-700 dark:text-slate-200">{s.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 font-mono">{s.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200/60 dark:bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(pct, 4)}%`,
                      background: `linear-gradient(90deg, ${s.color}, ${s.color}aa)`,
                      boxShadow: `0 0 12px ${s.color}40`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
