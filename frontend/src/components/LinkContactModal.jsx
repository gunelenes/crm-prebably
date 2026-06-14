import { useEffect, useState } from "react";
import api from "../api";
import Spinner from "./Spinner";
import { platformIcon } from "../utils";

const inputCls =
  "w-full rounded-xl px-4 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/60 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

// Bir kişiyi (contact) KARŞI platformdaki başka bir kişiyle eşleştirme modalı.
export default function LinkContactModal({ contact, onClose, onLinked }) {
  const [suggestions, setSuggestions] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [linkingId, setLinkingId] = useState(null);
  const [error, setError] = useState(null);

  // Öneri/arama: q boşken otomatik öneri, q varken arama (300ms debounce).
  useEffect(() => {
    if (!contact?.id) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = q.trim() ? { q: q.trim() } : {};
        const res = await api.get(`/contacts/${contact.id}/match-suggestions`, { params });
        setSuggestions(Array.isArray(res.data) ? res.data : []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [contact?.id, q]);

  const link = async (other) => {
    setLinkingId(other.id);
    setError(null);
    try {
      const res = await api.post(`/contacts/${contact.id}/link`, { other_contact_id: other.id });
      if (res.data?.status === "ok") {
        onLinked();
        onClose();
      } else {
        setError(res.data?.error || "Eşleştirme başarısız");
      }
    } catch {
      setError("Eşleştirme başarısız");
    } finally {
      setLinkingId(null);
    }
  };

  const otherChannel = contact?.platform === "whatsapp" ? "Instagram" : "WhatsApp";

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="rounded-3xl p-6 w-full max-w-md bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl shadow-indigo-500/20 flex flex-col max-h-[85vh]">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-1 flex items-center gap-2">
          <span>🔗</span> Hesap Bağla
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          <span className="font-medium">{contact?.full_name || contact?.name}</span> kişisini {otherChannel} hesabıyla eşleştir. Önce olası eşleşmeler önerilir; aşağıdan da arayabilirsin.
        </p>

        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={`${otherChannel} kişisi ara (isim / telefon)`} className={`${inputCls} mb-3`} />

        {error && (
          <div className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</div>
        )}

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5">
          {loading ? (
            <div className="py-8 flex justify-center"><Spinner /></div>
          ) : suggestions.length === 0 ? (
            <div className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">
              {q.trim() ? "Sonuç bulunamadı" : "Otomatik öneri yok — yukarıdan arayabilirsin"}
            </div>
          ) : (
            suggestions.map((s) => (
              <button key={s.id} onClick={() => link(s)} disabled={linkingId !== null}
                className="w-full flex items-center gap-2 p-2.5 rounded-xl text-left transition-all
                  bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
                  border border-slate-200/60 dark:border-white/10 disabled:opacity-50">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {s.full_name || s.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {platformIcon(s.platform)} {s.name}{s.phone ? ` · ${s.phone}` : ""}
                  </div>
                </div>
                {s.reason && (
                  <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    {s.reason}
                  </span>
                )}
                {linkingId === s.id && <Spinner />}
              </button>
            ))
          )}
        </div>

        <button onClick={onClose} disabled={linkingId !== null}
          className="mt-4 py-2 rounded-xl text-sm font-medium transition-colors
            bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
            text-slate-700 dark:text-slate-200
            border border-slate-200/60 dark:border-white/10">Kapat</button>
      </div>
    </div>
  );
}
