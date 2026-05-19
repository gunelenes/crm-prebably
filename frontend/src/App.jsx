import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000/api";

// ── Sayfalar ──────────────────────────────────────────────────────
function MessagesPage({ conversations, selected, setSelected, messages, window24, replyText, setReplyText, sending, sendReply, handleKeyDown, formatTime, avatarUrl, platformIcon, quickReplies, syncing, syncConversations, lastSync }) {
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sol panel */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white font-bold text-lg">Mesajlar</h1>
              <p className="text-blue-200 text-xs mt-1">{conversations.length} konuşma</p>
            </div>
            <button onClick={syncConversations} disabled={syncing}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg px-3 py-2 text-xs font-medium transition-all">
              <span className={syncing ? "animate-spin inline-block" : ""}>🔄</span> {syncing ? "..." : "Sync"}
            </button>
          </div>
          {lastSync && <p className="text-blue-300 text-xs mt-1">Son sync: {formatTime(lastSync.toISOString())}</p>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <div className="text-4xl mb-2">💬</div>
              <div className="text-sm">Henüz mesaj yok</div>
            </div>
          ) : conversations.map((conv) => (
            <div key={conv.id} onClick={() => setSelected(conv)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${selected?.id === conv.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}`}>
              <div className="flex items-start gap-3">
                <img src={avatarUrl(conv.contact.name)} alt={conv.contact.name} className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800 text-sm truncate">{conv.contact.name || "Bilinmeyen"}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-1">{formatTime(conv.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500 truncate">{platformIcon(conv.platform)} {conv.last_message || "Mesaj yok"}</span>
                    {conv.unread_count > 0 && (
                      <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 flex-shrink-0 ml-1">{conv.unread_count}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sağ panel */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
              <img src={avatarUrl(selected.contact.name)} alt={selected.contact.name} className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <div className="font-medium text-gray-800">{selected.contact.name}</div>
                <div className="text-xs text-gray-500">{platformIcon(selected.platform)} {selected.platform}</div>
              </div>
              {window24 && (
                <div className={`text-xs px-3 py-1 rounded-full font-medium ${window24.open ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {window24.open ? "✅ " : "⛔ "}{window24.message}
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

            <div className="bg-white border-t border-gray-200 p-4">
              {window24 && !window24.open ? (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="text-2xl">⛔</div>
                  <div>
                    <div className="font-medium text-red-700 text-sm">Mesajlaşma penceresi kapandı</div>
                    <div className="text-red-400 text-xs mt-1">Müşteri tekrar mesaj atarsa pencere yeniden açılır.</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Hazır mesaj bulutları */}
                  {showQuickReplies && quickReplies.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {quickReplies.map((qr) => (
                        <button key={qr.id}
                          onClick={() => { setReplyText(qr.content); setShowQuickReplies(false); }}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-3 py-1.5 rounded-full border border-blue-200 transition-colors">
                          {qr.title}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    {/* Hazır mesaj butonu */}
                    <button onClick={() => setShowQuickReplies(!showQuickReplies)}
                      className={`p-2 rounded-xl border transition-colors ${showQuickReplies ? "bg-blue-500 text-white border-blue-500" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"}`}
                      title="Hazır mesajlar">
                      ⚡
                    </button>

                    <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Mesaj yaz... (Enter ile gönder)"
                      rows={2}
                      className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400" />

                    <button onClick={sendReply} disabled={sending || !replyText.trim()}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl px-5 py-2 text-sm font-medium transition-colors">
                      {sending ? "..." : "Gönder"}
                    </button>
                  </div>
                  {window24?.open && <p className="text-xs text-gray-400 mt-1">Shift+Enter ile yeni satır · {window24.message}</p>}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="text-6xl mb-4">💬</div>
            <div className="text-lg font-medium">Konuşma seç</div>
            <div className="text-sm mt-1">Sol taraftan bir konuşmaya tıkla</div>
          </div>
        )}
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

  const edit = (qr) => { setEditing(qr.id); setTitle(qr.title); setContent(qr.content); };

  const del = async (id) => {
    if (!confirm("Silmek istediğinize emin misiniz?")) return;
    await axios.delete(`${API}/quick-replies/${id}`);
    setQuickReplies(prev => prev.filter(q => q.id !== id));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Hazır Mesajlar</h2>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="font-medium text-gray-700 mb-4">{editing ? "Mesajı Düzenle" : "Yeni Hazır Mesaj"}</h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Başlık (örn. Merhaba, Ödeme Alındı...)"
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="Mesaj içeriği..."
          rows={3}
          className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm mb-3 resize-none focus:outline-none focus:border-blue-400" />
        <div className="flex gap-2">
          <button onClick={save} disabled={!title.trim() || !content.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl px-5 py-2 text-sm font-medium transition-colors">
            {editing ? "Güncelle" : "Ekle"}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setTitle(""); setContent(""); }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl px-5 py-2 text-sm font-medium transition-colors">
              İptal
            </button>
          )}
        </div>
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {quickReplies.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <div className="text-4xl mb-2">⚡</div>
            <div className="text-sm">Henüz hazır mesaj yok</div>
          </div>
        ) : quickReplies.map((qr) => (
          <div key={qr.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4">
            <div className="flex-1">
              <div className="font-medium text-gray-800 text-sm mb-1">{qr.title}</div>
              <div className="text-gray-500 text-sm">{qr.content}</div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => edit(qr)}
                className="text-blue-500 hover:bg-blue-50 rounded-lg px-3 py-1 text-xs font-medium transition-colors">
                Düzenle
              </button>
              <button onClick={() => del(qr.id)}
                className="text-red-500 hover:bg-red-50 rounded-lg px-3 py-1 text-xs font-medium transition-colors">
                Sil
              </button>
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
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [window24, setWindow24] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [quickReplies, setQuickReplies] = useState([]);
  const selectedRef = useRef(selected);

  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API}/conversations`);
      setConversations(res.data);
      setLoading(false);
    } catch (err) { setLoading(false); }
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

  useEffect(() => {
    fetchConversations();
    axios.get(`${API}/quick-replies`).then(r => setQuickReplies(r.data));
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
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

  const avatarUrl = (name) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=random&color=fff&size=80`;

  const menuItems = [
    { id: "messages", icon: "💬", label: "Mesajlar" },
    { id: "quickreplies", icon: "⚡", label: "Hazır Mesajlar" },
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-sans">

      {/* Sidebar */}
      <div className={`${menuOpen ? "w-48" : "w-16"} bg-gray-900 flex flex-col transition-all duration-200`}>
        {/* Hamburger */}
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="p-4 text-gray-400 hover:text-white transition-colors text-xl">
          {menuOpen ? "✕" : "☰"}
        </button>

        {/* Menu items */}
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

        {/* Alt bilgi */}
        {menuOpen && (
          <div className="p-4 text-gray-600 text-xs">CRM v1.0</div>
        )}
      </div>

      {/* İçerik */}
      {page === "messages" && (
        <MessagesPage
          conversations={conversations}
          selected={selected}
          setSelected={setSelected}
          messages={messages}
          window24={window24}
          replyText={replyText}
          setReplyText={setReplyText}
          sending={sending}
          sendReply={sendReply}
          handleKeyDown={handleKeyDown}
          formatTime={formatTime}
          avatarUrl={avatarUrl}
          platformIcon={platformIcon}
          quickReplies={quickReplies}
          syncing={syncing}
          syncConversations={syncConversations}
          lastSync={lastSync}
        />
      )}

      {page === "quickreplies" && (
        <QuickRepliesPage
          quickReplies={quickReplies}
          setQuickReplies={setQuickReplies}
        />
      )}
    </div>
  );
}