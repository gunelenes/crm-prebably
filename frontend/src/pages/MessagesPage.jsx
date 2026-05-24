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
            <div key={r.id} className="bg-orange-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-sm">
              <span className="text-xl">🔔</span>
              <div className="flex-1">
                <div className="font-medium text-sm">{r.title}</div>
                <div className="text-xs opacity-80">{r.advisor}</div>
              </div>
              <button onClick={() => dismissReminder(r)} className="text-white hover:text-orange-200 text-lg">✓</button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2 overflow-x-auto">
        <button onClick={() => setActiveFilter(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!activeFilter ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          Tümü ({conversations.length})
        </button>
        {statuses.filter((s) => s.is_active).map((s) => (
          <button key={s.id} onClick={() => setActiveFilter(activeFilter === s.id ? null : s.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeFilter === s.id ? "text-white" : "text-white opacity-70 hover:opacity-100"}`}
            style={{ backgroundColor: s.color }}>
            {s.name} ({statusCounts[s.id] || 0})
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
            <p className="text-white text-sm font-medium">{filteredConversations.length} konuşma</p>
            <button onClick={syncConversations} disabled={syncing}
              title={syncing ? "Instagram'dan yeni mesajlar çekiliyor..." : "Senkronize et"}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 disabled:opacity-60 text-white rounded-lg px-2 py-1 text-xs">
              <span className={syncing ? "animate-spin inline-block" : ""}>🔄</span>
            </button>
          </div>
          {syncing && (
            <div className="h-0.5 bg-gradient-to-r from-blue-300 via-blue-600 to-blue-300 animate-pulse" />
          )}
          <div className="flex-1 overflow-y-auto">
            {initialLoad && filteredConversations.length === 0 ? (
              <ConversationSkeleton count={8} />
            ) : filteredConversations.map((conv) => (
              <div key={conv.id} onClick={() => setSelected(conv)}
                className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${selected?.id === conv.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}`}>
                <div className="flex items-start gap-2">
                  <img src={avatarUrl(conv.contact.name)} className="w-9 h-9 rounded-full flex-shrink-0" alt="" />
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

        <div className="flex-1 flex flex-col">
          {selected ? (
            <>
              <div className="bg-white border-b border-gray-200 p-3 flex items-center gap-3">
                <img src={avatarUrl(selected.contact.name)} className="w-9 h-9 rounded-full" alt="" />
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
                {messagesLoading && messages.length === 0 ? (
                  <MessageSkeleton count={5} />
                ) : messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"} ${msg._pending ? "opacity-60" : ""}`}>
                    <div className={`max-w-sm px-4 py-2 rounded-2xl text-sm ${msg.direction === "outbound" ? "bg-blue-500 text-white rounded-br-sm" : "bg-white text-gray-800 shadow-sm rounded-bl-sm"}`}>
                      <div>{msg.content}</div>
                      <div className={`text-xs mt-1 ${msg.direction === "outbound" ? "text-blue-200" : "text-gray-400"}`}>
                        {msg._pending ? "⏳ Gönderiliyor..." : formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
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

        <ContactPanel contact={selected?.contact} statuses={statuses} onUpdate={fetchConversations} />
      </div>
    </div>
  );
}
