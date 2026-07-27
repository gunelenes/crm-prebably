import { useEffect, useState } from "react";
import api from "../../api";
import Spinner from "../../components/Spinner";

// Kontrol durumuna göre rozet stilleri.
const STATUS_STYLES = {
  ok: { label: "Sağlıklı", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  warning: { label: "Uyarı", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  error: { label: "Sorun", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400", dot: "bg-rose-500" },
  unknown: { label: "Bilinmiyor", cls: "bg-slate-500/15 text-slate-500 dark:text-slate-400", dot: "bg-slate-400" },
  info: { label: "Bilgi", cls: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500" },
};

// Görev önem derecesine göre kart stilleri.
const SEVERITY_STYLES = {
  critical: { icon: "🚨", cls: "border-rose-300/60 dark:border-rose-500/30 bg-rose-500/10" },
  warning: { icon: "⚠️", cls: "border-amber-300/60 dark:border-amber-500/30 bg-amber-500/10" },
  info: { icon: "ℹ️", cls: "border-indigo-300/60 dark:border-indigo-500/30 bg-indigo-500/10" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default function SystemHealthPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/system/health");
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Sağlık bilgisi alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runBackfill = async () => {
    setBackfilling(true);
    setBackfillMsg("");
    try {
      const res = await api.post("/system/instagram/backfill-usernames");
      setBackfillMsg(res.data?.message || "Backfill arka planda başlatıldı.");
    } catch (err) {
      setBackfillMsg("Hata: " + (err.response?.data?.detail || "İşlem başarısız."));
    } finally {
      setBackfilling(false);
    }
  };

  const tasks = data?.tasks || [];
  const checks = data?.checks || [];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              🛠️ Geliştirici Paneli
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Entegrasyon sağlığı ve yapılması gereken işler. Yalnızca geliştirici görür.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex-shrink-0 rounded-xl px-4 py-2 text-sm font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
          >
            🔄 Yeniden Kontrol Et
          </button>
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-300/60 dark:border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        ) : (
          <>
            {/* Görevler */}
            <section className="mb-8">
              <h3 className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-3">
                Yapılacaklar {tasks.length ? `(${tasks.length})` : ""}
              </h3>
              {tasks.length === 0 ? (
                <div className="rounded-2xl border border-emerald-300/60 dark:border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                  ✅ Her şey yolunda — şu an yapılması gereken bir iş yok.
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((t, i) => {
                    const s = SEVERITY_STYLES[t.severity] || SEVERITY_STYLES.info;
                    return (
                      <div key={i} className={`rounded-2xl border p-4 ${s.cls}`}>
                        <div className="flex items-start gap-3">
                          <span className="text-lg leading-none mt-0.5">{s.icon}</span>
                          <div>
                            <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">{t.title}</div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">{t.action}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Kontroller */}
            <section className="mb-8">
              <h3 className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-3">
                Entegrasyon Durumu
              </h3>
              <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm divide-y divide-slate-200/60 dark:divide-white/10">
                {checks.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{c.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.detail}</div>
                      {c.days_left != null && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          Kalan süre: {c.days_left} gün
                        </div>
                      )}
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            </section>

            {/* Aksiyonlar */}
            <section>
              <h3 className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-3">
                Araçlar
              </h3>
              <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">Kullanıcı adlarını yenile</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Token geçerliyken, yer tutucu isimde kalmış kişilerin adını @handle ile günceller.
                    </div>
                  </div>
                  <button
                    onClick={runBackfill}
                    disabled={backfilling}
                    className="flex-shrink-0 rounded-xl px-4 py-2 text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors disabled:opacity-50"
                  >
                    {backfilling ? "Yenileniyor…" : "👤 Yenile"}
                  </button>
                </div>
                {backfillMsg && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-3">{backfillMsg}</div>
                )}
              </div>
            </section>

            {data?.generated_at && (
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-6 text-center">
                Son kontrol: {new Date(data.generated_at).toLocaleString("tr-TR")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
