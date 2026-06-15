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

export const formatTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 60000);
  if (diff < 1) return "Az önce";
  if (diff < 60) return `${diff} dk önce`;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart - 86400000);
  if (date >= todayStart) return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (date >= yesterdayStart) return `Dün ${date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
};
