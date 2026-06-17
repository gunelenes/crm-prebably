import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api";
import IssueList from "./IssueList";
import IssueFormModal from "./IssueFormModal";
import { PRIORITIES } from "./constants";

const PAGE_SIZE = 50;
const defaultFilters = { status: null, priority: null, q: "" };

const inputCls =
  "rounded-xl px-3 py-1.5 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${active
        ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30"
        : "bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10"}`}>
      {children}
    </button>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

export default function IssuesPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ acik: 0, cozuldu: 0, toplam: 0 });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const debounceRef = useRef(null);

  const buildParams = useCallback((f, off) => {
    const p = { limit: PAGE_SIZE, offset: off, sort_by: "created_at", sort_dir: "desc" };
    if (f.status) p.status = f.status;
    if (f.priority) p.priority = f.priority;
    if (f.q) p.q = f.q;
    return p;
  }, []);

  const fetchList = useCallback(async (f, off = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await api.get("/bugs", { params: buildParams(f, off) });
      setTotal(res.data.total);
      setSummary(res.data.summary || { acik: 0, cozuldu: 0, toplam: 0 });
      setItems((prev) => append ? [...prev, ...res.data.items] : res.data.items);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [buildParams]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      fetchList(filters, 0, false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [filters, fetchList]);

  const loadMore = () => {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    fetchList(filters, next, true);
  };

  const refresh = () => fetchList(filters, 0, false);
  const hasMore = items.length < total;

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (b) => { setEditing(b); setShowForm(true); };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">🐛 Hata Takibi</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Test sırasında bulunan hataları ve görevleri kaydet, çözüldükçe işaretle
            </p>
          </div>
          <button onClick={openNew}
            className="py-2 px-5 rounded-xl text-sm font-semibold text-white transition-all
              bg-gradient-to-r from-indigo-500 to-violet-500
              hover:from-indigo-600 hover:to-violet-600
              shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50">
            + Yeni Hata
          </button>
        </div>

        {/* Özet */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Toplam" value={summary.toplam} accent="text-slate-800 dark:text-slate-100" />
          <StatCard label="Açık" value={summary.acik} accent="text-amber-600 dark:text-amber-400" />
          <StatCard label="Çözüldü" value={summary.cozuldu} accent="text-emerald-600 dark:text-emerald-400" />
        </div>

        {/* Filtreler */}
        <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill active={filters.status === null} onClick={() => setFilters((f) => ({ ...f, status: null }))}>Tümü</Pill>
            <Pill active={filters.status === "acik"} onClick={() => setFilters((f) => ({ ...f, status: "acik" }))}>🟠 Açık</Pill>
            <Pill active={filters.status === "cozuldu"} onClick={() => setFilters((f) => ({ ...f, status: "cozuldu" }))}>✅ Çözüldü</Pill>
            <div className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-1" />
            <Pill active={filters.priority === null} onClick={() => setFilters((f) => ({ ...f, priority: null }))}>Tüm Öncelikler</Pill>
            {PRIORITIES.map((p) => (
              <Pill key={p.id} active={filters.priority === p.id} onClick={() => setFilters((f) => ({ ...f, priority: p.id }))}>{p.label}</Pill>
            ))}
          </div>
          <input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Başlık, açıklama veya sayfada ara..." className={`${inputCls} w-full`} />
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
            {total.toLocaleString("tr-TR")} kayıt
          </div>
          <IssueList items={items} loading={loading} onChange={refresh} onEdit={openEdit} />
          {hasMore && items.length > 0 && (
            <button onClick={loadMore} disabled={loadingMore}
              className="w-full mt-3 py-2 rounded-xl text-xs font-medium transition-colors
                bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
                text-slate-600 dark:text-slate-300
                border border-slate-200/60 dark:border-white/10 disabled:opacity-60">
              {loadingMore ? "Yükleniyor..." : "Daha fazla yükle"}
            </button>
          )}
        </div>

        {showForm && (
          <IssueFormModal edit={editing} onClose={() => setShowForm(false)} onSaved={refresh} />
        )}
      </div>
    </div>
  );
}
