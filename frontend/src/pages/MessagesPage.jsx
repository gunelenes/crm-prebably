import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import api, { SOCKET_URL } from "../api";
import { avatarUrl, formatTime, platformIcon } from "../utils";
import { ConversationSkeleton, MessageSkeleton } from "../components/Skeletons";
import ContactPanel from "../components/ContactPanel";

export default function MessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [window24, setWindow24] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [trainingSets, setTrainingSets] = useState([]);
  const [activeReminders, setActiveReminders] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  const fetchTimeoutRef = useRef(null);
  const selectedRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const fetchConversations = () => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get("/conversations");
        setConversations(res.data);
      } catch (err) { console.error(err); }
      finally { setInitialLoad(false); }
    }, 500);
  };

  const dismissReply = async (convId) => {
    setConversations((prev) => prev.map((c) =>
      c.id === convId ? { ...c, waiting_for_reply: false } : c
    ));
    try {
      await api.post(`/conversations/${convId}/dismiss-reply`);
    } catch (err) {
      console.error(err);
      fetchConversations();
    }
  };

  const syncConversations = async () => {
    setSyncing(true);
    try {
      await api.post("/sync-conversations");
      await fetchConversations();
    } catch (err) { console.error(err); }
    setSyncing(false);
  };

  const checkReminders = async () => {
    try {
      const res = await api.get("/reminders/active");
      setActiveReminders(res.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchConversations();
    api.get("/quick-replies").then((r) => setQuickReplies(r.data));
    api.get("/statuses").then((r) => setStatuses(r.data));
    api.get("/sectors").then((r) => setSectors(r.data));
    api.get("/training-sets").then((r) => setTrainingSets(r.data));
    checkReminders();
    const interval = setInterval(fetchConversations, 10000);
    const reminderInterval = setInterval(checkReminders, 60000);
    return () => { clearInterval(interval); clearInterval(reminderInterval); };
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      auth: { token: localStorage.getItem("token") },
    });
    socket.on("new_message", (data) => {
      fetchConversations();
      const s = selectedRef.current;
      const isForSelected = data.conversation_id != null
        ? s?.id === data.conversation_id
        : s?.contact?.external_id === data.sender_id;
      if (isForSelected) {
        api.get(`/conversations/${s.id}/messages`).then((r) => setMessages(r.data));
        api.get(`/conversations/${s.id}/window`).then((r) => setWindow24(r.data));
      }
    });
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const doSync = async () => {
      setSyncing(true);
      try { await api.post("/sync-conversations"); } catch (e) {}
      setSyncing(false);
      fetchConversations();
    };
    const interval = setInterval(doSync, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selected) return;
    setMessagesLoading(true);
    setMessages([]);
    Promise.all([
      api.get(`/conversations/${selected.id}/messages`),
      api.get(`/conversations/${selected.id}/window`),
    ]).then(([m, w]) => {
      setMessages(m.data);
      setWindow24(w.data);
    }).finally(() => setMessagesLoading(false));
  }, [selected?.id]);

  useEffect(() => {
    if (selected) messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [selected?.id]);

  useEffect(() => {
    if (!messagesLoading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, messagesLoading]);

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return;
    const text = replyText;
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId, content: text, direction: "outbound",
      timestamp: new Date().toISOString(), is_read: true, message_type: "text", _pending: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setReplyText("");
    setSending(true);
    try {
      const res = await api.post(`/conversations/${selected.id}/reply`, { text });
      if (res.data.status === "ok") {
        const [m, w] = await Promise.all([
          api.get(`/conversations/${selected.id}/messages`),
          api.get(`/conversations/${selected.id}/window`),
        ]);
        setMessages(m.data);
        setWindow24(w.data);
        fetchConversations();
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setReplyText(text);
        alert("Hata: " + res.data.error);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setReplyText(text);
      alert("Mesaj gönderilemedi!");
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
  };

  const dismissReminder = async (r) => {
    await api.put(`/contacts/${r.contact_id}/reminders/${r.id}/done`);
    setActiveReminders((p) => p.filter((x) => x.id !== r.id));
  };

  const statusCounts = statuses.reduce((acc, s) => {
    acc[s.id] = conversations.filter((c) => c.contact.status_id === s.id).length;
    return acc;
  }, {});
  const filteredConversations = activeFilter
    ? conversations.filter((c) => c.contact.status_id === activeFilter)
    : conversations;

  return (
    <div className="flex flex-1 overflow-hidden flex-col">
      {activeReminders.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {activeReminders.map((r) => (
            <div key={r.id} className="px-4 py-3 rounded-2xl shadow-2xl shadow-orange-500/40 flex items-center gap-3 max-w-sm bg-gradient-to-br from-orange-400 to-amber-500 text-white backdrop-blur">
              <span className="text-xl">🔔</span>
              <div className="flex-1">
                <div className="font-semibold text-sm">{r.title}</div>
                <div className="text-xs opacity-80">{r.advisor_user?.full_name || r.advisor_user?.username || ""}</div>
              </div>
              <button onClick={() => dismissReminder(r)} className="text-white/90 hover:text-white text-lg">✓</button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/10 px-4 py-3 flex items-center gap-2 overflow-x-auto">
        <button onClick={() => setActiveFilter(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!activeFilter
            ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30"
            : "bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10"}`}>
          Tümü ({conversations.length})
        </button>
        {statuses.filter((s) => s.is_active).map((s) => {
          const isActive = activeFilter === s.id;
          return (
            <button key={s.id} onClick={() => setActiveFilter(isActive ? null : s.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isActive ? "text-white shadow-md" : "text-white/80 hover:text-white"}`}
              style={{
                backgroundColor: s.color,
                boxShadow: isActive ? `0 6px 18px ${s.color}50` : undefined,
                opacity: isActive ? 1 : 0.7,
              }}>
              {s.name} ({statusCounts[s.id] || 0})
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border-r border-slate-200/60 dark:border-white/10 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200/60 dark:border-white/10 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Konuşmalar</div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{filteredConversations.length}</div>
            </div>
            <button onClick={syncConversations} disabled={syncing}
              title={syncing ? "Instagram'dan yeni mesajlar çekiliyor..." : "Senkronize et"}
              className="rounded-xl px-3 py-2 text-sm transition-all bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10 disabled:opacity-60">
              <span className={syncing ? "animate-spin inline-block" : ""}>🔄</span>
            </button>
          </div>
          {syncing && (
            <div className="h-0.5 bg-gradient-to-r from-indigo-300 via-violet-500 to-indigo-300 animate-pulse" />
          )}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {initialLoad && filteredConversations.length === 0 ? (
              <ConversationSkeleton count={8} />
            ) : filteredConversations.map((conv) => {
              const isSelected = selected?.id === conv.id;
              return (
                <div key={conv.id} onClick={() => setSelected(conv)}
                  className={`relative p-3 rounded-xl cursor-pointer transition-all ${isSelected
                    ? "bg-gradient-to-r from-indigo-500/15 to-violet-500/15 shadow-sm"
                    : "hover:bg-slate-100/70 dark:hover:bg-white/5"}`}>
                  {isSelected && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-500" />
                  )}
                  <div className="flex items-start gap-2">
                    <img src={avatarUrl(conv.contact.name)} className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-white/60 dark:ring-white/10" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs truncate">{conv.contact.full_name || conv.contact.name}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-1">{formatTime(conv.last_message_at)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{conv.last_message || "Mesaj yok"}</span>
                        {conv.waiting_for_reply && (
                          <button
                            onClick={(e) => { e.stopPropagation(); dismissReply(conv.id); }}
                            title="Tıklayarak bekleme işaretini kaldır"
                            className="text-[10px] rounded-full px-1.5 py-0.5 flex-shrink-0 ml-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-medium whitespace-nowrap hover:bg-amber-500/25 cursor-pointer transition-colors">
                            ⏳ Cevap bekliyor
                          </button>
                        )}
                      </div>
                      {conv.contact.status && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] text-white font-medium"
                          style={{ backgroundColor: conv.contact.status.color }}>
                          {conv.contact.status.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selected ? (
            <>
              <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/10 p-3 flex items-center gap-3">
                <img src={avatarUrl(selected.contact.name)} className="w-10 h-10 rounded-full ring-2 ring-indigo-500/30 dark:ring-indigo-400/30" alt="" />
                <div className="flex-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{selected.contact.full_name || selected.contact.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{platformIcon(selected.platform)} {selected.contact.name}</div>
                </div>
                {window24 && (
                  <div className={`text-xs px-3 py-1.5 rounded-full font-medium backdrop-blur ${window24.open
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"}`}>
                    {window24.open ? "✅" : "⛔"} {window24.message}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading && messages.length === 0 ? (
                  <MessageSkeleton count={5} />
                ) : messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"} ${msg._pending ? "opacity-60" : ""}`}>
                    <div className={`max-w-sm px-4 py-2.5 text-sm ${msg.direction === "outbound"
                      ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white rounded-2xl rounded-br-md shadow-lg shadow-indigo-500/30"
                      : "bg-white/80 dark:bg-slate-800/60 backdrop-blur text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-white/10 rounded-2xl rounded-bl-md shadow-sm"}`}>
                      <div className="leading-relaxed">{msg.content}</div>
                      <div className={`text-[10px] mt-1 ${msg.direction === "outbound" ? "text-indigo-100" : "text-slate-400 dark:text-slate-500"}`}>
                        {msg._pending ? "⏳ Gönderiliyor..." : formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border-t border-slate-200/60 dark:border-white/10 p-3">
                {window24 && !window24.open ? (
                  <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3">
                    <div className="text-xl">⛔</div>
                    <div>
                      <div className="font-semibold text-rose-700 dark:text-rose-300 text-sm">Mesajlaşma penceresi kapandı</div>
                      <div className="text-rose-500/80 dark:text-rose-400/80 text-xs mt-0.5">Müşteri tekrar yazarsa açılır.</div>
                    </div>
                  </div>
                ) : (
                  <>
                    {showQuickReplies && quickReplies.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {quickReplies.map((qr) => (
                          <button key={qr.id} onClick={() => { setReplyText(qr.content); setShowQuickReplies(false); }}
                            className="text-xs px-3 py-1.5 rounded-full transition-all bg-indigo-500/10 dark:bg-indigo-500/15 hover:bg-indigo-500/20 dark:hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                            {qr.title}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <button onClick={() => setShowQuickReplies(!showQuickReplies)}
                        title="Hazır mesajlar"
                        className={`p-2.5 rounded-xl transition-all ${showQuickReplies
                          ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30"
                          : "bg-white/60 dark:bg-white/5 text-slate-500 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 hover:bg-white dark:hover:bg-white/10"}`}>
                        ⚡
                      </button>
                      <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={handleKeyDown} placeholder="Mesaj yaz..." rows={2}
                        className="flex-1 resize-none rounded-xl px-3 py-2 text-sm transition-all
                          bg-white/60 dark:bg-slate-800/50 backdrop-blur
                          border border-slate-200/60 dark:border-white/10
                          focus:bg-white dark:focus:bg-slate-800
                          focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500" />
                      <button onClick={sendReply} disabled={sending || !replyText.trim()}
                        className="text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-all
                          bg-gradient-to-r from-indigo-500 to-violet-500
                          hover:from-indigo-600 hover:to-violet-600
                          shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
                          disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none disabled:cursor-not-allowed dark:disabled:from-slate-700 dark:disabled:to-slate-700">
                        {sending ? "..." : "Gönder"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <div className="text-7xl mb-4 opacity-50">💬</div>
              <div className="text-base font-medium">Bir konuşma seç</div>
              <div className="text-xs mt-1 opacity-80">Soldaki listeden başla</div>
            </div>
          )}
        </div>

        <ContactPanel contact={selected?.contact} statuses={statuses} sectors={sectors} trainingSets={trainingSets} onUpdate={fetchConversations} />
      </div>
    </div>
  );
}
