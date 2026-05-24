import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const menuItems = [
  { to: "/mesajlar", icon: "💬", label: "Mesajlar" },
  { to: "/hazir-mesajlar", icon: "⚡", label: "Hazır Mesajlar" },
  { to: "/parametreler", icon: "⚙️", label: "Parametreler" },
  { to: "/kullanicilar", icon: "👥", label: "Kullanıcılar", adminOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const visible = menuItems.filter((m) => !m.adminOnly || user?.role === "admin");

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className={`${open ? "w-52" : "w-16"} bg-gray-900 flex flex-col transition-all duration-200 flex-shrink-0`}>
      <button onClick={() => setOpen(!open)}
        className="p-4 text-gray-400 hover:text-white transition-colors text-xl">
        {open ? "✕" : "☰"}
      </button>
      <nav className="flex-1 px-2 space-y-1">
        {visible.map((item) => (
          <NavLink key={item.to} to={item.to}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`
            }>
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            {open && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-800">
        {open ? (
          <div className="space-y-2">
            <div className="text-gray-300 text-xs truncate" title={user?.username}>
              👤 {user?.full_name || user?.username}
              {user?.role === "admin" && <span className="ml-1 text-blue-400">(admin)</span>}
            </div>
            <button onClick={handleLogout}
              className="w-full bg-gray-800 hover:bg-red-600 text-gray-300 hover:text-white text-xs rounded-lg py-1.5">
              Çıkış Yap
            </button>
          </div>
        ) : (
          <button onClick={handleLogout} title="Çıkış"
            className="w-full text-gray-400 hover:text-red-400 text-lg py-1">
            ⎋
          </button>
        )}
      </div>
    </div>
  );
}
