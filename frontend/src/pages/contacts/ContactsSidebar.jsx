import { useState } from "react";
import { avatarUrl, formatTime } from "../../utils";
import { ConversationSkeleton } from "../../components/Skeletons";
import ContactsFilters from "./ContactsFilters";

export default function ContactsSidebar({
  filters, setFilters,
  items, total, loading, loadingMore, hasMore, loadMore,
  selectedId, onSelect,
  statuses, sectors, trainingSets,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount =
    (filters.statusId ? 1 : 0) +
    (filters.sectorId ? 1 : 0) +
    (filters.trainingSetId ? 1 : 0) +
    (filters.assignedTo ? 1 : 0) +
    (filters.purchased !== null ? 1 : 0) +
    (filters.purchasePotential ? 1 : 0) +
    (filters.waitingForReply !== null ? 1 : 0);

  return (
    <aside className="w-96 flex-shrink-0 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl border-r border-slate-200/60 dark:border-white/10 flex flex-col">
      <div className="p-3 border-b border-slate-200/60 dark:border-white/10 space-y-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">🔍</span>
          <input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="İsim, ad-soyad veya telefon ara"
            className="w-full rounded-xl pl-9 pr-9 py-2 text-sm transition-all
              bg-white/60 dark:bg-slate-800/50 backdrop-blur
              border border-slate-200/60 dark:border-white/10
              focus:bg-white dark:focus:bg-slate-800
              focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500
              text-slate-800 dark:text-slate-100"
          />
          {filters.q && (
            <button onClick={() => setFilters((f) => ({ ...f, q: "" }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm px-1">×</button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <button onClick={() => setFiltersOpen(!filtersOpen)}
            className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
              filtersOpen || activeFilterCount > 0
                ? "bg-gradient-to-r from-indigo-500/15 to-violet-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
                : "bg-white/50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-white/10 hover:bg-white dark:hover:bg-white/10"
            }`}>
            ⚙️ Filtreler{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {total.toLocaleString("tr-TR")} kişi
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="px-3 pt-3 border-b border-slate-200/60 dark:border-white/10">
          <ContactsFilters
            filters={filters}
            setFilters={setFilters}
            statuses={statuses}
            sectors={sectors}
            trainingSets={trainingSets}
            onClose={() => setFiltersOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {loading && items.length === 0 ? (
          <ConversationSkeleton count={8} />
        ) : items.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">Sonuç bulunamadı</div>
        ) : items.map((c) => {
          const isSelected = selectedId === c.id;
          return (
            <div key={c.id} onClick={() => onSelect(c.id)}
              className={`relative p-2.5 rounded-xl cursor-pointer transition-all ${isSelected
                ? "bg-gradient-to-r from-indigo-500/15 to-violet-500/15 shadow-sm"
                : "hover:bg-white/60 dark:hover:bg-white/5"}`}>
              {isSelected && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-500" />
              )}
              <div className="flex items-start gap-2.5">
                <img src={avatarUrl(c.full_name || c.name)} className="w-10 h-10 rounded-full flex-shrink-0 ring-2 ring-white/60 dark:ring-white/10" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{c.full_name || c.name}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{formatTime(c.last_message_at)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{c.phone || c.last_message_preview || "—"}</div>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {c.status && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] text-white font-medium" style={{ backgroundColor: c.status.color }}>
                        {c.status.name}
                      </span>
                    )}
                    {c.sector && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                        {c.sector.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {hasMore && items.length > 0 && (
          <button onClick={loadMore} disabled={loadingMore}
            className="w-full mt-3 py-2 rounded-xl text-xs font-medium transition-colors
              bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
              text-slate-600 dark:text-slate-300
              border border-slate-200/60 dark:border-white/10 disabled:opacity-60">
            {loadingMore ? "Yükleniyor..." : "Daha fazla yükle"}
          </button>
        )}
      </div>
    </aside>
  );
}
