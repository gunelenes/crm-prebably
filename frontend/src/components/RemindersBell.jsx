import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { formatTime } from "../utils";

const formatHHMM = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
};

export default function RemindersBell({ expanded = true }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/reminders/today");
      setItems(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Hatırlatma sayısı için periyodik çekim (Sidebar'da rozet için)
  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const remaining = items.filter((r) => !r.is_done);

  const markDone = async (r) => {
    await api.put(`/contacts/${r.contact_id}/reminders/${r.id}/done`);
    load();
  };

  const goContact = (r) => {
    setOpen(false);
    navigate(`/kisiler?id=${r.contact_id}`);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        title="Bugünün hatırlatmaları"
        className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium
          bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
          border border-slate-200/60 dark:border-white/10
          text-slate-700 dark:text-slate-200 backdrop-blur transition-all relative
          ${expanded ? "w-full justify-between" : "justify-center w-full"}`}
      >
        <span className="text-base leading-none">🔔</span>
        {expanded && <span className="flex-1 text-left">Hatırlatmalar</span>}
        {remaining.length > 0 && (
          <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 text-white bg-gradient-to-r from-rose-500 to-orange-500 shadow-md shadow-rose-500/40 min-w-[20px] text-center">
            {remaining.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full ml-2 bottom-0 w-80 z-50 max-h-[80vh] overflow-hidden rounded-2xl
          bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl
          border border-slate-200/60 dark:border-white/10
          shadow-2xl shadow-indigo-500/20 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200/60 dark:border-white/10">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bugünün Hatırlatmaları</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {items.length === 0
                ? "Bugün için hatırlatma yok"
                : `${remaining.length} bekliyor · ${items.length - remaining.length} tamamlandı`}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">Yükleniyor...</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">🎉 Bugün için hatırlatma yok</div>
            ) : (
              <ul className="divide-y divide-slate-200/60 dark:divide-white/10">
                {items.map((r) => (
                  <li key={r.id} className={`px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${r.is_done ? "opacity-50" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 text-center">
                        <div className={`text-xs font-bold font-mono ${r.is_done ? "text-slate-400" : "text-indigo-600 dark:text-indigo-300"}`}>
                          {formatHHMM(r.remind_at)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${r.is_done ? "line-through text-slate-500" : "text-slate-800 dark:text-slate-100"} truncate`}>
                          {r.title}
                        </div>
                        {r.contact_name && (
                          <button onClick={() => goContact(r)}
                            className="text-[11px] text-indigo-600 dark:text-indigo-300 hover:underline mt-0.5 truncate max-w-full block text-left">
                            👤 {r.contact_name}
                          </button>
                        )}
                        {r.description && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{r.description}</div>
                        )}
                        {r.advisor_user && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            🧑 {r.advisor_user.full_name || r.advisor_user.username}
                          </div>
                        )}
                      </div>
                      {!r.is_done && (
                        <button onClick={() => markDone(r)}
                          title="Tamamla"
                          className="flex-shrink-0 text-xs px-2 py-1 rounded-lg text-white bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-md shadow-emerald-500/30">
                          ✓
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
