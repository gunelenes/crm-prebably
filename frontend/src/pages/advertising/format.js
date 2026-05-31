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
  facebook: { label: "Facebook", icon: "📘", gradient: "bg-gradient-to-br from-blue-500 to-indigo-600", shadow: "shadow-blue-500/30" },
  other: { label: "Diğer", icon: "🔗", gradient: "bg-gradient-to-br from-slate-500 to-slate-700", shadow: "shadow-slate-500/30" },
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const daysAgoISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
