import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { API } from "../../api";
import Spinner from "../../components/Spinner";

const inputCls =
  "rounded-xl px-3 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 focus:border-fuchsia-500 " +
  "text-slate-800 dark:text-slate-100";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function FormRegistrationsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null); // { form, items }
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q.trim()) params.q = q.trim();
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get(`/seminar-forms/${id}/registrations`, { params });
      setData(res.data);
    } catch (e) {
      if (e.response?.status === 404) {
        alert("Form bulunamadı.");
      } else {
        alert("Yüklenemedi: " + (e.response?.data?.detail || e.message));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Filtreler için tek bir useEffect debouncing yerine "Uygula" butonu basit ve yeterli.

  const form = data?.form;
  const items = data?.items || [];
  const columns = useMemo(() => form?.fields || [], [form]);

  const publicLink = form ? `${window.location.origin}/f/${form.slug}` : "";

  const copyLink = async () => {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Linki kopyala:", publicLink);
    }
  };

  const downloadCsv = async () => {
    if (!form) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const url = `${API}/seminar-forms/${form.id}/registrations/export${params.toString() ? "?" + params.toString() : ""}`;
      const res = await api.get(url.replace(API, ""), { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${form.slug}-kayitlar.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      alert("İndirilemedi: " + (e.response?.data?.detail || e.message));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-2">
          <Link to="/seminer-formlari" className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline">
            ← Tüm formlar
          </Link>
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-16">
            <Spinner className="w-8 h-8 text-indigo-500" />
          </div>
        ) : !form ? (
          <div className="text-center py-16 text-slate-500">Form bulunamadı.</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {form.title}
                </h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                    {publicLink}
                  </span>
                  <button
                    onClick={copyLink}
                    className="text-xs font-medium px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                  >
                    {copied ? "✓ Kopyalandı" : "Kopyala"}
                  </button>
                </div>
              </div>
              <button
                onClick={downloadCsv}
                disabled={downloading || items.length === 0}
                className="py-2 px-5 rounded-xl text-sm font-semibold text-white transition-all
                  bg-gradient-to-r from-emerald-500 to-teal-500
                  hover:from-emerald-600 hover:to-teal-600
                  shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50
                  disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700"
              >
                {downloading ? <Spinner /> : "📥 CSV İndir"}
              </button>
            </div>

            <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 mb-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Ara
                </label>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                  placeholder="İsim, e-posta, telefon..."
                  className={`${inputCls} w-56`}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Başlangıç
                </label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Bitiş
                </label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
              </div>
              <button
                onClick={load}
                className="py-2 px-4 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white shadow-md shadow-indigo-500/30 transition-all"
              >
                Uygula
              </button>
              {(q || from || to) && (
                <button
                  onClick={() => {
                    setQ("");
                    setFrom("");
                    setTo("");
                    setTimeout(load, 0);
                  }}
                  className="py-2 px-4 rounded-xl text-sm font-medium bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10 transition-colors"
                >
                  Temizle
                </button>
              )}
              <div className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                Toplam <span className="font-semibold text-slate-700 dark:text-slate-200">{items.length}</span> kayıt
              </div>
            </div>

            <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm overflow-hidden">
              {items.length === 0 ? (
                <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                  <div className="text-4xl mb-2">📭</div>
                  {loading ? "Yükleniyor..." : "Henüz kayıt yok."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-white/5 text-left">
                        {columns.map((c) => (
                          <th
                            key={c.key}
                            className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap"
                          >
                            {c.label}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          Kayıt Tarihi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => (
                        <tr
                          key={row.id}
                          className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/5"
                        >
                          {columns.map((c) => (
                            <td key={c.key} className="px-4 py-3 text-slate-800 dark:text-slate-100 align-top">
                              {row.values[c.key] || <span className="text-slate-300 dark:text-slate-600">—</span>}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(row.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
