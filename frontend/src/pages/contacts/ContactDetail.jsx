import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { avatarUrl, platformIcon } from "../../utils";
import StatusModal from "../../components/StatusModal";
import ReminderModal from "../../components/ReminderModal";
import ContactProfileTab from "./ContactProfileTab";
import ContactMessagesTab from "./ContactMessagesTab";
import ContactActivityTab from "./ContactActivityTab";
import ContactRemindersTab from "./ContactRemindersTab";

const TABS = [
  { id: "profile", label: "Profil" },
  { id: "messages", label: "Mesajlar" },
  { id: "activity", label: "Aktivite" },
  { id: "reminders", label: "Hatırlatmalar" },
];

export default function ContactDetail({ contactStub, contactId, statuses, sectors, trainingSets, onChanged }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  const loadAll = async () => {
    if (!contactId) return;
    const [p, a, r] = await Promise.all([
      api.get(`/contacts/${contactId}`),
      api.get(`/contacts/${contactId}/activity`),
      api.get(`/contacts/${contactId}/reminders`),
    ]);
    setProfile(p.data);
    setActivity(a.data);
    setReminders(r.data);
  };

  useEffect(() => {
    if (!contactId) {
      setProfile(null); setActivity([]); setReminders([]);
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  if (!contactId) {
    return (
      <section className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
        <div className="text-7xl mb-4 opacity-50">👤</div>
        <div className="text-base font-medium">Bir kişi seç</div>
        <div className="text-xs mt-1 opacity-80">Soldaki listeden başla</div>
      </section>
    );
  }

  const display = profile || contactStub;
  if (!display) {
    return (
      <section className="flex-1 flex items-center justify-center">
        <div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-8 h-8" />
      </section>
    );
  }

  const refresh = () => { loadAll(); onChanged?.(); };

  return (
    <section className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/10 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <img src={avatarUrl(display.full_name || display.name)} className="w-14 h-14 rounded-full ring-2 ring-indigo-500/30 dark:ring-indigo-400/30" alt="" />
            <div className="min-w-0">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{display.full_name || display.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                <span>{platformIcon(display.platform)} {display.name}</span>
                {display.phone && <span>📞 {display.phone}</span>}
                {display.status && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] text-white font-medium" style={{ backgroundColor: display.status.color }}>
                    {display.status.name}
                  </span>
                )}
                {display.sector && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                    🏢 {display.sector.name}
                  </span>
                )}
                {(display.training_set || display.training_set_id) && profile?.training_set && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                    🎬 {profile.training_set.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setShowStatusModal(true)}
              className="text-xs px-3 py-1.5 rounded-xl bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-slate-200">
              🏷️ Statü
            </button>
            <button onClick={() => setShowReminderModal(true)}
              className="text-xs px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-300 border border-orange-500/30">
              🔔 Hatırlatma
            </button>
            <button onClick={() => navigate("/mesajlar")}
              className="text-xs px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30 hover:from-indigo-600 hover:to-violet-600">
              💬 Mesajlar'a Git
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4">
          {TABS.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`relative px-4 py-2 text-sm font-medium transition-colors ${isActive
                  ? "text-indigo-600 dark:text-indigo-300"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}>
                {t.label}
                {isActive && (
                  <span className="absolute -bottom-[1px] left-2 right-2 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Tab içerikleri */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "profile" && profile && (
          <ContactProfileTab
            profile={profile}
            sectors={sectors}
            trainingSets={trainingSets}
            onSaved={refresh}
            contactId={contactId}
          />
        )}
        {activeTab === "messages" && (
          <ContactMessagesTab
            contactId={contactId}
            conversationId={contactStub?.last_conversation_id}
            onChanged={refresh}
          />
        )}
        {activeTab === "activity" && (
          <ContactActivityTab items={activity} />
        )}
        {activeTab === "reminders" && (
          <ContactRemindersTab
            reminders={reminders}
            contactId={contactId}
            onOpenNew={() => setShowReminderModal(true)}
            onChanged={refresh}
          />
        )}
      </div>

      {showStatusModal && (
        <StatusModal
          contact={display}
          statuses={statuses}
          onClose={() => setShowStatusModal(false)}
          onSave={refresh}
        />
      )}
      {showReminderModal && (
        <ReminderModal
          contactId={contactId}
          onClose={() => setShowReminderModal(false)}
          onSave={refresh}
        />
      )}
    </section>
  );
}
