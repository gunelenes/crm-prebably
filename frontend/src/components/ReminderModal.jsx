import { useState } from "react";
import api from "../api";
import Spinner from "./Spinner";

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-gray-800 text-lg mb-4">🔔 Hatırlatma Oluştur</h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlık"
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Not..." rows={2}
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 resize-none focus:outline-none focus:border-blue-400" />
        <input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400" />
        <input value={advisor} onChange={(e) => setAdvisor(e.target.value)} placeholder="Danışman adı (boş bırakılırsa hesabınız)"
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-4 focus:outline-none focus:border-blue-400" />
        <div className="flex gap-2">
          <button onClick={save} disabled={!title.trim() || !remindAt || saving}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl py-2 text-sm font-medium">
            {saving ? <Spinner /> : "Kaydet"}
          </button>
          <button onClick={onClose} disabled={saving}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2 text-sm font-medium">İptal</button>
        </div>
      </div>
    </div>
  );
}
