export const avatarUrl = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=random&color=fff&size=80`;

export const platformIcon = (p) =>
  p === "instagram" ? "📸" : p === "whatsapp" ? "💬" : "💌";

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
