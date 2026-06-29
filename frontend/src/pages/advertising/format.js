export const fmtCurrency = (n, cur = "TRY") =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: cur || "TRY",
    maximumFractionDigits: 0,
  }).format(n || 0);

export const fmtNum = (n) => (n ?? 0).toLocaleString("tr-TR");

export const PURPOSE_LABELS = {
  wix_kayit: "Wix Kayıt",
  ig_dm: "Instagram DM",
  wa_dm: "WhatsApp DM",
  genel: "Genel",
};

export const CHANNEL_META = {
  instagram: { label: "Instagram", icon: "📸", gradient: "bg-gradient-to-br from-fuchsia-500 to-violet-600", shadow: "shadow-fuchsia-500/30" },
  whatsapp: { label: "WhatsApp", icon: "🟢", gradient: "bg-gradient-to-br from-emerald-400 to-emerald-600", shadow: "shadow-emerald-500/30" },
  messenger: { label: "Messenger", icon: "💬", gradient: "bg-gradient-to-br from-sky-400 to-blue-600", shadow: "shadow-sky-500/30" },
  karma: { label: "Karma (IG/WA)", icon: "🔀", gradient: "bg-gradient-to-br from-amber-400 to-orange-600", shadow: "shadow-amber-500/30" },
  facebook: { label: "Facebook", icon: "📘", gradient: "bg-gradient-to-br from-blue-500 to-indigo-600", shadow: "shadow-blue-500/30" },
  other: { label: "Diğer", icon: "🔗", gradient: "bg-gradient-to-br from-slate-500 to-slate-700", shadow: "shadow-slate-500/30" },
};

// Kampanya durumu (backend `state`) → etiket + rozet/nokta stilleri. Tablo ve filtre
// chip'leri ortak kullanır. (Tabloda daha özgül `state_label` backend'den gelir.)
export const CAMPAIGN_STATE_META = {
  aktif:    { label: "Aktif",      badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dot: "bg-emerald-500" },
  durmus:   { label: "Durduruldu", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",       dot: "bg-amber-500" },
  sorunlu:  { label: "Sorunlu",    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",           dot: "bg-rose-500" },
  inceleme: { label: "İncelemede", badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",              dot: "bg-sky-500" },
  diger:    { label: "Diğer",      badge: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",       dot: "bg-slate-400" },
};

export const CAMPAIGN_STATE_ORDER = ["aktif", "durmus", "sorunlu", "inceleme", "diger"];

// İstanbul gününe göre "YYYY-MM-DD" (tarayıcı saat diliminden bağımsız; gece geç saatte gün kaymaz).
const istanbulISO = (d) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);

export const todayISO = () => istanbulISO(new Date());

export const daysAgoISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return istanbulISO(d);
};
