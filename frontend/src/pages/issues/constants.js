export const PRIORITIES = [
  { id: "dusuk", label: "Düşük", dot: "bg-slate-400", chip: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
  { id: "orta", label: "Orta", dot: "bg-amber-400", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { id: "yuksek", label: "Yüksek", dot: "bg-rose-500", chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
];

export const priorityMeta = (id) => PRIORITIES.find((p) => p.id === id) || PRIORITIES[1];

export const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;
