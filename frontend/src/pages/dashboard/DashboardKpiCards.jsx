function KpiCard({ icon, label, value, accent }) {
  return (
    <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`text-lg ${accent}`}>{icon}</span>
      </div>
      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
        {(value ?? 0).toLocaleString("tr-TR")}
      </div>
    </div>
  );
}

export default function DashboardKpiCards({ today }) {
  const t = today || {};
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiCard icon="💬" label="Gelen Mesaj" value={t.incoming_messages} accent="text-indigo-500" />
      <KpiCard icon="🌟" label="Reklamla İlk Kez" value={t.ad_first_touch_arrivals} accent="text-emerald-500" />
      <KpiCard icon="✉️" label="Giden Mesaj" value={t.outgoing_messages} accent="text-violet-500" />
      <KpiCard icon="👤" label="Yeni Kişi" value={t.new_contacts} accent="text-emerald-500" />
      <KpiCard icon="⌛" label="Cevap Bekliyor" value={t.waiting_replies} accent="text-orange-500" />
      <KpiCard icon="⏰" label="Aktif Hatırlatma" value={t.active_reminders} accent="text-rose-500" />
    </div>
  );
}
