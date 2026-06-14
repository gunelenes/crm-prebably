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

const label = (c) => c?.full_name || c?.name || "(isimsiz)";

// Bir kişiyi (contact) KARŞI platformdaki başka bir kişiyle eşleştirme modalı.
// İki adım: (1) kişiyi seç, (2) hangisi ana profil olsun seç → bağla.
export default function LinkContactModal({ contact, onClose, onLinked }) {
  const [suggestions, setSuggestions] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingOther, setPendingOther] = useState(null);   // seçilen aday (onay aşaması)
  const [primaryId, setPrimaryId] = useState(null);          // ana profil id
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!contact?.id || pendingOther) return;
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
  }, [contact?.id, q, pendingOther]);

  const choose = (other) => {
    setError(null);
    setPendingOther(other);
    setPrimaryId(contact.id); // varsayılan: üzerinde olduğun profil ana olsun
  };

  const doLink = async () => {
    setLinking(true);
    setError(null);
    try {
      const res = await api.post(`/contacts/${contact.id}/link`, {
        other_contact_id: pendingOther.id,
        primary_contact_id: primaryId,
      });
      if (res.data?.status === "ok") {
        onLinked();
        onClose();
      } else {
        setError(res.data?.error || "Eşleştirme başarısız");
      }
    } catch {
      setError("Eşleştirme başarısız");
    } finally {
      setLinking(false);
    }
  };

  const otherChannel = contact?.platform === "whatsapp" ? "Instagram" : "WhatsApp";

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="rounded-3xl p-6 w-full max-w-md bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl shadow-indigo-500/20 flex flex-col max-h-[85vh]">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-1 flex items-center gap-2">
          <span>🔗</span> Hesap Bağla
        </h3>

        {error && <div className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</div>}

        {!pendingOther ? (
          <>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              <span className="font-medium">{label(contact)}</span> kişisini {otherChannel} hesabıyla eşleştir.
            </p>
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={`${otherChannel} kişisi ara (isim / telefon)`} className={`${inputCls} mb-3`} />
            <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5">
              {loading ? (
                <div className="py-8 flex justify-center"><Spinner /></div>
              ) : suggestions.length === 0 ? (
                <div className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">
                  {q.trim() ? "Sonuç bulunamadı" : "Otomatik öneri yok — yukarıdan arayabilirsin"}
                </div>
              ) : (
                suggestions.map((s) => (
                  <button key={s.id} onClick={() => choose(s)}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl text-left transition-all
                      bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
                      border border-slate-200/60 dark:border-white/10">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{label(s)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {platformIcon(s.platform)} {s.name}{s.phone ? ` · ${s.phone}` : ""}
                      </div>
                    </div>
                    {s.reason && (
                      <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        {s.reason}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
            <button onClick={onClose}
              className="mt-4 py-2 rounded-xl text-sm font-medium transition-colors
                bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
                text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10">Kapat</button>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Bu iki hesap tek kişi olarak birleşecek. <span className="font-medium">Ana profil</span> hangisi olsun?
              (Statü, telefon, notlar bu kayıttan okunup yazılır.)
            </p>
            <div className="space-y-2 mb-4">
              {[contact, pendingOther].map((c) => {
                const sel = primaryId === c.id;
                return (
                  <button key={c.id} onClick={() => setPrimaryId(c.id)}
                    className={`w-full flex items-center gap-2 p-3 rounded-xl text-left border-2 transition-all ${sel
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-slate-200/60 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"}`}>
                    <span className={`flex-shrink-0 w-4 h-4 rounded-full border-2 ${sel ? "border-indigo-500 bg-indigo-500" : "border-slate-300 dark:border-slate-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{label(c)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{platformIcon(c.platform)} {c.name}</div>
                    </div>
                    {sel && <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500 text-white">Ana</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={doLink} disabled={linking}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all
                  bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600
                  shadow-lg shadow-indigo-500/30 disabled:opacity-50">
                {linking ? <Spinner /> : "Bağla"}
              </button>
              <button onClick={() => setPendingOther(null)} disabled={linking}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                  bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
                  text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10">Geri</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
