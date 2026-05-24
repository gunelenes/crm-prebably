import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api";
import PaymentSummary from "./PaymentSummary";
import PaymentFilters from "./PaymentFilters";
import PaymentList from "./PaymentList";
import PaymentFormModal from "./PaymentFormModal";

const PAGE_SIZE = 50;
const defaultFilters = {
  type: null,
  bankAccountId: null,
  dateFrom: "",
  dateTo: "",
  q: "",
};

export default function PaymentsPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ income: 0, expense: 0, net: 0 });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.get("/bank-accounts").then((r) => setBankAccounts(r.data));
  }, []);

  const buildParams = useCallback((f, off) => {
    const p = { limit: PAGE_SIZE, offset: off, sort_by: "paid_at", sort_dir: "desc" };
    if (f.type) p.type = f.type;
    if (f.bankAccountId) p.bank_account_id = f.bankAccountId;
    if (f.dateFrom) p.date_from = new Date(f.dateFrom).toISOString();
    if (f.dateTo) p.date_to = new Date(f.dateTo + "T23:59:59").toISOString();
    if (f.q) p.q = f.q;
    return p;
  }, []);

  const fetchList = useCallback(async (f, off = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await api.get("/payments", { params: buildParams(f, off) });
      setTotal(res.data.total);
      setSummary(res.data.summary || { income: 0, expense: 0, net: 0 });
      setItems((prev) => append ? [...prev, ...res.data.items] : res.data.items);
    } catch (e) { console.error(e); }
    finally {
      setLoading(false);
      setLoadingMore(false);
    }
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

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Ödemeler</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tahsilat ve masraf kayıtları</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="py-2 px-5 rounded-xl text-sm font-semibold text-white transition-all
              bg-gradient-to-r from-indigo-500 to-violet-500
              hover:from-indigo-600 hover:to-violet-600
              shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50">
            + Yeni Ödeme
          </button>
        </div>

        <PaymentSummary summary={summary} />

        <PaymentFilters filters={filters} setFilters={setFilters} bankAccounts={bankAccounts} />

        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
            {total.toLocaleString("tr-TR")} kayıt
          </div>
          <PaymentList items={items} loading={loading} onDelete={refresh} />
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
          <PaymentFormModal
            bankAccounts={bankAccounts}
            onClose={() => setShowForm(false)}
            onSaved={refresh}
          />
        )}
      </div>
    </div>
  );
}
