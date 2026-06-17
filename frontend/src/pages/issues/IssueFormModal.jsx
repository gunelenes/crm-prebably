import { useState } from "react";
import api from "../../api";
import Spinner from "../../components/Spinner";
import AuthImage from "../../components/AuthImage";
import { PRIORITIES, ALLOWED_MIMES, MAX_SIZE, MAX_ATTACHMENTS } from "./constants";

const inputCls =
  "w-full rounded-xl px-3 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

// edit verilirse düzenleme modu; yoksa yeni kayıt.
export default function IssueFormModal({ edit = null, onClose, onSaved }) {
  const isEdit = !!edit;
  const [title, setTitle] = useState(edit?.title || "");
  const [description, setDescription] = useState(edit?.description || "");
  const [priority, setPriority] = useState(edit?.priority || "orta");
  const [page, setPage] = useState(edit?.page || "");
  const [files, setFiles] = useState([]); // yeni eklenecek File listesi
  const [existing] = useState(edit?.attachments || []); // mevcut ekler
  const [removedIds, setRemovedIds] = useState([]); // silinecek mevcut ek id'leri
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const remainingSlots = MAX_ATTACHMENTS - (existing.length - removedIds.length) - files.length;

  const onPickFiles = (fileList) => {
    setError("");
    const picked = Array.from(fileList || []);
    const valid = [];
    for (const f of picked) {
      if (!ALLOWED_MIMES.includes(f.type)) { setError("Sadece JPG, PNG, WEBP veya GIF yüklenebilir"); continue; }
      if (f.size > MAX_SIZE) { setError(`${f.name} 10MB'tan büyük`); continue; }
      valid.push(f);
    }
    setFiles((prev) => {
      const room = MAX_ATTACHMENTS - (existing.length - removedIds.length) - prev.length;
      if (valid.length > room) setError(`En fazla ${MAX_ATTACHMENTS} ekran görüntüsü eklenebilir`);
      return [...prev, ...valid.slice(0, Math.max(0, room))];
    });
  };

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    if (!title.trim()) { setError("Başlık zorunlu"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/bugs/${edit.id}`, {
          title: title.trim(),
          description,
          priority,
          page,
        });
        // mevcut eklerden silinecekler
        for (const id of removedIds) {
          await api.delete(`/bugs/${edit.id}/attachments/${id}`);
        }
        // yeni eklenecekler
        if (files.length) {
          const fd = new FormData();
          files.forEach((f) => fd.append("screenshots", f));
          await api.post(`/bugs/${edit.id}/attachments`, fd);
        }
      } else {
        const fd = new FormData();
        fd.append("title", title.trim());
        if (description) fd.append("description", description);
        fd.append("priority", priority);
        if (page) fd.append("page", page);
        files.forEach((f) => fd.append("screenshots", f));
        await api.post("/bugs", fd);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.detail || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <form onSubmit={submit}
        className="w-full max-w-xl rounded-3xl p-7 bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl shadow-indigo-500/20 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-5 flex items-center gap-2">
          <span>🐛</span> {isEdit ? "Hatayı Düzenle" : "Yeni Hata / Görev"}
        </h3>

        {/* Başlık */}
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Başlık *</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Kısa ve net bir başlık" className={inputCls} autoFocus />
        </div>

        {/* Açıklama */}
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Açıklama</div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Hatanın nasıl oluştuğu, beklenen davranış, adımlar..." rows={4}
            className={`${inputCls} resize-none`} />
        </div>

        {/* Öncelik + Sayfa */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Öncelik</div>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => {
                const active = priority === p.id;
                return (
                  <button type="button" key={p.id} onClick={() => setPriority(p.id)}
                    className={`flex-1 px-2 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${active
                      ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30"
                      : "bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 hover:bg-white dark:hover:bg-white/10"}`}>
                    <span className={`h-2 w-2 rounded-full ${active ? "bg-white" : p.dot}`} />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Sayfa / Bölüm</div>
            <input value={page} onChange={(e) => setPage(e.target.value)}
              placeholder="Örn. Mesajlar, Ödemeler..." className={inputCls} />
          </div>
        </div>

        {/* Ekran görüntüleri */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Ekran Görüntüleri (JPG/PNG/WEBP/GIF, max 10MB)
          </div>

          {/* Mevcut ekler (düzenleme) */}
          {existing.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
              {existing.map((a) => {
                const removed = removedIds.includes(a.id);
                return (
                  <div key={a.id} className="relative group">
                    <AuthImage src={`/bugs/${edit.id}/attachments/${a.id}`}
                      className={`h-20 w-full object-cover rounded-xl border border-slate-200/60 dark:border-white/10 ${removed ? "opacity-30 grayscale" : ""}`}
                      openable={!removed} />
                    <button type="button"
                      onClick={() => setRemovedIds((r) => removed ? r.filter((x) => x !== a.id) : [...r, a.id])}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-rose-500">
                      {removed ? "↺" : "✕"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Yeni seçilenler */}
          {files.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
              {files.map((f, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(f)} alt={f.name}
                    className="h-20 w-full object-cover rounded-xl border border-indigo-500/30" />
                  <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-rose-500">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {remainingSlots > 0 && (
            <label className="flex flex-col items-center justify-center gap-1 p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/10 cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors">
              <span className="text-2xl">🖼️</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Görsel ekle ({remainingSlots} hak kaldı)
              </span>
              <input type="file" accept="image/*" multiple onChange={(e) => onPickFiles(e.target.files)} className="hidden" />
            </label>
          )}
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded-xl px-3 py-2 mb-3">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all
              bg-gradient-to-r from-indigo-500 to-violet-500
              hover:from-indigo-600 hover:to-violet-600
              shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
              disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700">
            {saving ? <Spinner /> : "Kaydet"}
          </button>
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors
              bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
              text-slate-700 dark:text-slate-200
              border border-slate-200/60 dark:border-white/10">İptal</button>
        </div>
      </form>
    </div>
  );
}
