import { useEffect, useState } from "react";
import api from "../api";
import Spinner from "./Spinner";
import UserSelect from "./UserSelect";
import { useAuth } from "../AuthContext";

const inputCls =
  "w-full rounded-xl px-4 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/60 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

const TZ = "Europe/Istanbul";

// UTC ISO → datetime-local için İstanbul duvar-saati "YYYY-MM-DDTHH:mm" (tarayıcı-bağımsız).
const toDatetimeLocal = (iso) => {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
};

export default function ReminderModal({ contactId, editingReminder = null, onClose, onSave }) {
  const isEdit = !!editingReminder;
  const targetContactId = contactId || editingReminder?.contact_id;

  const [title, setTitle] = useState(editingReminder?.title || "");
  const [description, setDescription] = useState(editingReminder?.description || "");
  const { user } = useAuth();
  const [remindAt, setRemindAt] = useState(toDatetimeLocal(editingReminder?.remind_at));
  // Yeni kayıtta varsayılan danışman = o anki kullanıcı; düzenlemede mevcut danışman korunur.
  const [advisorUserId, setAdvisorUserId] = useState(
    editingReminder ? (editingReminder.advisor_user?.id || null) : (user?.id ?? null)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingReminder) {
      setTitle(editingReminder.title || "");
      setDescription(editingReminder.description || "");
      setRemindAt(toDatetimeLocal(editingReminder.remind_at));
      setAdvisorUserId(editingReminder.advisor_user?.id || null);
    } else {
      // Yeni kayıt: kullanıcı geç yüklenirse boş alanı o anki kullanıcıyla doldur
      setAdvisorUserId((prev) => prev ?? (user?.id ?? null));
    }
  }, [editingReminder?.id, user?.id]);

  const save = async () => {
    if (!title.trim() || !remindAt || !targetContactId) return;
    setSaving(true);
    try {
      const body = {
        title, description,
        // datetime-local değeri İstanbul duvar-saati kabul edilir → UTC ISO'ya çevrilir
        remind_at: new Date(remindAt + ":00+03:00").toISOString(),
        advisor_user_id: advisorUserId,
      };
      if (isEdit) {
        await api.put(`/contacts/${targetContactId}/reminders/${editingReminder.id}`, body);
      } else {
        await api.post(`/contacts/${targetContactId}/reminders`, body);
      }
      onSave?.();
      onClose?.();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="rounded-3xl p-7 w-full max-w-md bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl shadow-indigo-500/20">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-5 flex items-center gap-2">
          <span>🔔</span> {isEdit ? "Hatırlatmayı Düzenle" : "Hatırlatma Oluştur"}
        </h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlık"
          className={`${inputCls} mb-3`} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Not..." rows={2}
          className={`${inputCls} resize-none mb-3`} />
        <input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)}
          className={`${inputCls} mb-3`} />
        <div className="mb-5">
          <UserSelect value={advisorUserId} onChange={setAdvisorUserId} placeholder="Danışman (varsayılan: siz)" />
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={!title.trim() || !remindAt || saving}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all
              bg-gradient-to-r from-indigo-500 to-violet-500
              hover:from-indigo-600 hover:to-violet-600
              shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
              disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700">
            {saving ? <Spinner /> : (isEdit ? "Güncelle" : "Kaydet")}
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
