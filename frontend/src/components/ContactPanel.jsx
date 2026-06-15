import { useEffect, useState } from "react";
import api from "../api";
import { avatarUrl, formatTime, platformIcon, platformLabel, groupByPlatform } from "../utils";
import Spinner from "./Spinner";
import ReminderModal from "./ReminderModal";
import StatusModal from "./StatusModal";
import UserSelect from "./UserSelect";
import LinkContactModal from "./LinkContactModal";

const inputCls =
  "w-full rounded-lg px-3 py-1.5 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

export default function ContactPanel({ contact, statuses, sectors = [], trainingSets = [], onUpdate, onJumpToConversation }) {
  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [showReminder, setShowReminder] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!contact) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.id]);

  const loadData = async () => {
    const [p, a, r] = await Promise.all([
      api.get(`/contacts/${contact.id}`),
      api.get(`/contacts/${contact.id}/activity`),
      api.get(`/contacts/${contact.id}/reminders`),
    ]);
    setProfile(p.data);
    setForm(p.data);
    setActivity(a.data);
    setReminders(r.data);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/contacts/${contact.id}`, form);
      setEditing(false);
      await loadData();
      onUpdate();
    } finally { setSaving(false); }
  };

  const markDone = async (reminderId) => {
    await api.put(`/contacts/${contact.id}/reminders/${reminderId}/done`);
    loadData();
  };

  const unlink = async () => {
    if (!window.confirm("Bağlı hesap kaldırılsın mı?")) return;
    await api.delete(`/contacts/${contact.id}/link`);
    await loadData();
    onUpdate();
  };

  if (!contact) return (
    <div className="w-80 bg-white/40 dark:bg-slate-900/30 backdrop-blur-xl border-l border-slate-200/60 dark:border-white/10 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
      Kullanıcı seç
    </div>
  );

  const activityIcon = (type) => {
    if (type === "first_message") return "💬";
    if (type === "status_change") return "🏷️";
    if (type === "reminder") return "🔔";
    if (type === "note") return "📝";
    return "📌";
  };

  const userLabel = (item) => {
    if (item.advisor_user) return item.advisor_user.full_name || item.advisor_user.username;
    if (item.created_by) return item.created_by.full_name || item.created_by.username;
    return null;
  };

  return (
    <div className="w-80 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border-l border-slate-200/60 dark:border-white/10 flex flex-col">
      <div className="p-4 border-b border-slate-200/60 dark:border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <img src={avatarUrl(contact.name)} className="w-12 h-12 rounded-full ring-2 ring-indigo-500/30 dark:ring-indigo-400/30" alt="" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{profile?.full_name || contact.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{platformIcon(contact.platform)} {contact.name}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowStatus(true)}
            className="flex-1 text-xs py-1.5 rounded-lg backdrop-blur transition-all border bg-white/50 dark:bg-white/5"
            style={contact.status?.color
              ? { borderColor: `${contact.status.color}80`, color: contact.status.color }
              : { borderColor: "rgba(148, 163, 184, 0.5)" }}>
            {contact.status ? `🏷️ ${contact.status.name}` : "Statü Ata"}
          </button>
          <button onClick={() => setShowReminder(true)}
            className="flex-1 text-xs py-1.5 rounded-lg backdrop-blur transition-all border border-orange-500/30 text-orange-500 bg-orange-500/5 hover:bg-orange-500/10">
            🔔 Hatırlatma
          </button>
        </div>

        {/* Kanallar (IG ↔ WhatsApp birleşik profil) */}
        {profile?.linked_contact ? (
          <div className="mt-3 p-2 rounded-lg bg-sky-500/10 border border-sky-500/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wide text-sky-700 dark:text-sky-300 font-semibold">Kanallar (birleşik)</span>
              <button onClick={unlink} title="Bağlantıyı kaldır"
                className="text-xs text-slate-400 hover:text-red-500 transition-colors">✕</button>
            </div>
            <div className="space-y-1">
              {(profile.channels || []).map((ch) => (
                <div key={ch.id} className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-xs text-slate-700 dark:text-slate-200 truncate">
                    {platformIcon(ch.platform)} {ch.full_name || ch.name}
                    {ch.is_primary && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-indigo-500 text-white align-middle">Ana</span>}
                  </span>
                  {ch.id !== contact.id && ch.last_conversation_id && onJumpToConversation && (
                    <button onClick={() => onJumpToConversation(ch)}
                      className="flex-shrink-0 text-[11px] px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-700 dark:text-sky-300 hover:bg-sky-500/30 transition-colors">
                      Sohbete git
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button onClick={() => setShowLink(true)}
            className="mt-3 w-full text-xs py-1.5 rounded-lg backdrop-blur transition-all border border-sky-500/30 text-sky-600 dark:text-sky-300 bg-sky-500/5 hover:bg-sky-500/10">
            🔗 Hesap bağla (IG / WhatsApp)
          </button>
        )}
      </div>

      <div className="flex border-b border-slate-200/60 dark:border-white/10">
        {[["profile", "Profil"], ["activity", "Aktivite"], ["reminders", "Hatırlatmalar"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 text-xs font-medium transition-all relative ${activeTab === id
              ? "text-indigo-600 dark:text-indigo-300"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}>
            {label}
            {activeTab === id && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "profile" && profile && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Profil Bilgileri</span>
              <button onClick={() => editing ? save() : setEditing(true)} disabled={saving}
                className={`text-xs px-3 py-1 rounded-lg font-medium transition-all ${editing
                  ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30 disabled:opacity-60"
                  : "bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 hover:bg-white dark:hover:bg-white/10"}`}>
                {saving ? <Spinner /> : (editing ? "Kaydet" : "Düzenle")}
              </button>
            </div>
            {[
              { key: "full_name", label: "Ad Soyad" },
              { key: "phone", label: "Telefon" },
              { key: "email", label: "E-posta" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 block">{label}</label>
                {editing ? (
                  <input value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className={inputCls} />
                ) : (
                  <div className="text-sm text-slate-700 dark:text-slate-200">{profile[key] || <span className="text-slate-400 dark:text-slate-500">—</span>}</div>
                )}
              </div>
            ))}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 block">Sorumlu Danışman</label>
              {editing ? (
                <UserSelect value={form.assigned_to_user_id} onChange={(v) => setForm({ ...form, assigned_to_user_id: v })} placeholder="Seç" />
              ) : (
                <div className="text-sm text-slate-700 dark:text-slate-200">{profile.assigned_to_user?.full_name || profile.assigned_to_user?.username || <span className="text-slate-400 dark:text-slate-500">—</span>}</div>
              )}
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 block">Sektör</label>
              {editing ? (
                <select value={form.sector_id || ""} onChange={(e) => setForm({ ...form, sector_id: e.target.value ? Number(e.target.value) : null })}
                  className={inputCls}>
                  <option value="">{sectors.length === 0 ? "Önce parametreler ekranından tanımla" : "Seç"}</option>
                  {sectors.filter((s) => s.is_active || s.id === form.sector_id).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-slate-700 dark:text-slate-200">{profile.sector?.name || <span className="text-slate-400 dark:text-slate-500">—</span>}</div>
              )}
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 block">Hangi Videodan / Eğitim Seti</label>
              {editing ? (
                <select value={form.training_set_id || ""} onChange={(e) => setForm({ ...form, training_set_id: e.target.value ? Number(e.target.value) : null })}
                  className={inputCls}>
                  <option value="">{trainingSets.length === 0 ? "Önce parametreler ekranından tanımla" : "Seç"}</option>
                  {trainingSets.filter((t) => t.is_active || t.id === form.training_set_id).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-slate-700 dark:text-slate-200">{profile.training_set?.name || <span className="text-slate-400 dark:text-slate-500">—</span>}</div>
              )}
            </div>
            {["description", "previous_trainings", "reason_not_purchased"].map((key) => (
              <div key={key}>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 block">
                  {key === "description" ? "Açıklama" : key === "previous_trainings" ? "Daha Önce Aldığı Eğitimler" : "Neden Almadı"}
                </label>
                {editing ? (
                  <textarea value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    rows={2} className={`${inputCls} resize-none`} />
                ) : (
                  <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{profile[key] || <span className="text-slate-400 dark:text-slate-500">—</span>}</div>
                )}
              </div>
            ))}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 block">Satın Alma Potansiyeli</label>
              {editing ? (
                <select value={form.purchase_potential || ""} onChange={(e) => setForm({ ...form, purchase_potential: e.target.value })}
                  className={inputCls}>
                  <option value="">Seç</option>
                  <option value="düşük">Düşük</option>
                  <option value="orta">Orta</option>
                  <option value="yüksek">Yüksek</option>
                </select>
              ) : (
                <div className="text-sm text-slate-700 dark:text-slate-200">{profile.purchase_potential || <span className="text-slate-400 dark:text-slate-500">—</span>}</div>
              )}
            </div>
            <div className="space-y-2 pt-3 border-t border-slate-200/60 dark:border-white/10">
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
            {editing && (
              <button onClick={() => setEditing(false)}
                className="w-full bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 rounded-xl py-2 text-sm font-medium transition-colors">İptal</button>
            )}
          </div>
        )}

        {activeTab === "activity" && (() => {
          if (activity.length === 0) {
            return <div className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">Henüz aktivite yok</div>;
          }
          const { multi, groups } = groupByPlatform(activity);
          const renderItem = (a) => (
            <div key={a.id} className="flex gap-3 p-2 rounded-xl hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
              <div className="text-lg flex-shrink-0">{activityIcon(a.type)}</div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.title}</div>
                {a.description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{a.description}</div>}
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  {userLabel(a) && <span className="mr-2">👤 {userLabel(a)}</span>}
                  {formatTime(a.created_at)}
                </div>
              </div>
            </div>
          );
          return multi ? (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.platform} className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 px-2">{platformLabel(g.platform)}</div>
                  {g.items.map(renderItem)}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">{activity.map(renderItem)}</div>
          );
        })()}

        {activeTab === "reminders" && (
          <div className="space-y-3">
            <button onClick={() => setShowReminder(true)}
              className="w-full text-sm font-medium py-2 rounded-xl transition-all bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-300 border border-orange-500/30">
              + Yeni Hatırlatma
            </button>
            {reminders.length === 0 ? (
              <div className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">Henüz hatırlatma yok</div>
            ) : reminders.map((r) => (
              <div key={r.id} className={`p-3 rounded-xl border ${r.is_done
                ? "bg-slate-100/40 dark:bg-white/5 border-slate-200/60 dark:border-white/10 opacity-60"
                : "bg-orange-500/5 border-orange-500/20"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{r.title}</div>
                    {r.description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{r.description}</div>}
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      📅 {formatTime(r.remind_at)}
                      {userLabel(r) && <span className="ml-2">👤 {userLabel(r)}</span>}
                    </div>
                  </div>
                  {!r.is_done && (
                    <button onClick={() => markDone(r.id)}
                      className="text-xs px-2 py-1 rounded-lg flex-shrink-0 text-white bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-md shadow-emerald-500/30">✓</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showReminder && <ReminderModal contactId={contact.id} onClose={() => setShowReminder(false)} onSave={loadData} />}
      {showStatus && <StatusModal contact={contact} statuses={statuses} onClose={() => setShowStatus(false)} onSave={() => { loadData(); onUpdate(); }} />}
      {showLink && <LinkContactModal contact={profile || contact} onClose={() => setShowLink(false)} onLinked={() => { loadData(); onUpdate(); }} />}
    </div>
  );
}
