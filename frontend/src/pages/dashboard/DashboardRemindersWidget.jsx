import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import { useAuth } from "../../AuthContext";
import { formatTime } from "../../utils";
import ReminderModal from "../../components/ReminderModal";

const TZ = "Europe/Istanbul";

const formatHHMM = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : "";

const formatDay = (iso) =>
  iso ? new Date(iso).toLocaleDateString("tr-TR", { timeZone: TZ, day: "2-digit", month: "long", year: "numeric" }) : "";

const dayKey = (iso) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

// Anasayfa widget'ı: aktif kullanıcının TAMAMLANMAMIŞ hatırlatmaları (gelecek + geçmişte
// kalan/geciken), tarih sırasına göre. Tamamlananlar gösterilmez (status=pending).
export default function DashboardRemindersWidget({ onChange }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // scope=all + status=pending → geçmiş (geciken) + bugün + gelecek, tamamlanmamış olanlar
      const res = await api.get("/reminders/search", {
        params: { advisor_user_id: user.id, status: "pending", scope: "all", sort_dir: "asc", limit: 500 },
      });
      setItems(res.data.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const markDone = async (r) => {
    await api.put(`/contacts/${r.contact_id}/reminders/${r.id}/done`);
    setItems((prev) => prev.filter((x) => x.id !== r.id)); // anında listeden çıkar
    onChange?.();
  };

  // İstanbul gününe göre grupla (liste zaten remind_at ASC sıralı geliyor)
  const groups = items.reduce((acc, r) => {
    const day = dayKey(r.remind_at);
    (acc[day] = acc[day] || []).push(r);
    return acc;
  }, {});
  const groupKeys = Object.keys(groups);

  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          📋 Aktivitelerim
          {items.length > 0 && (
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">({items.length})</span>
          )}
        </h3>
        <Link to="/hatirlatmalar" className="text-[11px] text-indigo-600 dark:text-indigo-300 hover:underline">Tümünü gör →</Link>
      </div>

      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-200/60 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-slate-400 dark:text-slate-500 py-10 text-sm">🎉 Bekleyen aktiviten yok</div>
      ) : (
        <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
          {groupKeys.map((day) => (
            <div key={day}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2">
                {formatDay(groups[day][0].remind_at)}
              </div>
              <div className="space-y-2">
                {groups[day].map((r) => {
                  const overdue = new Date(r.remind_at) < new Date();
                  return (
                    <div key={r.id}
                      className={`rounded-xl border p-3 transition-all ${overdue
                        ? "bg-rose-500/5 border-rose-500/30"
                        : "bg-white/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-white/10"}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 text-center min-w-[48px]">
                          <div className={`text-sm font-bold font-mono ${overdue ? "text-rose-600 dark:text-rose-400" : "text-indigo-600 dark:text-indigo-300"}`}>
                            {formatHHMM(r.remind_at)}
                          </div>
                          {overdue && <div className="text-[9px] uppercase tracking-wider text-rose-500 font-semibold mt-0.5">Gecikti</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.title}</div>
                          {r.description && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap line-clamp-2">{r.description}</div>
                          )}
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-3 flex-wrap">
                            {r.contact_id && r.contact_name && (
                              <Link to={`/kisiler?id=${r.contact_id}`} className="text-indigo-600 dark:text-indigo-300 hover:underline">
                                👤 {r.contact_name}
                              </Link>
                            )}
                            <span>📅 {formatTime(r.remind_at)}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
                          <button onClick={() => markDone(r)} title="Tamamla"
                            className="text-xs px-2.5 py-1 rounded-lg text-white bg-gradient-to-br from-emerald-400 to-emerald-500 shadow shadow-emerald-500/30 hover:from-emerald-500 hover:to-emerald-600">
                            ✓ Tamamla
                          </button>
                          <button onClick={() => setEditing(r)} title="Düzenle"
                            className="text-[11px] px-2 py-0.5 rounded-lg text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 transition-colors">
                            ✏️ Düzenle
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ReminderModal
          editingReminder={editing}
          onClose={() => setEditing(null)}
          onSave={() => { setEditing(null); load(); onChange?.(); }}
        />
      )}
    </div>
  );
}
