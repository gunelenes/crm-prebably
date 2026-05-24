import { useEffect, useState } from "react";
import api from "../../api";
import Spinner from "../../components/Spinner";

export default function StatusesTab() {
  const [statuses, setStatuses] = useState([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/statuses").then((r) => setStatuses(r.data));
  }, []);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/statuses/${editing}`, { name, color });
      } else {
        await api.post("/statuses", { name, color });
      }
      const res = await api.get("/statuses");
      setStatuses(res.data);
      setName(""); setColor("#3B82F6"); setEditing(null);
    } finally { setSaving(false); }
  };

  const toggleActive = async (s) => {
    await api.put(`/statuses/${s.id}`, { is_active: !s.is_active });
    const res = await api.get("/statuses");
    setStatuses(res.data);
  };

  const remove = async (id) => {
    if (!window.confirm("Bu statüyü silmek istediğinden emin misin?")) return;
    await api.delete(`/statuses/${id}`);
    setStatuses((p) => p.filter((s) => s.id !== id));
  };

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex gap-3 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Statü adı"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400" />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-1" />
        </div>
        {name && (
          <div className="mb-3">
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: color }}>{name}</span>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={save} disabled={!name.trim() || saving}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl px-5 py-2 text-sm font-medium min-w-[80px]">
            {saving ? <Spinner /> : (editing ? "Güncelle" : "Ekle")}
          </button>
          {editing && <button onClick={() => { setEditing(null); setName(""); setColor("#3B82F6"); }} disabled={saving}
            className="bg-gray-100 text-gray-700 rounded-xl px-5 py-2 text-sm font-medium">İptal</button>}
        </div>
      </div>
      <div className="space-y-3">
        {statuses.map((s) => (
          <div key={s.id} className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 ${!s.is_active ? "opacity-50" : ""}`}>
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <div className="flex-1">
              <span className="font-medium text-gray-800 text-sm">{s.name}</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {s.is_active ? "Aktif" : "Pasif"}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(s.id); setName(s.name); setColor(s.color); }}
                className="text-blue-500 hover:bg-blue-50 rounded-lg px-3 py-1 text-xs">Düzenle</button>
              <button onClick={() => toggleActive(s)}
                className="text-gray-500 hover:bg-gray-50 rounded-lg px-3 py-1 text-xs">{s.is_active ? "Pasifleştir" : "Aktifleştir"}</button>
              <button onClick={() => remove(s.id)}
                className="text-red-500 hover:bg-red-50 rounded-lg px-3 py-1 text-xs">Sil</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
