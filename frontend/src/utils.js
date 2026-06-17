export const avatarUrl = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=random&color=fff&size=80`;

export const platformIcon = (p) =>
  p === "instagram" ? "📸" : p === "whatsapp" ? "💬" : "💌";

export const platformLabel = (p) =>
  p === "instagram" ? "📸 Instagram" : p === "whatsapp" ? "💬 WhatsApp" : (p || "Diğer");

// Aktivite/öğe listesini kanala (platform) göre gruplar. 2+ kanal varsa bölümlenir.
// Döner: { multi: bool, groups: [{platform, items}] } — tek kanalsa tek grup.
export const groupByPlatform = (items) => {
  const order = ["instagram", "whatsapp"];
  const present = [...new Set(items.map((i) => i.platform || "").filter(Boolean))];
  const platforms = [
    ...order.filter((p) => present.includes(p)),
    ...present.filter((p) => !order.includes(p)),
  ];
  if (platforms.length <= 1) {
    return { multi: false, groups: [{ platform: platforms[0] || null, items }] };
  }
  return {
    multi: true,
    groups: platforms.map((p) => ({ platform: p, items: items.filter((i) => i.platform === p) })),
  };
};

// Tüm zaman gösterimleri İstanbul'a sabitlenir (tarayıcı/sunucu konumundan bağımsız).
export const TZ = "Europe/Istanbul";

// Bir Date'i İstanbul gününe göre "YYYY-MM-DD" biçimine çevirir (gün karşılaştırması için).
const istanbulYMD = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);

export const formatTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 60000);
  if (diff < 1) return "Az önce";
  if (diff < 60) return `${diff} dk önce`;
  const dateYMD = istanbulYMD(date);
  const todayYMD = istanbulYMD(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const opts = { timeZone: TZ, hour: "2-digit", minute: "2-digit" };
  if (dateYMD === todayYMD) return date.toLocaleTimeString("tr-TR", opts);
  if (dateYMD === istanbulYMD(yesterday)) return `Dün ${date.toLocaleTimeString("tr-TR", opts)}`;
  return date.toLocaleDateString("tr-TR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
};
