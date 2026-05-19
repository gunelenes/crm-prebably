import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000/api";

// ── Yardımcı Fonksiyonlar ─────────────────────────────────────────
const avatarUrl = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=random&color=fff&size=80`;

const platformIcon = (p) => p === "instagram" ? "📸" : p === "whatsapp" ? "💬" : "💌";

const formatTime = (dateStr) => {
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

// ── Reminder Modal ────────────────────────────────────────────────
function ReminderModal({ contactId, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [advisor, setAdvisor] = useState("");

  const save = async () => {
    if (!title.trim() || !remindAt) return;
    await axios.post(`${API}/contacts/${contactId}/reminders`, {
      title, description, remind_at: remindAt, advisor
    });
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-gray-800 text-lg mb-4">🔔 Hatırlatma Oluştur</h3>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Başlık (örn. Ara, Takip et...)"
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400" />
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Not..." rows={2}
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 resize-none focus:outline-none focus:border-blue-400" />
        <input type="datetime-local" value={remindAt} onChange={e => setRemindAt(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400" />
        <input value={advisor} onChange={e => setAdvisor(e.target.value)}
          placeholder="Danışman adı"
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-4 focus:outline-none focus:border-blue-400" />
        <div className="flex gap-2">
          <button onClick={save} disabled={!title.trim() || !remindAt}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl py-2 text-sm font-medium">
            Kaydet
          </button>
          <button onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2 text-sm font-medium">
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Statü Değişim Modal ───────────────────────────────────────────
function StatusModal({ contact, statuses, onClose, onSave }) {
  const [selectedStatus, setSelectedStatus] = useState(contact?.status_id || "");
  const [note, setNote] = useState("");
  const [advisor, setAdvisor] = useState("");

  const save = async () => {
      console.log("Contact:", contact);
      console.log("Contact ID:", contact?.id);
      console.log("Selected Status:", selectedStatus);
      
      if (!contact?.id) {
        alert("Contact ID bulunamadı: " + JSON.stringify(contact));
        return;
      }
      
      await axios.put(`${API}/contacts/${contact.id}/status`, {
        status_id: selectedStatus || null,
        note, advisor
      });
      onSave();
      onClose();
    };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-gray-800 text-lg mb-4">🏷️ Statü Değiştir</h3>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {statuses.filter(s => s.is_active).map(s => (
            <button key={s.id} onClick={() => setSelectedStatus(s.id)}
              className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${selectedStatus === s.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
              <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="Açıklama (zorunlu değil)..." rows={2}
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 resize-none focus:outline-none focus:border-blue-400" />
        <input value={advisor} onChange={e => setAdvisor(e.target.value)}
          placeholder="Danışman adı"
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-4 focus:outline-none focus:border-blue-400" />
        <div className="flex gap-2">
          <button onClick={save}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-2 text-sm font-medium">
            Kaydet
          </button>
          <button onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2 text-sm font-medium">
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sağ Panel — Kullanıcı Profili ────────────────────────────────
function ContactPanel({ contact, statuses, onUpdate }) {
  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [showReminder, setShowReminder] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    if (!contact) return;
    loadData();
  }, [contact?.id]);

  const loadData = async () => {
    const [p, a, r] = await Promise.all([
      axios.get(`${API}/contacts/${contact.id}`),
      axios.get(`${API}/contacts/${contact.id}/activity`),
      axios.get(`${API}/contacts/${contact.id}/reminders`),
    ]);
    setProfile(p.data);
    setForm(p.data);
    setActivity(a.data);
    setReminders(r.data);
  };

  const save = async () => {
    await axios.put(`${API}/contacts/${contact.id}`, form);
    setEditing(false);
    loadData();
    onUpdate();
  };

  const markDone = async (reminderId) => {
    await axios.put(`${API}/contacts/${contact.id}/reminders/${reminderId}/done`);
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

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      {/* Üst — Avatar ve statü */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <img src={avatarUrl(contact.name)} className="w-12 h-12 rounded-full" />
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
            className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-orange-500 border-orange-200">
            🔔 Hatırlatma
          </button>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="flex border-b border-gray-200">
        {[["profile", "Profil"], ["activity", "Aktivite"], ["reminders", "Hatırlatmalar"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === id ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* İçerik */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* Profil */}
        {activeTab === "profile" && profile && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Profil Bilgileri</span>
              <button onClick={() => editing ? save() : setEditing(true)}
                className={`text-xs px-3 py-1 rounded-lg font-medium ${editing ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {editing ? "Kaydet" : "Düzenle"}
              </button>
            </div>

            {[
              { key: "full_name", label: "Ad Soyad", type: "text" },
              { key: "phone", label: "Telefon", type: "text" },
              { key: "sector", label: "Sektör", type: "text" },
              { key: "source_video", label: "Hangi Videodan", type: "text" },
              { key: "assigned_to", label: "Sorumlu Danışman", type: "text" },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                {editing ? (
                  <input type={type} value={form[key] || ""} onChange={e => setForm({ ...form, [key]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                ) : (
                  <div className="text-sm text-gray-700">{profile[key] || <span className="text-gray-400">—</span>}</div>
                )}
              </div>
            ))}

            {/* Açıklama */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Açıklama</label>
              {editing ? (
                <textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:border-blue-400" />
              ) : (
                <div className="text-sm text-gray-700">{profile.description || <span className="text-gray-400">—</span>}</div>
              )}
            </div>

            {/* Eğitimler */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Daha Önce Aldığı Eğitimler</label>
              {editing ? (
                <textarea value={form.previous_trainings || ""} onChange={e => setForm({ ...form, previous_trainings: e.target.value })}
                  rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:border-blue-400" />
              ) : (
                <div className="text-sm text-gray-700">{profile.previous_trainings || <span className="text-gray-400">—</span>}</div>
              )}
            </div>

            {/* Neden Almadı */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Neden Almadı</label>
              {editing ? (
                <textarea value={form.reason_not_purchased || ""} onChange={e => setForm({ ...form, reason_not_purchased: e.target.value })}
                  rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:border-blue-400" />
              ) : (
                <div className="text-sm text-gray-700">{profile.reason_not_purchased || <span className="text-gray-400">—</span>}</div>
              )}
            </div>

            {/* Satın alma potansiyeli */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Satın Alma Potansiyeli</label>
              {editing ? (
                <select value={form.purchase_potential || ""} onChange={e => setForm({ ...form, purchase_potential: e.target.value })}
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

            {/* Toggle'lar */}
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
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2 text-sm font-medium">
                İptal
              </button>
            )}
          </div>
        )}

        {/* Aktivite */}
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
                    {a.advisor && <span className="mr-2">👤 {a.advisor}</span>}
                    {formatTime(a.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hatırlatmalar */}
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
                      {r.advisor && <span className="ml-2">👤 {r.advisor}</span>}
                    </div>
                  </div>
                  {!r.is_done && (
                    <button onClick={() => markDone(r.id)}
                      className="text-xs bg-green-500 text-white px-2 py-1 rounded-lg flex-shrink-0">
                      ✓
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modaller */}
      {showReminder && (
        <ReminderModal contactId={contact.id} onClose={() => setShowReminder(false)} onSave={loadData} />
      )}
      {showStatus && (
        <StatusModal contact={contact} statuses={statuses} onClose={() => setShowStatus(false)}
          onSave={() => { loadData(); onUpdate(); }} />
      )}
    </div>
  );
}

// ── Mesajlar Sayfası ─────────────────────────────────────────────
function MessagesPage({ conversations, selected, setSelected, messages, window24, replyText, setReplyText, sending, sendReply, handleKeyDown, quickReplies, syncing, syncConversations, lastSync, statuses, onContactUpdate }) {
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);

  const statusCounts = statuses.reduce((acc, s) => {
    acc[s.id] = conversations.filter(c => c.contact.status_id === s.id).length;
    return acc;
  }, {});

  const filteredConversations = activeFilter
    ? conversations.filter(c => c.contact.status_id === activeFilter)
    : conversations;

  return (
    <div className="flex flex-1 overflow-hidden flex-col">

      {/* Üst — Statü filtreleri */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2 overflow-x-auto">
        <button onClick={() => setActiveFilter(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!activeFilter ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          Tümü ({conversations.length})
        </button>
        {statuses.filter(s => s.is_active).map(s => (
          <button key={s.id} onClick={() => setActiveFilter(activeFilter === s.id ? null : s.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeFilter === s.id ? "text-white" : "text-white opacity-70 hover:opacity-100"}`}
            style={{ backgroundColor: s.color }}>
            {s.name} ({statusCounts[s.id] || 0})
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sol panel */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
            <p className="text-white text-sm font-medium">{filteredConversations.length} konuşma</p>
            <button onClick={syncConversations} disabled={syncing}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg px-2 py-1 text-xs">
              <span className={syncing ? "animate-spin inline-block" : ""}>🔄</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.map((conv) => (
              <div key={conv.id} onClick={() => setSelected(conv)}
                className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${selected?.id === conv.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}`}>
                <div className="flex items-start gap-2">
                  <img src={avatarUrl(conv.contact.name)} className="w-9 h-9 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-800 text-xs truncate">{conv.contact.full_name || conv.contact.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-1">{formatTime(conv.last_message_at)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-500 truncate">{conv.last_message || "Mesaj yok"}</span>
                      {conv.unread_count > 0 && (
                        <span className="bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 flex-shrink-0 ml-1">{conv.unread_count}</span>
                      )}
                    </div>
                    {conv.contact.status && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs text-white"
                        style={{ backgroundColor: conv.contact.status.color }}>
                        {conv.contact.status.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Orta — Mesajlar */}
        <div className="flex-1 flex flex-col">
          {selected ? (
            <>
              <div className="bg-white border-b border-gray-200 p-3 flex items-center gap-3">
                <img src={avatarUrl(selected.contact.name)} className="w-9 h-9 rounded-full" />
                <div className="flex-1">
                  <div className="font-medium text-gray-800 text-sm">{selected.contact.full_name || selected.contact.name}</div>
                  <div className="text-xs text-gray-500">{platformIcon(selected.platform)} {selected.contact.name}</div>
                </div>
                {window24 && (
                  <div className={`text-xs px-2 py-1 rounded-full font-medium ${window24.open ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {window24.open ? "✅" : "⛔"} {window24.message}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-sm px-4 py-2 rounded-2xl text-sm ${msg.direction === "outbound" ? "bg-blue-500 text-white rounded-br-sm" : "bg-white text-gray-800 shadow-sm rounded-bl-sm"}`}>
                      <div>{msg.content}</div>
                      <div className={`text-xs mt-1 ${msg.direction === "outbound" ? "text-blue-200" : "text-gray-400"}`}>{formatTime(msg.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white border-t border-gray-200 p-3">
                {window24 && !window24.open ? (
                  <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
                    <div className="text-xl">⛔</div>
                    <div>
                      <div className="font-medium text-red-700 text-sm">Mesajlaşma penceresi kapandı</div>
                      <div className="text-red-400 text-xs mt-0.5">Müşteri tekrar yazarsa açılır.</div>
                    </div>
                  </div>
                ) : (
                  <>
                    {showQuickReplies && quickReplies.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {quickReplies.map((qr) => (
                          <button key={qr.id} onClick={() => { setReplyText(qr.content); setShowQuickReplies(false); }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-3 py-1.5 rounded-full border border-blue-200">
                            {qr.title}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <button onClick={() => setShowQuickReplies(!showQuickReplies)}
                        className={`p-2 rounded-xl border transition-colors ${showQuickReplies ? "bg-blue-500 text-white border-blue-500" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                        ⚡
                      </button>
                      <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={handleKeyDown} placeholder="Mesaj yaz..." rows={2}
                        className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                      <button onClick={sendReply} disabled={sending || !replyText.trim()}
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl px-4 py-2 text-sm font-medium">
                        {sending ? "..." : "Gönder"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <div className="text-6xl mb-4">💬</div>
              <div className="text-lg font-medium">Konuşma seç</div>
            </div>
          )}
        </div>

        {/* Sağ panel — Kullanıcı profili */}
        <ContactPanel
          contact={selected?.contact}
          statuses={statuses}
          onUpdate={onContactUpdate}
        />
      </div>
    </div>
  );
}

// ── Hazır Mesajlar Sayfası ────────────────────────────────────────
function QuickRepliesPage({ quickReplies, setQuickReplies }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(null);

  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    if (editing) {
      await axios.put(`${API}/quick-replies/${editing}`, { title, content });
    } else {
      await axios.post(`${API}/quick-replies`, { title, content });
    }
    const res = await axios.get(`${API}/quick-replies`);
    setQuickReplies(res.data);
    setTitle(""); setContent(""); setEditing(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Hazır Mesajlar</h2>
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="font-medium text-gray-700 mb-4">{editing ? "Düzenle" : "Yeni Hazır Mesaj"}</h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlık"
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Mesaj içeriği..." rows={3}
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 resize-none focus:outline-none focus:border-blue-400" />
        <div className="flex gap-2">
          <button onClick={save} disabled={!title.trim() || !content.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl px-5 py-2 text-sm font-medium">
            {editing ? "Güncelle" : "Ekle"}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setTitle(""); setContent(""); }}
              className="bg-gray-100 text-gray-700 rounded-xl px-5 py-2 text-sm font-medium">İptal</button>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {quickReplies.map((qr) => (
          <div key={qr.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4">
            <div className="flex-1">
              <div className="font-medium text-gray-800 text-sm mb-1">{qr.title}</div>
              <div className="text-gray-500 text-sm">{qr.content}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(qr.id); setTitle(qr.title); setContent(qr.content); }}
                className="text-blue-500 hover:bg-blue-50 rounded-lg px-3 py-1 text-xs">Düzenle</button>
              <button onClick={async () => { await axios.delete(`${API}/quick-replies/${qr.id}`); setQuickReplies(p => p.filter(q => q.id !== qr.id)); }}
                className="text-red-500 hover:bg-red-50 rounded-lg px-3 py-1 text-xs">Sil</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Statüler Sayfası ──────────────────────────────────────────────
function StatusesPage({ statuses, setStatuses }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [editing, setEditing] = useState(null);

  const save = async () => {
    if (!name.trim()) return;
    if (editing) {
      await axios.put(`${API}/statuses/${editing}`, { name, color });
    } else {
      await axios.post(`${API}/statuses`, { name, color });
    }
    const res = await axios.get(`${API}/statuses`);
    setStatuses(res.data);
    setName(""); setColor("#3B82F6"); setEditing(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Statüler</h2>
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex gap-3 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Statü adı"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400" />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-1" />
        </div>
        {name && (
          <div className="mb-3">
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: color }}>{name}</span>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={save} disabled={!name.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl px-5 py-2 text-sm font-medium">
            {editing ? "Güncelle" : "Ekle"}
          </button>
          {editing && <button onClick={() => { setEditing(null); setName(""); setColor("#3B82F6"); }}
            className="bg-gray-100 text-gray-700 rounded-xl px-5 py-2 text-sm font-medium">İptal</button>}
        </div>
      </div>
      <div className="space-y-3">
        {statuses.map((s) => (
          <div key={s.id} className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 ${!s.is_active ? "opacity-50" : ""}`}>
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <div className="flex-1">
              <span className="font-medium text-gray-800 text-sm">{s.name}</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {s.is_active ? "Aktif" : "Pasif"}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={async () => { await axios.put(`${API}/statuses/${s.id}`, { ...s, is_active: !s.is_active }); const r = await axios.get(`${API}/statuses`); setStatuses(r.data); }}
                className={`text-xs px-3 py-1 rounded-lg ${s.is_active ? "text-orange-500 hover:bg-orange-50" : "text-green-500 hover:bg-green-50"}`}>
                {s.is_active ? "Pasif Yap" : "Aktif Yap"}
              </button>
              <button onClick={() => { setEditing(s.id); setName(s.name); setColor(s.color); }}
                className="text-blue-500 hover:bg-blue-50 rounded-lg px-3 py-1 text-xs">Düzenle</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ana App ───────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("messages");
  const [menuOpen, setMenuOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [window24, setWindow24] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [quickReplies, setQuickReplies] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [activeReminders, setActiveReminders] = useState([]);

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API}/conversations`);
      setConversations(res.data);
    } catch (err) { console.error(err); }
  };

  const syncConversations = async () => {
    setSyncing(true);
    try {
      await axios.post(`${API}/sync-conversations`);
      await fetchConversations();
      setLastSync(new Date());
    } catch (err) { console.error(err); }
    setSyncing(false);
  };

  const checkReminders = async () => {
    try {
      const res = await axios.get(`${API}/reminders/active`);
      setActiveReminders(res.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchConversations();
    axios.get(`${API}/quick-replies`).then(r => setQuickReplies(r.data));
    axios.get(`${API}/statuses`).then(r => setStatuses(r.data));
    checkReminders();
    const interval = setInterval(fetchConversations, 5000);
    const reminderInterval = setInterval(checkReminders, 60000);
    return () => { clearInterval(interval); clearInterval(reminderInterval); };
  }, []);

  useEffect(() => {
    const doSync = async () => {
      setSyncing(true);
      try { await axios.post(`${API}/sync-conversations`); setLastSync(new Date()); } catch (e) {}
      setSyncing(false);
      fetchConversations();
    };
    doSync();
    const interval = setInterval(doSync, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selected) return;
    axios.get(`${API}/conversations/${selected.id}/messages`).then(r => setMessages(r.data));
    axios.get(`${API}/conversations/${selected.id}/window`).then(r => setWindow24(r.data));
  }, [selected?.id]);

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return;
    setSending(true);
    try {
      const res = await axios.post(`${API}/conversations/${selected.id}/reply`, { text: replyText });
      if (res.data.status === "ok") {
        setReplyText("");
        const [m, w] = await Promise.all([
          axios.get(`${API}/conversations/${selected.id}/messages`),
          axios.get(`${API}/conversations/${selected.id}/window`)
        ]);
        setMessages(m.data);
        setWindow24(w.data);
        fetchConversations();
      } else alert("Hata: " + res.data.error);
    } catch { alert("Mesaj gönderilemedi!"); }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
  };

  const menuItems = [
    { id: "messages", icon: "💬", label: "Mesajlar" },
    { id: "quickreplies", icon: "⚡", label: "Hazır Mesajlar" },
    { id: "statuses", icon: "🏷️", label: "Statüler" },
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-sans">

      {/* Aktif hatırlatma bildirimi */}
      {activeReminders.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {activeReminders.map(r => (
            <div key={r.id} className="bg-orange-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-sm">
              <span className="text-xl">🔔</span>
              <div className="flex-1">
                <div className="font-medium text-sm">{r.title}</div>
                <div className="text-xs opacity-80">{r.advisor}</div>
              </div>
              <button onClick={async () => {
                await axios.put(`${API}/contacts/${r.contact_id}/reminders/${r.id}/done`);
                setActiveReminders(p => p.filter(x => x.id !== r.id));
              }} className="text-white hover:text-orange-200 text-lg">✓</button>
            </div>
          ))}
        </div>
      )}

      {/* Sidebar */}
      <div className={`${menuOpen ? "w-48" : "w-16"} bg-gray-900 flex flex-col transition-all duration-200`}>
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="p-4 text-gray-400 hover:text-white transition-colors text-xl">
          {menuOpen ? "✕" : "☰"}
        </button>
        <nav className="flex-1 px-2 space-y-1">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => { setPage(item.id); setMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                page === item.id ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}>
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {menuOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        {menuOpen && <div className="p-4 text-gray-600 text-xs">CRM v1.0</div>}
      </div>

      {/* İçerik */}
      {page === "messages" && (
        <MessagesPage
          conversations={conversations} selected={selected} setSelected={setSelected}
          messages={messages} window24={window24} replyText={replyText} setReplyText={setReplyText}
          sending={sending} sendReply={sendReply} handleKeyDown={handleKeyDown}
          quickReplies={quickReplies} syncing={syncing} syncConversations={syncConversations}
          lastSync={lastSync} statuses={statuses} onContactUpdate={fetchConversations}
        />
      )}
      {page === "quickreplies" && (
        <QuickRepliesPage quickReplies={quickReplies} setQuickReplies={setQuickReplies} />
      )}
      {page === "statuses" && (
        <StatusesPage statuses={statuses} setStatuses={setStatuses} />
      )}
    </div>
  );
}