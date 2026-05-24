import { useEffect, useRef, useState } from "react";
import api from "../../api";
import { formatTime } from "../../utils";
import { MessageSkeleton } from "../../components/Skeletons";

export default function ContactMessagesTab({ contactId, conversationId, onChanged }) {
  const [convId, setConvId] = useState(conversationId || null);
  const [messages, setMessages] = useState([]);
  const [window24, setWindow24] = useState(null);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  // contact değiştiğinde conversation id'sini bul
  useEffect(() => {
    if (conversationId) { setConvId(conversationId); return; }
    // fallback: contact için conversation aramaya yok özel endpoint; search response'unda last_conversation_id var
    setConvId(null);
  }, [conversationId]);

  useEffect(() => {
    if (!convId) { setMessages([]); setWindow24(null); return; }
    setLoading(true);
    Promise.all([
      api.get(`/conversations/${convId}/messages`),
      api.get(`/conversations/${convId}/window`),
    ]).then(([m, w]) => {
      setMessages(m.data);
      setWindow24(w.data);
    }).finally(() => setLoading(false));
  }, [convId]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading]);

  const send = async () => {
    if (!replyText.trim() || !convId) return;
    const text = replyText;
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId, content: text, direction: "outbound",
      timestamp: new Date().toISOString(), is_read: true, message_type: "text", _pending: true,
    }]);
    setReplyText("");
    setSending(true);
    try {
      const res = await api.post(`/conversations/${convId}/reply`, { text });
      if (res.data.status === "ok") {
        const [m, w] = await Promise.all([
          api.get(`/conversations/${convId}/messages`),
          api.get(`/conversations/${convId}/window`),
        ]);
        setMessages(m.data);
        setWindow24(w.data);
        onChanged?.();
      } else {
        setMessages((p) => p.filter((m) => m.id !== tempId));
        setReplyText(text);
        alert("Hata: " + res.data.error);
      }
    } catch {
      setMessages((p) => p.filter((m) => m.id !== tempId));
      setReplyText(text);
      alert("Mesaj gönderilemedi!");
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  if (!convId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
        <div className="text-6xl mb-4 opacity-50">💬</div>
        <div className="text-base font-medium">Mesaj geçmişi yok</div>
        <div className="text-xs mt-1 opacity-80">Bu kişiye henüz mesaj gelmemiş veya gönderilmemiş</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {window24 && (
        <div className="px-6 py-2 border-b border-slate-200/60 dark:border-white/10 flex justify-end">
          <div className={`text-xs px-3 py-1 rounded-full font-medium backdrop-blur ${window24.open
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
            : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"}`}>
            {window24.open ? "✅" : "⛔"} {window24.message}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading && messages.length === 0 ? (
          <MessageSkeleton count={5} />
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">Henüz mesaj yok</div>
        ) : messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"} ${msg._pending ? "opacity-60" : ""}`}>
            <div className={`max-w-md px-4 py-2.5 text-sm ${msg.direction === "outbound"
              ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white rounded-2xl rounded-br-md shadow-lg shadow-indigo-500/30"
              : "bg-white/80 dark:bg-slate-800/60 backdrop-blur text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-white/10 rounded-2xl rounded-bl-md shadow-sm"}`}>
              <div className="leading-relaxed whitespace-pre-wrap">{msg.content}</div>
              <div className={`text-[10px] mt-1 ${msg.direction === "outbound" ? "text-indigo-100" : "text-slate-400 dark:text-slate-500"}`}>
                {msg._pending ? "⏳ Gönderiliyor..." : formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-200/60 dark:border-white/10 px-6 py-3 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl">
        {window24 && !window24.open ? (
          <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3">
            <div className="text-xl">⛔</div>
            <div>
              <div className="font-semibold text-rose-700 dark:text-rose-300 text-sm">Mesajlaşma penceresi kapandı</div>
              <div className="text-rose-500/80 dark:text-rose-400/80 text-xs mt-0.5">Müşteri tekrar yazarsa açılır.</div>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown} placeholder="Mesaj yaz..." rows={2}
              className="flex-1 resize-none rounded-xl px-3 py-2 text-sm transition-all
                bg-white/60 dark:bg-slate-800/50 backdrop-blur
                border border-slate-200/60 dark:border-white/10
                focus:bg-white dark:focus:bg-slate-800
                focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500" />
            <button onClick={send} disabled={sending || !replyText.trim()}
              className="text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-all
                bg-gradient-to-r from-indigo-500 to-violet-500
                hover:from-indigo-600 hover:to-violet-600
                shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
                disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none disabled:cursor-not-allowed dark:disabled:from-slate-700 dark:disabled:to-slate-700">
              {sending ? "..." : "Gönder"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
