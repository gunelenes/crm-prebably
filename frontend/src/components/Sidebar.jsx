import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import ThemeToggle from "./ThemeToggle";
import RemindersBell from "./RemindersBell";

const menuItems = [
  { to: "/dashboard", icon: "🏠", label: "Anasayfa" },
  { to: "/mesajlar", icon: "💬", label: "Mesajlar" },
  { to: "/kisiler", icon: "👤", label: "Kişiler" },
  { to: "/odemeler", icon: "💳", label: "Ödemeler", adminOnly: true },
  { to: "/hazir-mesajlar", icon: "⚡", label: "Hazır Mesajlar" },
  { to: "/parametreler", icon: "⚙️", label: "Parametreler" },
  { to: "/kullanicilar", icon: "👥", label: "Kullanıcılar", adminOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  const visible = menuItems.filter((m) => !m.adminOnly || user?.role === "admin");

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside
      className={`${open ? "w-60" : "w-16"} flex-shrink-0 transition-all duration-300
        bg-white/70 dark:bg-slate-950/60 backdrop-blur-2xl
        border-r border-slate-200/60 dark:border-white/10
        flex flex-col`}
    >
      {/* Logo + toggle */}
      <div className={`flex items-center ${open ? "justify-between" : "justify-center"} p-4`}>
        {open && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white text-sm font-bold">
              C
            </div>
            <span className="font-bold text-base bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-violet-500">
              CRM
            </span>
          </div>
        )}
        <button
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          title={open ? "Daralt" : "Genişlet"}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {/* Menü */}
      <nav className="flex-1 px-3 space-y-1">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-gradient-to-r from-indigo-500/15 to-violet-500/15 text-indigo-700 dark:text-indigo-300 shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-500" />
                )}
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                {open && <span>{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer: reminders + theme toggle + user + logout */}
      <div className="p-3 border-t border-slate-200/60 dark:border-white/10 space-y-2">
        <RemindersBell expanded={open} />
        <ThemeToggle expanded={open} />
        {open ? (
          <div className="rounded-xl p-3 bg-white/60 dark:bg-white/5 backdrop-blur border border-slate-200/60 dark:border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-semibold shadow-md shadow-indigo-500/30">
                {(user?.full_name || user?.username || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">
                  {user?.full_name || user?.username}
                </div>
                {user?.role === "admin" && (
                  <div className="text-[10px] uppercase tracking-wider text-indigo-500 dark:text-indigo-400 font-semibold">
                    Admin
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-xs font-medium rounded-lg py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              ⎋ Çıkış Yap
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            title="Çıkış"
            className="w-full text-rose-500 hover:text-rose-400 text-lg py-1 transition-colors"
          >
            ⎋
          </button>
        )}
      </div>
    </aside>
  );
}
