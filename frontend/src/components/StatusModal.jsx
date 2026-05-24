import { useState } from "react";
import api from "../api";
import Spinner from "./Spinner";

export default function StatusModal({ contact, statuses, onClose, onSave }) {
  const [selectedStatus, setSelectedStatus] = useState(contact?.status_id || "");
  const [note, setNote] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!contact?.id) return;
    setSaving(true);
    try {
      await api.put(`/contacts/${contact.id}/status`, {
        status_id: selectedStatus || null, note, advisor,
      });
      onSave();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-gray-800 text-lg mb-4">🏷️ Statü Değiştir</h3>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {statuses.filter((s) => s.is_active).map((s) => (
            <button key={s.id} onClick={() => setSelectedStatus(s.id)}
              className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${selectedStatus === s.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
              <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Açıklama..." rows={2}
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 resize-none focus:outline-none focus:border-blue-400" />
        <input value={advisor} onChange={(e) => setAdvisor(e.target.value)} placeholder="Danışman adı (boş bırakılırsa hesabınız)"
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-4 focus:outline-none focus:border-blue-400" />
        <div className="flex gap-2">
          <button onClick={save} disabled={saving}
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
