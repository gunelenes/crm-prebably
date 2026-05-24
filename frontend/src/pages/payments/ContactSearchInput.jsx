import { useEffect, useRef, useState } from "react";
import api from "../../api";

const inputCls =
  "w-full rounded-xl px-3 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

export default function ContactSearchInput({ value, onChange, disabled }) {
  // value: { id, name } | null
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || value?.name === query) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get("/contacts/search", { params: { q: query, limit: 10 } });
        setResults(res.data.items || []);
        setOpen(true);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, value]);

  const select = (c) => {
    onChange({ id: c.id, name: c.full_name || c.name });
    setQuery(c.full_name || c.name);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
    setResults([]);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          value={value ? value.name : query}
          onChange={(e) => { setQuery(e.target.value); if (value) onChange(null); }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Kişi ara (isim veya telefon)"
          disabled={disabled}
          className={`${inputCls} pr-8`}
        />
        {(value || query) && !disabled && (
          <button type="button" onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm px-1">×</button>
        )}
      </div>
      {open && (results.length > 0 || loading) && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-2xl shadow-indigo-500/20">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-500">Aranıyor...</div>
          )}
          {results.map((c) => (
            <button type="button" key={c.id} onClick={() => select(c)}
              className="w-full text-left px-3 py-2 hover:bg-indigo-500/10 transition-colors flex items-center gap-2 border-b border-slate-100 dark:border-white/5 last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{c.full_name || c.name}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{c.phone || c.name}</div>
              </div>
              {c.status && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: c.status.color }}>
                  {c.status.name}
                </span>
              )}
            </button>
          ))}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500">Sonuç yok</div>
          )}
        </div>
      )}
    </div>
  );
}
