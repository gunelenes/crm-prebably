import { useEffect, useRef, useState } from "react";
import api from "../../api";
import { formatTime } from "../../utils";
import { MessageSkeleton } from "../../components/Skeletons";

export default function ContactMessagesTab({ contactId, conversationId, onChanged }) {
  const [convId, setConvId] = useState(conversationId || null);
  const [messages, setMessages] = useState([]);
  const [window24, setWindow24] = useState(null);
  const [loading, setLoading] = useState(false);
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

      <div className="border-t border-slate-200/60 dark:border-white/10 px-6 py-2.5 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl">
        <div className="text-center text-xs text-slate-400 dark:text-slate-500">
          👁️ Salt okunur — cevap vermek için <span className="font-medium text-slate-500 dark:text-slate-300">Mesaj Yaz</span> butonunu kullan
        </div>
      </div>
    </div>
  );
}
