import { useEffect, useState } from "react";
import api from "../../api";
import Spinner from "../../components/Spinner";
import UserSelect from "../../components/UserSelect";

const inputCls =
  "w-full rounded-xl px-3 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

export default function ContactProfileTab({ profile, sectors, trainingSets, contactId, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(profile || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(profile || {}); }, [profile]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/contacts/${contactId}`, form);
      setEditing(false);
      onSaved?.();
    } finally { setSaving(false); }
  };

  const text = (key) => profile?.[key] || "—";

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Profil Bilgileri</h3>
          <div className="flex gap-2">
            {editing && (
              <button onClick={() => { setEditing(false); setForm(profile || {}); }} disabled={saving}
                className="text-xs px-4 py-1.5 rounded-xl bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-slate-200">İptal</button>
            )}
            <button onClick={() => editing ? save() : setEditing(true)} disabled={saving}
              className={`text-xs px-4 py-1.5 rounded-xl font-medium transition-all ${editing
                ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30 hover:shadow-indigo-500/50"
                : "bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-slate-200"} disabled:opacity-60`}>
              {saving ? <Spinner /> : (editing ? "Kaydet" : "Düzenle")}
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Ad Soyad">
              {editing ? <input value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputCls} />
                : <div className="text-sm text-slate-800 dark:text-slate-100">{text("full_name")}</div>}
            </Field>
            <Field label="Telefon">
              {editing ? <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
                : <div className="text-sm text-slate-800 dark:text-slate-100">{text("phone")}</div>}
            </Field>
            <Field label="E-posta">
              {editing ? <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
                : <div className="text-sm text-slate-800 dark:text-slate-100">{text("email")}</div>}
            </Field>
            <Field label="Sorumlu Danışman">
              {editing
                ? <UserSelect value={form.assigned_to_user_id} onChange={(v) => setForm({ ...form, assigned_to_user_id: v })} placeholder="Seç" />
                : <div className="text-sm text-slate-800 dark:text-slate-100">{profile.assigned_to_user?.full_name || profile.assigned_to_user?.username || "—"}</div>}
            </Field>
            <Field label="Satın Alma Potansiyeli">
              {editing ? (
                <select value={form.purchase_potential || ""} onChange={(e) => setForm({ ...form, purchase_potential: e.target.value })} className={inputCls}>
                  <option value="">—</option>
                  <option value="düşük">Düşük</option>
                  <option value="orta">Orta</option>
                  <option value="yüksek">Yüksek</option>
                </select>
              ) : (
                <div className="text-sm text-slate-800 dark:text-slate-100">{text("purchase_potential")}</div>
              )}
            </Field>
            <Field label="Sektör">
              {editing ? (
                <select value={form.sector_id || ""} onChange={(e) => setForm({ ...form, sector_id: e.target.value ? Number(e.target.value) : null })} className={inputCls}>
                  <option value="">{sectors.length === 0 ? "Önce parametreler ekranından tanımla" : "Seç"}</option>
                  {sectors.filter((s) => s.is_active || s.id === form.sector_id).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-slate-800 dark:text-slate-100">{profile.sector?.name || "—"}</div>
              )}
            </Field>
            <Field label="Hangi Videodan / Eğitim Seti">
              {editing ? (
                <select value={form.training_set_id || ""} onChange={(e) => setForm({ ...form, training_set_id: e.target.value ? Number(e.target.value) : null })} className={inputCls}>
                  <option value="">{trainingSets.length === 0 ? "Önce parametreler ekranından tanımla" : "Seç"}</option>
                  {trainingSets.filter((t) => t.is_active || t.id === form.training_set_id).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-slate-800 dark:text-slate-100">{profile.training_set?.name || "—"}</div>
              )}
            </Field>
          </div>

          <div className="space-y-3">
            {[
              { key: "description", label: "Açıklama" },
              { key: "previous_trainings", label: "Daha Önce Aldığı Eğitimler" },
              { key: "reason_not_purchased", label: "Neden Almadı" },
            ].map(({ key, label }) => (
              <Field key={key} label={label}>
                {editing ? (
                  <textarea value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    rows={2} className={`${inputCls} resize-none`} />
                ) : (
                  <div className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{text(key)}</div>
                )}
              </Field>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200/60 dark:border-white/10">
            {[
              { key: "knows_us", label: "Bizi Tanıyor mu?" },
              { key: "had_training", label: "Daha Önce Eğitim Aldı mı?" },
              { key: "purchased", label: "Satın Aldı mı?" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-300">{label}</span>
                {editing ? (
                  <button onClick={() => setForm({ ...form, [key]: !form[key] })}
                    className={`w-10 h-5 rounded-full transition-colors ${form[key] ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${form[key] ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                ) : (
                  <span className={`text-xs font-medium ${profile[key] ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}>
                    {profile[key] ? "Evet" : "Hayır"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
