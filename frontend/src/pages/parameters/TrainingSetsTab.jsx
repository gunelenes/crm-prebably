import { useEffect, useState } from "react";
import api from "../../api";
import Spinner from "../../components/Spinner";

export default function TrainingSetsTab() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/training-sets").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/training-sets/${editing}`, { name, description });
      } else {
        await api.post("/training-sets", { name, description });
      }
      await load();
      setName(""); setDescription(""); setEditing(null);
    } finally { setSaving(false); }
  };

  const toggleActive = async (t) => {
    await api.put(`/training-sets/${t.id}`, { is_active: !t.is_active });
    await load();
  };

  const remove = async (id) => {
    if (!window.confirm("Bu eğitim setini silmek istediğinden emin misin?")) return;
    await api.delete(`/training-sets/${id}`);
    setItems((p) => p.filter((t) => t.id !== id));
  };

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Eğitim seti adı (örn. 21 Günlük Instagram)"
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Açıklama / video linki / notlar (opsiyonel)" rows={2}
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 resize-none focus:outline-none focus:border-blue-400" />
        <div className="flex gap-2">
          <button onClick={save} disabled={!name.trim() || saving}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl px-5 py-2 text-sm font-medium min-w-[80px]">
            {saving ? <Spinner /> : (editing ? "Güncelle" : "Ekle")}
          </button>
          {editing && <button onClick={() => { setEditing(null); setName(""); setDescription(""); }} disabled={saving}
            className="bg-gray-100 text-gray-700 rounded-xl px-5 py-2 text-sm font-medium">İptal</button>}
        </div>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">Henüz eğitim seti tanımlanmamış</div>
        ) : items.map((t) => (
          <div key={t.id} className={`bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4 ${!t.is_active ? "opacity-50" : ""}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-800 text-sm">{t.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {t.is_active ? "Aktif" : "Pasif"}
                </span>
              </div>
              {t.description && <div className="text-xs text-gray-500 whitespace-pre-wrap">{t.description}</div>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => { setEditing(t.id); setName(t.name); setDescription(t.description || ""); }}
                className="text-blue-500 hover:bg-blue-50 rounded-lg px-3 py-1 text-xs">Düzenle</button>
              <button onClick={() => toggleActive(t)}
                className="text-gray-500 hover:bg-gray-50 rounded-lg px-3 py-1 text-xs">{t.is_active ? "Pasifleştir" : "Aktifleştir"}</button>
              <button onClick={() => remove(t.id)}
                className="text-red-500 hover:bg-red-50 rounded-lg px-3 py-1 text-xs">Sil</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
