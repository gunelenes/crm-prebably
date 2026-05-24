import { useState } from "react";
import api from "../api";
import Spinner from "./Spinner";

const inputCls =
  "w-full rounded-xl px-4 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/60 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

export default function ReminderModal({ contactId, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !remindAt) return;
    setSaving(true);
    try {
      await api.post(`/contacts/${contactId}/reminders`, {
        title, description, remind_at: remindAt, advisor,
      });
      onSave();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="rounded-3xl p-7 w-full max-w-md bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl shadow-indigo-500/20">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-5 flex items-center gap-2">
          <span>🔔</span> Hatırlatma Oluştur
        </h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlık"
          className={`${inputCls} mb-3`} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Not..." rows={2}
          className={`${inputCls} resize-none mb-3`} />
        <input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)}
          className={`${inputCls} mb-3`} />
        <input value={advisor} onChange={(e) => setAdvisor(e.target.value)} placeholder="Danışman adı (boş bırakılırsa hesabınız)"
          className={`${inputCls} mb-5`} />
        <div className="flex gap-2">
          <button onClick={save} disabled={!title.trim() || !remindAt || saving}
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
