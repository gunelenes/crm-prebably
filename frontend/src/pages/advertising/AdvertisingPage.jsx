import { useCallback, useEffect, useState } from "react";
import api from "../../api";
import AdsKpiCards from "./AdsKpiCards";
import AdsChannelCards from "./AdsChannelCards";
import AdAccountCards from "./AdAccountCards";
import AdSpendTable from "./AdSpendTable";
import RegistrationUploadModal from "./RegistrationUploadModal";
import { todayISO, daysAgoISO } from "./format";

export default function AdvertisingPage() {
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [summary, setSummary] = useState(null);
  const [spendRows, setSpendRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null); // { type: 'ok'|'error', text }
  const [showUpload, setShowUpload] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [account, setAccount] = useState(""); // "" = Tümü

  useEffect(() => {
    api.get("/ad-accounts").then((r) => setAccounts(r.data)).catch(() => {});
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const sumParams = { from, to };
      const spendParams = { date_from: from, date_to: to, limit: 200 };
      if (account) { sumParams.account = account; spendParams.account = account; }
      const [s, sp] = await Promise.all([
        api.get("/analytics/summary", { params: sumParams }),
        api.get("/ad-spend", { params: spendParams }),
      ]);
      setSummary(s.data);
      setSpendRows(sp.data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [from, to, account]);

  useEffect(() => {
    const t = setTimeout(() => { fetchAll(); }, 200);
    return () => clearTimeout(t);
  }, [fetchAll]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await api.post("/ads/sync", null, { params: { from, to } });
      const d = res.data || {};
      if (d.status === "error") {
        setSyncMsg({ type: "error", text: d.error || "Senkronizasyon başarısız" });
      } else {
        const errCount = (d.errors || []).length;
        setSyncMsg({
          type: "ok",
          text: `${d.synced ?? 0} kayıt güncellendi (${d.accounts ?? 0} hesap)` +
            (errCount ? ` · ${errCount} hesapta hata` : ""),
        });
        await fetchAll();
      }
    } catch (err) {
      setSyncMsg({ type: "error", text: err.response?.data?.detail || "Senkronizasyon başarısız" });
    } finally {
      setSyncing(false);
    }
  };

  const handleClear = async () => {
    const acc = accounts.find((a) => a.act_id === account);
    const scope = account ? `“${acc?.name || account}” hesabının` : "TÜM hesapların";
    if (!window.confirm(`${scope} saklı harcama verisi silinecek. Hesap tanımları ve kayıtlar etkilenmez. Emin misin?`)) return;
    setSyncMsg(null);
    try {
      const res = await api.delete("/ad-spend", { params: account ? { account } : {} });
      setSyncMsg({ type: "ok", text: `${res.data?.deleted ?? 0} harcama satırı silindi.` });
      await fetchAll();
    } catch (err) {
      setSyncMsg({ type: "error", text: err.response?.data?.detail || "Silinemedi" });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Başlık + aksiyonlar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Reklam Analizi</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Meta reklam harcamaları ve seminer kayıt istatistikleri</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleClear}
              className="py-2 px-4 rounded-xl text-sm font-medium transition-colors bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              🗑️ Veriyi Temizle
            </button>
            <button onClick={() => setShowUpload(true)}
              className="py-2 px-4 rounded-xl text-sm font-medium transition-colors bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10">
              📥 Kayıt Yükle (CSV)
            </button>
            <button onClick={handleSync} disabled={syncing}
              className="py-2 px-5 rounded-xl text-sm font-semibold text-white transition-all bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 disabled:opacity-60">
              {syncing ? "Senkronize ediliyor…" : "🔄 Senkronize Et"}
            </button>
          </div>
        </div>

        {syncMsg && (
          <div className={`text-xs rounded-xl px-3 py-2 border ${
            syncMsg.type === "error"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
          }`}>
            {syncMsg.type === "error" ? "⚠️ " : "✅ "}{syncMsg.text}
          </div>
        )}

        {/* Hesap seçimi + tarih aralığı */}
        <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Hesap</span>
          <select value={account} onChange={(e) => setAccount(e.target.value)} className={dateCls}>
            <option value="">Tüm Hesaplar</option>
            {accounts.map((a) => (
              <option key={a.act_id} value={a.act_id}>{a.name}{a.is_active ? "" : " (pasif)"}</option>
            ))}
          </select>
          <span className="hidden md:inline w-px h-5 bg-slate-200 dark:bg-white/10" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Tarih Aralığı</span>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={dateCls} />
          <span className="text-slate-400">→</span>
          <input type="date" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} className={dateCls} />
          <div className="flex gap-1 ml-auto">
            <Preset label="Son 7g" onClick={() => { setFrom(daysAgoISO(7)); setTo(todayISO()); }} />
            <Preset label="Son 30g" onClick={() => { setFrom(daysAgoISO(30)); setTo(todayISO()); }} />
            <Preset label="Son 90g" onClick={() => { setFrom(daysAgoISO(90)); setTo(todayISO()); }} />
          </div>
        </div>

        <AdsKpiCards overall={summary?.overall} />
        <AdsChannelCards byChannel={summary?.by_channel} />
        <AdAccountCards byAccount={summary?.by_account} />

        <div>
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Harcama Detayı (Ad Set)
          </h3>
          <AdSpendTable rows={spendRows} loading={loading} />
        </div>
      </div>

      {showUpload && (
        <RegistrationUploadModal onClose={() => setShowUpload(false)} onUploaded={fetchAll} />
      )}
    </div>
  );
}

const dateCls =
  "rounded-xl px-3 py-1.5 text-sm bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-slate-800 dark:text-slate-100";

function Preset({ label, onClick }) {
  return (
    <button onClick={onClick}
      className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10 transition-colors">
      {label}
    </button>
  );
}
