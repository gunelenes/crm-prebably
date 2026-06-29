import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api";
import AdsCampaignStatus from "./AdsCampaignStatus";
import { CAMPAIGN_STATE_META, CAMPAIGN_STATE_ORDER } from "./format";

// Kampanya Durumları — anlık (aktif/durmuş/sorunlu + neden). Harcamadan ve tarih
// aralığından bağımsızdır; /ad-campaigns endpoint'inden gelir.
export default function CampaignStatusPage() {
  const [accounts, setAccounts] = useState([]);
  const [account, setAccount] = useState(""); // "" = Tümü (server filtresi)
  const [stateFilter, setStateFilter] = useState(""); // "" = Tümü (istemci filtresi)
  const [campaign, setCampaign] = useState(""); // "" = Tümü (istemci filtresi)
  const [data, setData] = useState(null); // { items, counts, total }
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null); // { type, text }
  const [status, setStatus] = useState(null); // /ads/status

  const fetchStatus = useCallback(() => {
    api.get("/ads/status").then((r) => setStatus(r.data)).catch(() => {});
  }, []);

  const fetchCampaigns = useCallback(() => {
    setLoading(true);
    api.get("/ad-campaigns", { params: account ? { account } : {} })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [account]);

  useEffect(() => {
    api.get("/ad-accounts").then((r) => setAccounts(r.data)).catch(() => {});
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const t = setTimeout(() => { fetchCampaigns(); }, 0);
    return () => clearTimeout(t);
  }, [fetchCampaigns]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await api.post("/ads/sync", null);
      const d = res.data || {};
      if (d.status === "error") {
        setSyncMsg({ type: "error", text: d.error || "Senkronizasyon başarısız" });
      } else {
        const errCount = (d.errors || []).length;
        setSyncMsg({
          type: "ok",
          text: `${d.accounts ?? 0} hesap senkronlandı` + (errCount ? ` · ${errCount} hesapta hata` : ""),
        });
        fetchCampaigns();
        fetchStatus();
      }
    } catch (err) {
      setSyncMsg({ type: "error", text: err.response?.data?.detail || "Senkronizasyon başarısız" });
    } finally {
      setSyncing(false);
    }
  };

  const items = useMemo(() => data?.items || [], [data]);
  const counts = data?.counts || {};

  // Kampanya dropdown seçenekleri (mevcut hesap kapsamındaki benzersiz adlar).
  const campaignOptions = useMemo(() => {
    const set = new Set(items.map((c) => c.campaign_name).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [items]);

  const filtered = useMemo(() => items.filter(
    (c) => (!stateFilter || c.state === stateFilter) && (!campaign || c.campaign_name === campaign)
  ), [items, stateFilter, campaign]);

  const onAccountChange = (e) => { setAccount(e.target.value); setCampaign(""); };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Başlık + senkron */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Kampanya Durumları</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Hangi kampanyalar aktif, hangileri durmuş ve neden — anlık durum (tarih aralığından bağımsız).
            </p>
          </div>
          <button onClick={handleSync} disabled={syncing}
            className="py-2 px-5 rounded-xl text-sm font-semibold text-white transition-all bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 disabled:opacity-60">
            {syncing ? "Senkronize ediliyor…" : "🔄 Senkronize Et"}
          </button>
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

        {/* Token uyarısı */}
        {status && (status.token_valid === false || (status.token_days_left != null && status.token_days_left <= 10)) && (
          <div className="text-xs rounded-xl px-3 py-2 border bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300">
            ⚠️ {status.token_valid === false
              ? "Meta erişim anahtarı geçersiz veya süresi dolmuş — Railway Variables'taki META_ACCESS_TOKEN'ı güncelleyin."
              : `Meta erişim anahtarının süresi ${status.token_days_left} gün sonra dolacak — bitmeden yenileyin.`}
          </div>
        )}

        {status?.last_run_at && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1">
            🔄 Son senkron: {new Date(status.last_run_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
            {status.last_status ? ` · ${status.last_status === "ok" ? "başarılı" : "hata"}` : ""}
            {" · otomatik senkron açık"}
          </p>
        )}

        {/* Filtreler: hesap + kampanya */}
        <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Hesap</span>
          <select value={account} onChange={onAccountChange} className={selectCls}>
            <option value="">Tüm Hesaplar</option>
            {accounts.map((a) => (
              <option key={a.act_id} value={a.act_id}>{a.name}{a.is_active ? "" : " (pasif)"}</option>
            ))}
          </select>
          <span className="hidden md:inline w-px h-5 bg-slate-200 dark:bg-white/10" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Kampanya</span>
          <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className={`${selectCls} flex-1 min-w-0`}>
            <option value="">Tüm Kampanyalar</option>
            {campaignOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {campaign && (
            <button onClick={() => setCampaign("")}
              className="text-[11px] text-indigo-600 dark:text-indigo-300 hover:underline whitespace-nowrap">filtreyi kaldır</button>
          )}
        </div>

        {/* Statü filtre chip'leri (sayaçlı) */}
        <div className="flex flex-wrap items-center gap-2">
          <StateChip active={stateFilter === ""} onClick={() => setStateFilter("")}
            dot="bg-slate-400" label="Tümü" count={data?.total ?? 0} />
          {CAMPAIGN_STATE_ORDER.filter((s) => counts[s]).map((s) => {
            const meta = CAMPAIGN_STATE_META[s];
            return (
              <StateChip key={s} active={stateFilter === s} onClick={() => setStateFilter(stateFilter === s ? "" : s)}
                dot={meta.dot} label={meta.label} count={counts[s]} badge={meta.badge} />
            );
          })}
        </div>

        <AdsCampaignStatus
          items={filtered}
          emptyText={loading ? "Yükleniyor…" : (items.length
            ? "Filtreye uyan kampanya yok."
            : "Kampanya durumu verisi yok. “Senkronize Et”e basın.")}
        />
      </div>
    </div>
  );
}

const selectCls =
  "rounded-xl px-3 py-1.5 text-sm bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-slate-800 dark:text-slate-100";

function StateChip({ active, onClick, dot, label, count, badge }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active
          ? (badge || "bg-slate-500/15 text-slate-700 dark:text-slate-200 border-slate-400/40") + " ring-2 ring-indigo-500/40"
          : "bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-white/10 hover:bg-white dark:hover:bg-white/10"
      }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
      <span className="font-mono opacity-70">{count}</span>
    </button>
  );
}
