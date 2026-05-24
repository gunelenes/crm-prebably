import { useEffect, useState } from "react";
import api from "../api";
import { avatarUrl, formatTime, platformIcon } from "../utils";
import Spinner from "./Spinner";
import ReminderModal from "./ReminderModal";
import StatusModal from "./StatusModal";

export default function ContactPanel({ contact, statuses, onUpdate }) {
  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [showReminder, setShowReminder] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
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

  if (!contact) return (
    <div className="w-80 bg-white border-l border-gray-200 flex items-center justify-center text-gray-400 text-sm">
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
    if (item.created_by) return item.created_by.full_name || item.created_by.username;
    if (item.advisor) return item.advisor;
    return null;
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <img src={avatarUrl(contact.name)} className="w-12 h-12 rounded-full" alt="" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-800 text-sm truncate">{profile?.full_name || contact.name}</div>
            <div className="text-xs text-gray-500">{platformIcon(contact.platform)} {contact.name}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowStatus(true)}
            className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            style={{ borderColor: contact.status?.color, color: contact.status?.color }}>
            {contact.status ? `🏷️ ${contact.status.name}` : "Statü Ata"}
          </button>
          <button onClick={() => setShowReminder(true)}
            className="flex-1 text-xs py-1.5 rounded-lg border border-orange-200 hover:bg-gray-50 transition-colors text-orange-500">
            🔔 Hatırlatma
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        {[["profile", "Profil"], ["activity", "Aktivite"], ["reminders", "Hatırlatmalar"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === id ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "profile" && profile && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Profil Bilgileri</span>
              <button onClick={() => editing ? save() : setEditing(true)} disabled={saving}
                className={`text-xs px-3 py-1 rounded-lg font-medium ${editing ? "bg-blue-500 text-white disabled:bg-blue-300" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {saving ? <Spinner /> : (editing ? "Kaydet" : "Düzenle")}
              </button>
            </div>
            {[
              { key: "full_name", label: "Ad Soyad" },
              { key: "phone", label: "Telefon" },
              { key: "sector", label: "Sektör" },
              { key: "source_video", label: "Hangi Videodan" },
              { key: "assigned_to", label: "Sorumlu Danışman" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                {editing ? (
                  <input value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                ) : (
                  <div className="text-sm text-gray-700">{profile[key] || <span className="text-gray-400">—</span>}</div>
                )}
              </div>
            ))}
            {["description", "previous_trainings", "reason_not_purchased"].map((key) => (
              <div key={key}>
                <label className="text-xs text-gray-400 mb-1 block">
                  {key === "description" ? "Açıklama" : key === "previous_trainings" ? "Daha Önce Aldığı Eğitimler" : "Neden Almadı"}
                </label>
                {editing ? (
                  <textarea value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:border-blue-400" />
                ) : (
                  <div className="text-sm text-gray-700">{profile[key] || <span className="text-gray-400">—</span>}</div>
                )}
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Satın Alma Potansiyeli</label>
              {editing ? (
                <select value={form.purchase_potential || ""} onChange={(e) => setForm({ ...form, purchase_potential: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400">
                  <option value="">Seç</option>
                  <option value="düşük">Düşük</option>
                  <option value="orta">Orta</option>
                  <option value="yüksek">Yüksek</option>
                </select>
              ) : (
                <div className="text-sm text-gray-700">{profile.purchase_potential || <span className="text-gray-400">—</span>}</div>
              )}
            </div>
            <div className="space-y-2 pt-2 border-t border-gray-100">
              {[
                { key: "knows_us", label: "Bizi Tanıyor mu?" },
                { key: "had_training", label: "Daha Önce Eğitim Aldı mı?" },
                { key: "purchased", label: "Satın Aldı mı?" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">{label}</span>
                  {editing ? (
                    <button onClick={() => setForm({ ...form, [key]: !form[key] })}
                      className={`w-10 h-5 rounded-full transition-colors ${form[key] ? "bg-green-500" : "bg-gray-300"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${form[key] ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  ) : (
                    <span className={`text-xs font-medium ${profile[key] ? "text-green-600" : "text-gray-400"}`}>
                      {profile[key] ? "Evet" : "Hayır"}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {editing && (
              <button onClick={() => setEditing(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2 text-sm font-medium">İptal</button>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="space-y-3">
            {activity.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">Henüz aktivite yok</div>
            ) : activity.map((a) => (
              <div key={a.id} className="flex gap-3">
                <div className="text-lg flex-shrink-0">{activityIcon(a.type)}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">{a.title}</div>
                  {a.description && <div className="text-xs text-gray-500 mt-0.5">{a.description}</div>}
                  <div className="text-xs text-gray-400 mt-1">
                    {userLabel(a) && <span className="mr-2">👤 {userLabel(a)}</span>}
                    {formatTime(a.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "reminders" && (
          <div className="space-y-3">
            <button onClick={() => setShowReminder(true)}
              className="w-full bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 rounded-xl py-2 text-sm font-medium transition-colors">
              + Yeni Hatırlatma
            </button>
            {reminders.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">Henüz hatırlatma yok</div>
            ) : reminders.map((r) => (
              <div key={r.id} className={`p-3 rounded-xl border ${r.is_done ? "bg-gray-50 border-gray-200 opacity-60" : "bg-orange-50 border-orange-200"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{r.title}</div>
                    {r.description && <div className="text-xs text-gray-500 mt-0.5">{r.description}</div>}
                    <div className="text-xs text-gray-400 mt-1">
                      📅 {formatTime(r.remind_at)}
                      {userLabel(r) && <span className="ml-2">👤 {userLabel(r)}</span>}
                    </div>
                  </div>
                  {!r.is_done && (
                    <button onClick={() => markDone(r.id)}
                      className="text-xs bg-green-500 text-white px-2 py-1 rounded-lg flex-shrink-0">✓</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showReminder && <ReminderModal contactId={contact.id} onClose={() => setShowReminder(false)} onSave={loadData} />}
      {showStatus && <StatusModal contact={contact} statuses={statuses} onClose={() => setShowStatus(false)} onSave={() => { loadData(); onUpdate(); }} />}
    </div>
  );
}
