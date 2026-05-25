import { useEffect, useState } from "react";
import api from "../api";

const inputCls =
  "w-full rounded-xl px-3 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

let cachedUsers = null;
let cachePromise = null;

async function loadUsers() {
  if (cachedUsers) return cachedUsers;
  if (cachePromise) return cachePromise;
  cachePromise = api.get("/users/active").then((r) => {
    cachedUsers = r.data;
    cachePromise = null;
    return cachedUsers;
  });
  return cachePromise;
}

export default function UserSelect({ value, onChange, placeholder = "Danışman seç", className = "", required = false }) {
  const [users, setUsers] = useState(cachedUsers || []);
  const [loading, setLoading] = useState(!cachedUsers);

  useEffect(() => {
    let cancelled = false;
    loadUsers().then((list) => {
      if (!cancelled) {
        setUsers(list);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      required={required}
      disabled={loading}
      className={`${inputCls} ${className}`}
    >
      <option value="">{loading ? "Yükleniyor..." : placeholder}</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.full_name || u.username}{u.role === "admin" ? " (admin)" : ""}
        </option>
      ))}
    </select>
  );
}
