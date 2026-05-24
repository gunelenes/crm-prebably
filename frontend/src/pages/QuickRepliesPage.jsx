import { useEffect, useState } from "react";
import api from "../api";
import Spinner from "../components/Spinner";

const inputCls =
  "w-full rounded-xl px-4 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

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
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Hazır Mesajlar</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sık kullandığın yanıtları kaydet</p>
        </div>

        <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 mb-6">
          <h3 className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-3">{editing ? "Düzenle" : "Yeni Hazır Mesaj"}</h3>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlık"
            className={`${inputCls} mb-3`} />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Mesaj içeriği..." rows={3}
            className={`${inputCls} resize-none mb-3`} />
          <div className="flex gap-2">
            <button onClick={save} disabled={!title.trim() || !content.trim() || saving}
              className="py-2 px-5 rounded-xl text-sm font-semibold text-white transition-all min-w-[100px]
                bg-gradient-to-r from-indigo-500 to-violet-500
                hover:from-indigo-600 hover:to-violet-600
                shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
                disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700">
              {saving ? <Spinner /> : (editing ? "Güncelle" : "Ekle")}
            </button>
            {editing && (
              <button onClick={() => { setEditing(null); setTitle(""); setContent(""); }} disabled={saving}
                className="py-2 px-5 rounded-xl text-sm font-medium transition-colors
                  bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
                  text-slate-700 dark:text-slate-200
                  border border-slate-200/60 dark:border-white/10">İptal</button>
            )}
          </div>
        </div>
        <div className="space-y-3">
          {quickReplies.map((qr) => (
            <div key={qr.id} className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 flex items-start gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex-1">
                <div className="font-medium text-slate-800 dark:text-slate-100 text-sm mb-1">{qr.title}</div>
                <div className="text-slate-500 dark:text-slate-400 text-sm">{qr.content}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(qr.id); setTitle(qr.title); setContent(qr.content); }}
                  className="text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Düzenle</button>
                <button onClick={() => remove(qr.id)}
                  className="text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Sil</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
