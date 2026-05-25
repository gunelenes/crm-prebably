import { useState } from "react";
import api from "../../api";
import { formatTime } from "../../utils";
import ReminderModal from "../../components/ReminderModal";

const userLabel = (item) => {
  if (item.advisor_user) return item.advisor_user.full_name || item.advisor_user.username;
  if (item.created_by) return item.created_by.full_name || item.created_by.username;
  return null;
};

export default function ContactRemindersTab({ reminders, contactId, onOpenNew, onChanged }) {
  const [editing, setEditing] = useState(null);

  const markDone = async (id) => {
    await api.put(`/contacts/${contactId}/reminders/${id}/done`);
    onChanged?.();
  };

  const remove = async (r) => {
    if (!window.confirm(`"${r.title}" hatırlatmasını silmek istediğinden emin misin?`)) return;
    await api.delete(`/contacts/${contactId}/reminders/${r.id}`);
    onChanged?.();
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Hatırlatmalar</h3>
          <button onClick={onOpenNew}
            className="text-xs px-4 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-300 border border-orange-500/30">
            + Yeni Hatırlatma
          </button>
        </div>
        {reminders.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">Henüz hatırlatma yok</div>
        ) : (
          <div className="space-y-2">
            {reminders.map((r) => (
              <div key={r.id} className={`rounded-2xl backdrop-blur-xl border shadow-sm p-4 transition-all hover:-translate-y-0.5 ${r.is_done
                ? "bg-slate-100/40 dark:bg-white/5 border-slate-200/60 dark:border-white/10 opacity-60"
                : "bg-orange-500/5 border-orange-500/30"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{r.title}</div>
                    {r.description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{r.description}</div>}
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-3">
                      <span>📅 {formatTime(r.remind_at)}</span>
                      {userLabel(r) && <span>👤 {userLabel(r)}</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    {!r.is_done && (
                      <button onClick={() => markDone(r.id)}
                        className="text-xs px-3 py-1.5 rounded-xl text-white bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-md shadow-emerald-500/30 hover:from-emerald-500 hover:to-emerald-600">
                        ✓ Tamamla
                      </button>
                    )}
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(r)}
                        className="text-[11px] px-2 py-1 rounded-lg text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 transition-colors">
                        ✏️ Düzenle
                      </button>
                      <button onClick={() => remove(r)}
                        className="text-[11px] px-2 py-1 rounded-lg text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 transition-colors">
                        🗑 Sil
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <ReminderModal
          contactId={contactId}
          editingReminder={editing}
          onClose={() => setEditing(null)}
          onSave={() => { onChanged?.(); setEditing(null); }}
        />
      )}
    </div>
  );
}
