import { useEffect, useState } from "react";
import api from "../api";
import Spinner from "../components/Spinner";

export default function QuickRepliesPage() {
  const [quickReplies, setQuickReplies] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/quick-replies").then((r) => setQuickReplies(r.data));
  }, []);

  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/quick-replies/${editing}`, { title, content });
      } else {
        await api.post("/quick-replies", { title, content });
      }
      const res = await api.get("/quick-replies");
      setQuickReplies(res.data);
      setTitle(""); setContent(""); setEditing(null);
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    await api.delete(`/quick-replies/${id}`);
    setQuickReplies((p) => p.filter((q) => q.id !== id));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Hazır Mesajlar</h2>
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="font-medium text-gray-700 mb-4">{editing ? "Düzenle" : "Yeni Hazır Mesaj"}</h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlık"
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Mesaj içeriği..." rows={3}
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 resize-none focus:outline-none focus:border-blue-400" />
        <div className="flex gap-2">
          <button onClick={save} disabled={!title.trim() || !content.trim() || saving}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl px-5 py-2 text-sm font-medium min-w-[80px]">
            {saving ? <Spinner /> : (editing ? "Güncelle" : "Ekle")}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setTitle(""); setContent(""); }} disabled={saving}
              className="bg-gray-100 text-gray-700 rounded-xl px-5 py-2 text-sm font-medium">İptal</button>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {quickReplies.map((qr) => (
          <div key={qr.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4">
            <div className="flex-1">
              <div className="font-medium text-gray-800 text-sm mb-1">{qr.title}</div>
              <div className="text-gray-500 text-sm">{qr.content}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(qr.id); setTitle(qr.title); setContent(qr.content); }}
                className="text-blue-500 hover:bg-blue-50 rounded-lg px-3 py-1 text-xs">Düzenle</button>
              <button onClick={() => remove(qr.id)}
                className="text-red-500 hover:bg-red-50 rounded-lg px-3 py-1 text-xs">Sil</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
