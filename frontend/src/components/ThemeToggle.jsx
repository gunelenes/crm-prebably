import { useTheme } from "../ThemeContext";

const labels = {
  light: { icon: "☀️", title: "Tema: Aydınlık" },
  dark: { icon: "🌙", title: "Tema: Karanlık" },
  system: { icon: "🖥️", title: "Tema: Sistem" },
};

export default function ThemeToggle({ expanded = true }) {
  const { theme, cycle } = useTheme();
  const meta = labels[theme] || labels.system;

  return (
    <button
      onClick={cycle}
      title={`${meta.title} (değiştir)`}
      className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium
        bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
        border border-slate-200/60 dark:border-white/10
        text-slate-700 dark:text-slate-200 backdrop-blur transition-all
        ${expanded ? "w-full justify-between" : "justify-center w-full"}`}
    >
      <span className="text-base leading-none">{meta.icon}</span>
      {expanded && <span className="capitalize">{theme}</span>}
    </button>
  );
}
