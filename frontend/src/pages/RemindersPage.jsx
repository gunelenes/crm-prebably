import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { formatTime } from "../utils";
import UserSelect from "../components/UserSelect";
import ReminderModal from "../components/ReminderModal";

const inputCls =
  "rounded-xl px-3 py-1.5 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${active
        ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30"
        : "bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10"}`}>
      {children}
    </button>
  );
}

const formatHHMM = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
};

const formatDay = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
};

export default function RemindersPage() {
  const [scope, setScope] = useState("today");     // 'today' | 'upcoming' | 'overdue' | 'all'
  const [status, setStatus] = useState("pending"); // 'pending' | 'done' | 'all'
  const [advisorUserId, setAdvisorUserId] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const debounceRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { scope, status, sort_dir: "asc", limit: 500 };
      if (advisorUserId) params.advisor_user_id = advisorUserId;
      const res = await api.get("/reminders/search", { params });
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [scope, status, advisorUserId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 200);
    return () => clearTimeout(debounceRef.current);
  }, [load]);

  const markDone = async (r) => {
    await api.put(`/contacts/${r.contact_id}/reminders/${r.id}/done`);
    load();
  };

  const removeReminder = async (r) => {
    if (!window.confirm(`"${r.title}" hatırlatmasını silmek istediğinden emin misin?`)) return;
    await api.delete(`/contacts/${r.contact_id}/reminders/${r.id}`);
    load();
  };

  // Tarihe göre grupla
  const groups = items.reduce((acc, r) => {
    const day = new Date(r.remind_at).toDateString();
    if (!acc[day]) acc[day] = [];
    acc[day].push(r);
    return acc;
  }, {});
  const groupKeys = Object.keys(groups);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Hatırlatmalar</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{total} kayıt</p>
          </div>
        </div>

        {/* Filtreler */}
        <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mr-1">Kapsam:</span>
            <Pill active={scope === "today"} onClick={() => setScope("today")}>📅 Bugün</Pill>
            <Pill active={scope === "upcoming"} onClick={() => setScope("upcoming")}>⏭ Yaklaşan</Pill>
            <Pill active={scope === "overdue"} onClick={() => setScope("overdue")}>⚠️ Geciken</Pill>
            <Pill active={scope === "all"} onClick={() => setScope("all")}>Tümü</Pill>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mr-1">Durum:</span>
            <Pill active={status === "pending"} onClick={() => setStatus("pending")}>Bekleyen</Pill>
            <Pill active={status === "done"} onClick={() => setStatus("done")}>Tamamlanan</Pill>
            <Pill active={status === "all"} onClick={() => setStatus("all")}>Hepsi</Pill>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">Danışman</div>
              <UserSelect value={advisorUserId} onChange={setAdvisorUserId} placeholder="Tüm danışmanlar" />
            </div>
            <div className="flex items-end justify-end">
              <button onClick={() => { setScope("today"); setStatus("pending"); setAdvisorUserId(null); }}
                className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline">
                Filtreleri sıfırla
              </button>
            </div>
          </div>
        </div>

        {/* Liste */}
        {loading && items.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-slate-200/60 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-slate-500 py-16 text-sm">
            🎉 Bu filtreyle hiç hatırlatma yok
          </div>
        ) : (
          <div className="space-y-6">
            {groupKeys.map((day) => (
              <div key={day}>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2 sticky top-0 z-10 bg-gradient-to-r from-slate-50/95 via-white/95 to-slate-50/95 dark:from-slate-900/95 dark:via-slate-900/95 dark:to-slate-900/95 backdrop-blur py-1">
                  {formatDay(groups[day][0].remind_at)}
                </div>
                <div className="space-y-2">
                  {groups[day].map((r) => {
                    const overdue = !r.is_done && new Date(r.remind_at) < new Date();
                    return (
                      <div key={r.id} className={`rounded-2xl backdrop-blur-xl border shadow-sm p-4 transition-all hover:-translate-y-0.5 ${r.is_done
                        ? "bg-slate-100/40 dark:bg-white/5 border-slate-200/60 dark:border-white/10 opacity-60"
                        : overdue
                        ? "bg-rose-500/5 border-rose-500/30"
                        : "bg-white/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-white/10"}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 text-center min-w-[55px]">
                            <div className={`text-base font-bold font-mono ${r.is_done ? "text-slate-400" : overdue ? "text-rose-600 dark:text-rose-400" : "text-indigo-600 dark:text-indigo-300"}`}>
                              {formatHHMM(r.remind_at)}
                            </div>
                            {overdue && <div className="text-[9px] uppercase tracking-wider text-rose-500 font-semibold mt-0.5">Gecikti</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-semibold ${r.is_done ? "line-through text-slate-500" : "text-slate-800 dark:text-slate-100"}`}>
                              {r.title}
                            </div>
                            {r.description && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">{r.description}</div>
                            )}
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-3 flex-wrap">
                              {r.contact_id && r.contact_name && (
                                <Link to={`/kisiler?id=${r.contact_id}`}
                                  className="text-indigo-600 dark:text-indigo-300 hover:underline">
                                  👤 {r.contact_name}
                                </Link>
                              )}
                              {r.advisor_user && (
                                <span>🧑 {r.advisor_user.full_name || r.advisor_user.username}</span>
                              )}
                              <span>📅 {formatTime(r.remind_at)}</span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex flex-col items-end gap-1">
                            {!r.is_done && (
                              <button onClick={() => markDone(r)}
                                title="Tamamla"
                                className="text-xs px-3 py-1.5 rounded-xl text-white bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-md shadow-emerald-500/30 hover:from-emerald-500 hover:to-emerald-600">
                                ✓ Tamamla
                              </button>
                            )}
                            <div className="flex gap-1">
                              <button onClick={() => setEditing(r)}
                                title="Düzenle"
                                className="text-[11px] px-2 py-1 rounded-lg text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 transition-colors">
                                ✏️ Düzenle
                              </button>
                              <button onClick={() => removeReminder(r)}
                                title="Sil"
                                className="text-[11px] px-2 py-1 rounded-lg text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 transition-colors">
                                🗑 Sil
                              </button>
                            </div>
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
      </div>

      {editing && (
        <ReminderModal
          editingReminder={editing}
          onClose={() => setEditing(null)}
          onSave={load}
        />
      )}
    </div>
  );
}
