import { useState } from "react";
import api from "../api";
import Spinner from "./Spinner";
import UserSelect from "./UserSelect";

const inputCls =
  "w-full rounded-xl px-4 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/60 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

export default function StatusModal({ contact, statuses, onClose, onSave }) {
  const [selectedStatus, setSelectedStatus] = useState(contact?.status_id || "");
  const [note, setNote] = useState("");
  const [advisorUserId, setAdvisorUserId] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!contact?.id) return;
    setSaving(true);
    try {
      await api.put(`/contacts/${contact.id}/status`, {
        status_id: selectedStatus || null, note, advisor_user_id: advisorUserId,
      });
      onSave();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="rounded-3xl p-7 w-full max-w-md bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl shadow-indigo-500/20">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-5 flex items-center gap-2">
          <span>🏷️</span> Statü Değiştir
        </h3>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {statuses.filter((s) => s.is_active).map((s) => {
            const sel = selectedStatus === s.id;
            return (
              <button key={s.id} onClick={() => setSelectedStatus(s.id)}
                className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${sel
                  ? "border-transparent shadow-lg"
                  : "border-slate-200/60 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"}`}
                style={sel ? { backgroundColor: `${s.color}25`, boxShadow: `0 8px 18px ${s.color}40` } : undefined}>
                <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: s.color }} />
                <span className="text-slate-800 dark:text-slate-100">{s.name}</span>
              </button>
            );
          })}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Açıklama..." rows={2}
          className={`${inputCls} resize-none mb-3`} />
        <div className="mb-5">
          <UserSelect value={advisorUserId} onChange={setAdvisorUserId} placeholder="Danışman seç (boş bırakılırsa hesabınız)" />
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all
              bg-gradient-to-r from-indigo-500 to-violet-500
              hover:from-indigo-600 hover:to-violet-600
              shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
              disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700">
            {saving ? <Spinner /> : "Kaydet"}
          </button>
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors
              bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
              text-slate-700 dark:text-slate-200
              border border-slate-200/60 dark:border-white/10">İptal</button>
        </div>
      </div>
    </div>
  );
}
