const inputCls =
  "rounded-xl px-3 py-1.5 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

function Pill({ active, onClick, children, color }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
        active
          ? "text-white shadow-sm"
          : "bg-white/50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10"
      }`}
      style={active ? { backgroundColor: color || undefined, backgroundImage: color ? undefined : "linear-gradient(90deg, #6366f1, #8b5cf6)" } : undefined}
    >
      {children}
    </button>
  );
}

export default function ContactsFilters({ filters, setFilters, statuses, sectors, trainingSets, adOptions = [], onClose }) {
  const update = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const clearAll = () => setFilters({
    q: filters.q,
    statusId: null,
    sectorId: null,
    adId: null,
    trainingSetId: null,
    assignedTo: "",
    purchased: null,
    purchasePotential: null,
    waitingForReply: null,
    platform: null,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  });

  const activeStatuses = statuses.filter((s) => s.is_active);

  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-3 mb-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Filtreler</div>
        <button onClick={clearAll} className="text-[11px] text-indigo-600 dark:text-indigo-300 hover:underline">Temizle</button>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Statü</div>
        <div className="flex flex-wrap gap-1">
          <Pill active={filters.statusId === null} onClick={() => update({ statusId: null })}>Tümü</Pill>
          {activeStatuses.map((s) => (
            <Pill key={s.id} active={filters.statusId === s.id} onClick={() => update({ statusId: s.id })} color={s.color}>
              {s.name}
            </Pill>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Sektör</div>
          <select value={filters.sectorId || ""} onChange={(e) => update({ sectorId: e.target.value ? Number(e.target.value) : null })}
            className={`${inputCls} w-full`}>
            <option value="">Tümü</option>
            {sectors.filter((s) => s.is_active).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Eğitim Seti</div>
          <select value={filters.trainingSetId || ""} onChange={(e) => update({ trainingSetId: e.target.value ? Number(e.target.value) : null })}
            className={`${inputCls} w-full`}>
            <option value="">Tümü</option>
            {trainingSets.filter((t) => t.is_active).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {adOptions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">📢 Reklam (geldiği kampanya)</div>
          <select value={filters.adId || ""} onChange={(e) => update({ adId: e.target.value || null })}
            className={`${inputCls} w-full`}>
            <option value="">Tümü</option>
            {adOptions.map((a) => (
              <option key={a.ad_id} value={a.ad_id}>{a.ad_title || a.ad_id}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Sorumlu Danışman</div>
        <input value={filters.assignedTo} onChange={(e) => update({ assignedTo: e.target.value })} placeholder="Tümü"
          className={`${inputCls} w-full`} />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Kanal</div>
        <div className="flex flex-wrap gap-1">
          <Pill active={filters.platform === null} onClick={() => update({ platform: null })}>Tümü</Pill>
          <Pill active={filters.platform === "instagram"} onClick={() => update({ platform: "instagram" })}>📸 Instagram</Pill>
          <Pill active={filters.platform === "whatsapp"} onClick={() => update({ platform: "whatsapp" })}>💬 WhatsApp</Pill>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Cevap Bekliyor</div>
        <div className="flex flex-wrap gap-1">
          <Pill active={filters.waitingForReply === null} onClick={() => update({ waitingForReply: null })}>Tümü</Pill>
          <Pill active={filters.waitingForReply === true} onClick={() => update({ waitingForReply: true })}>⌛ Bekleyenler</Pill>
          <Pill active={filters.waitingForReply === false} onClick={() => update({ waitingForReply: false })}>Yanıtlananlar</Pill>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Satın Alma</div>
        <div className="flex flex-wrap gap-1">
          <Pill active={filters.purchased === null} onClick={() => update({ purchased: null })}>Tümü</Pill>
          <Pill active={filters.purchased === true} onClick={() => update({ purchased: true })}>Aldı</Pill>
          <Pill active={filters.purchased === false} onClick={() => update({ purchased: false })}>Almadı</Pill>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Potansiyel</div>
        <div className="flex flex-wrap gap-1">
          <Pill active={filters.purchasePotential === null} onClick={() => update({ purchasePotential: null })}>Tümü</Pill>
          <Pill active={filters.purchasePotential === "düşük"} onClick={() => update({ purchasePotential: "düşük" })}>Düşük</Pill>
          <Pill active={filters.purchasePotential === "orta"} onClick={() => update({ purchasePotential: "orta" })}>Orta</Pill>
          <Pill active={filters.purchasePotential === "yüksek"} onClick={() => update({ purchasePotential: "yüksek" })}>Yüksek</Pill>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-white/10">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Sıralama</div>
          <select value={filters.sortBy} onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value }))}
            className={`${inputCls} w-full`}>
            <option value="last_message_at">Son mesaj</option>
            <option value="created_at">Oluşturulma</option>
            <option value="name">İsim</option>
          </select>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Yön</div>
          <select value={filters.sortDir} onChange={(e) => setFilters((f) => ({ ...f, sortDir: e.target.value }))}
            className={`${inputCls} w-full`}>
            <option value="desc">Azalan</option>
            <option value="asc">Artan</option>
          </select>
        </div>
      </div>
    </div>
  );
}
