import { formatTime, platformLabel, groupByPlatform } from "../../utils";

const icon = (type) => {
  if (type === "first_message") return "💬";
  if (type === "status_change") return "🏷️";
  if (type === "reminder") return "🔔";
  if (type === "note") return "📝";
  return "📌";
};

const userLabel = (item) => {
  if (item.advisor_user) return item.advisor_user.full_name || item.advisor_user.username;
  if (item.created_by) return item.created_by.full_name || item.created_by.username;
  return null;
};

function ActivityCard({ a }) {
  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 flex gap-3 transition-all hover:-translate-y-0.5">
      <div className="text-xl flex-shrink-0">{icon(a.type)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.title}</div>
        {a.description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">{a.description}</div>}
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-3">
          {userLabel(a) && <span>👤 {userLabel(a)}</span>}
          <span>{formatTime(a.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

export default function ContactActivityTab({ items }) {
  const { multi, groups } = groupByPlatform(items);
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-4">Aktivite Geçmişi</h3>
        {items.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">Henüz aktivite yok</div>
        ) : multi ? (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.platform} className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1">{platformLabel(g.platform)}</div>
                {g.items.map((a) => <ActivityCard key={a.id} a={a} />)}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((a) => <ActivityCard key={a.id} a={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}
