import api from "../../api";
import { formatTime } from "../../utils";
import AuthImage from "../../components/AuthImage";
import { priorityMeta } from "./constants";

export default function IssueList({ items, loading, onChange, onEdit }) {
  const toggleStatus = async (b) => {
    const next = b.status === "cozuldu" ? "acik" : "cozuldu";
    await api.put(`/bugs/${b.id}`, { status: next });
    onChange?.();
  };

  const remove = async (id) => {
    if (!window.confirm("Bu kaydı (ve ekran görüntülerini) silmek istediğine emin misin?")) return;
    await api.delete(`/bugs/${id}`);
    onChange?.();
  };

  if (loading && items.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-200/60 dark:bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">Henüz kayıt yok 🎉</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((b) => {
        const done = b.status === "cozuldu";
        const pr = priorityMeta(b.priority);
        return (
          <div key={b.id}
            className={`rounded-2xl backdrop-blur-xl border shadow-sm p-4 transition-all hover:shadow-md ${done
              ? "bg-emerald-500/5 border-emerald-500/20"
              : "bg-white/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-white/10"}`}>
            <div className="flex items-start gap-3">
              {/* Tamamla/aç tıklaması */}
              <button onClick={() => toggleStatus(b)} title={done ? "Açık olarak işaretle" : "Çözüldü olarak işaretle"}
                className={`mt-0.5 h-6 w-6 flex-shrink-0 rounded-md border-2 flex items-center justify-center text-sm transition-all ${done
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-slate-300 dark:border-white/20 hover:border-emerald-500"}`}>
                {done && "✓"}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold text-sm ${done ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-100"}`}>
                    {b.title}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${pr.chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${pr.dot}`} /> {pr.label}
                  </span>
                  {b.page && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                      📍 {b.page}
                    </span>
                  )}
                  {done ? (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Çözüldü</span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">Açık</span>
                  )}
                </div>

                {b.description && (
                  <div className={`text-xs mt-1 whitespace-pre-wrap ${done ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-300"}`}>
                    {b.description}
                  </div>
                )}

                {/* Ekran görüntüleri */}
                {b.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {b.attachments.map((a) => (
                      <AuthImage key={a.id} src={`/bugs/${b.id}/attachments/${a.id}`}
                        className="h-16 w-16 object-cover rounded-lg border border-slate-200/60 dark:border-white/10" />
                    ))}
                  </div>
                )}

                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 flex flex-wrap items-center gap-2">
                  <span>🕒 {formatTime(b.created_at)}</span>
                  {b.created_by && <span>👤 {b.created_by.full_name || b.created_by.username}</span>}
                  {done && b.resolved_by && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓ {b.resolved_by.full_name || b.resolved_by.username} · {formatTime(b.resolved_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* Aksiyonlar */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <button onClick={() => onEdit?.(b)}
                  className="text-slate-500 dark:text-slate-400 hover:bg-slate-500/10 rounded-lg px-2 py-1 text-xs transition-colors">Düzenle</button>
                <button onClick={() => remove(b.id)}
                  className="text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg px-2 py-1 text-xs transition-colors">Sil</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
