import { useEffect, useRef, useState } from "react";
import api, { API } from "../api";
import Spinner from "../components/Spinner";

const inputCls =
  "w-full rounded-xl px-4 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

const audioSrc = (id) => `${API}/quick-replies/${id}/audio`;

export default function QuickRepliesPage() {
  const [quickReplies, setQuickReplies] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(null);
  const [editingHasAudio, setEditingHasAudio] = useState(false);
  const [saving, setSaving] = useState(false);

  // Yeni eklenecek ses (yüklenen dosya veya kayıt)
  const [pendingAudio, setPendingAudio] = useState(null); // Blob | File
  const [pendingAudioName, setPendingAudioName] = useState("");
  const [pendingAudioUrl, setPendingAudioUrl] = useState("");

  // Mikrofon kaydı
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const refresh = async () => {
    const res = await api.get("/quick-replies");
    setQuickReplies(res.data);
  };

  useEffect(() => {
    refresh();
  }, []);

  const clearPending = () => {
    if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
    setPendingAudio(null);
    setPendingAudioName("");
    setPendingAudioUrl("");
  };

  const reset = () => {
    setEditing(null);
    setEditingHasAudio(false);
    setTitle("");
    setContent("");
    clearPending();
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // aynı dosya tekrar seçilebilsin
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      alert("Ses dosyası 5MB'tan büyük olamaz");
      return;
    }
    clearPending();
    setPendingAudio(f);
    setPendingAudioName(f.name);
    setPendingAudioUrl(URL.createObjectURL(f));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        clearPending();
        setPendingAudio(blob);
        setPendingAudioName("kayit.webm");
        setPendingAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      alert("Mikrofona erişilemedi. Tarayıcı izinlerini kontrol et.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      let id = editing;
      if (editing) {
        await api.put(`/quick-replies/${editing}`, { title, content });
      } else {
        const r = await api.post("/quick-replies", { title, content });
        id = r.data.id;
      }
      if (pendingAudio) {
        const fd = new FormData();
        fd.append("audio", pendingAudio, pendingAudioName || "ses.webm");
        await api.post(`/quick-replies/${id}/audio`, fd);
      }
      await refresh();
      reset();
    } catch (e) {
      alert("Hata: " + (e.response?.data?.detail || "Kaydedilemedi"));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (qr) => {
    reset();
    setEditing(qr.id);
    setEditingHasAudio(qr.has_audio);
    setTitle(qr.title);
    setContent(qr.content || "");
  };

  const removeExistingAudio = async () => {
    if (!editing) return;
    await api.delete(`/quick-replies/${editing}/audio`);
    setEditingHasAudio(false);
    await refresh();
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
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sık kullandığın yanıtları ve sesli mesajları kaydet</p>
        </div>

        <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 mb-6">
          <h3 className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-3">{editing ? "Düzenle" : "Yeni Hazır Mesaj"}</h3>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlık"
            className={`${inputCls} mb-3`} />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Mesaj içeriği (sesli mesaj için boş bırakabilirsin)..." rows={3}
            className={`${inputCls} resize-none mb-3`} />

          {/* Ses bölümü */}
          <div className="rounded-xl border border-dashed border-slate-300/70 dark:border-white/10 p-3 mb-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-2">🎤 Sesli Mesaj</div>

            {/* Mevcut kayıtlı ses (düzenlemede) */}
            {editingHasAudio && !pendingAudio && (
              <div className="flex items-center gap-3 mb-2">
                <audio controls src={audioSrc(editing)} className="h-9 max-w-full" />
                <button type="button" onClick={removeExistingAudio}
                  className="text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Sesi sil</button>
              </div>
            )}

            {/* Yeni seçilen/kaydedilen ses önizleme */}
            {pendingAudio && (
              <div className="flex items-center gap-3 mb-2">
                <audio controls src={pendingAudioUrl} className="h-9 max-w-full" />
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[140px]">{pendingAudioName}</span>
                <button type="button" onClick={clearPending}
                  className="text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg px-3 py-1 text-xs transition-colors">Kaldır</button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer text-xs px-3 py-1.5 rounded-xl transition-all bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10">
                📁 Dosya seç
                <input type="file" accept="audio/*" onChange={onPickFile} className="hidden" />
              </label>
              {!recording ? (
                <button type="button" onClick={startRecording}
                  className="text-xs px-3 py-1.5 rounded-xl transition-all bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10">
                  ⏺️ Kaydet
                </button>
              ) : (
                <button type="button" onClick={stopRecording}
                  className="text-xs px-3 py-1.5 rounded-xl transition-all bg-rose-500 text-white shadow-md shadow-rose-500/30 animate-pulse">
                  ⏹️ Durdur (kaydediliyor...)
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={save} disabled={!title.trim() || saving}
              className="py-2 px-5 rounded-xl text-sm font-semibold text-white transition-all min-w-[100px]
                bg-gradient-to-r from-indigo-500 to-violet-500
                hover:from-indigo-600 hover:to-violet-600
                shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
                disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700">
              {saving ? <Spinner /> : (editing ? "Güncelle" : "Ekle")}
            </button>
            {editing && (
              <button onClick={reset} disabled={saving}
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
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 dark:text-slate-100 text-sm mb-1 flex items-center gap-2">
                  {qr.has_audio && <span title="Sesli mesaj">🎤</span>}
                  {qr.title}
                </div>
                {qr.content && <div className="text-slate-500 dark:text-slate-400 text-sm">{qr.content}</div>}
                {qr.has_audio && (
                  <audio controls src={audioSrc(qr.id)} className="h-8 mt-2 max-w-full" />
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(qr)}
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
