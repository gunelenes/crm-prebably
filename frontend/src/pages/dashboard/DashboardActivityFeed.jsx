import { Link } from "react-router-dom";
import { formatTime } from "../../utils";

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

export default function DashboardActivityFeed({ items }) {
  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Son Aktiviteler</h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">Henüz aktivite yok</div>
      ) : (
        <div className="space-y-1">
          {items.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-2 rounded-xl hover:bg-white/60 dark:hover:bg-white/5 transition-colors">
              <div className="text-lg flex-shrink-0 leading-none mt-0.5">{icon(a.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-800 dark:text-slate-100 truncate">{a.title}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
                  {a.contact && (
                    <Link to={`/kisiler?id=${a.contact.id}`}
                      className="text-indigo-600 dark:text-indigo-300 hover:underline truncate max-w-[120px]">
                      {a.contact.name}
                    </Link>
                  )}
                  {userLabel(a) && <span>👤 {userLabel(a)}</span>}
                  <span>{formatTime(a.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
