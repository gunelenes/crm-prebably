export function ConversationSkeleton({ count = 8 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3 rounded-xl">
          <div className="flex items-start gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-200/80 dark:bg-white/5 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 bg-slate-200/80 dark:bg-white/5 rounded animate-pulse w-2/3" />
              <div className="h-3 bg-slate-100/80 dark:bg-white/[0.03] rounded animate-pulse w-full" />
              <div className="h-3 bg-slate-100/80 dark:bg-white/[0.03] rounded animate-pulse w-12" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export function MessageSkeleton({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const isRight = i % 2 === 1;
        const widthPct = 35 + ((i * 13) % 35);
        return (
          <div key={i} className={`flex ${isRight ? "justify-end" : "justify-start"}`}>
            <div
              className={`h-10 rounded-2xl animate-pulse ${isRight
                ? "bg-gradient-to-br from-indigo-200 to-violet-200 dark:from-indigo-500/20 dark:to-violet-500/20"
                : "bg-slate-200/80 dark:bg-white/5"}`}
              style={{ width: `${widthPct}%` }}
            />
          </div>
        );
      })}
    </>
  );
}
