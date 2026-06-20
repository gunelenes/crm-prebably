import { useEffect, useState } from "react";
import api from "../../api";
import { useAuth } from "../../AuthContext";
import Spinner from "../../components/Spinner";

const inputCls =
  "w-full rounded-xl px-4 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "text-slate-800 dark:text-slate-100";

const labelCls =
  "text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1.5";

const initialResult = () => {
  const p = new URLSearchParams(window.location.search).get("mail");
  if (p === "connected") return { ok: true, msg: "Google hesabı bağlandı ✓ Artık test gönderebilirsin." };
  if (p === "error") return { ok: false, msg: "Google bağlantısı başarısız. Client ID/Secret ve yetkili yönlendirme URL'sini kontrol edip tekrar dene." };
  return null;
};

export default function MailSettingsTab() {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);

  const [provider, setProvider] = useState("gmail_oauth");
  const [smtpUser, setSmtpUser] = useState("");
  const [fromName, setFromName] = useState("");

  // OAuth
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [secretSet, setSecretSet] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [redirectUri, setRedirectUri] = useState("");

  // SMTP
  const [password, setPassword] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(465);
  const [useSsl, setUseSsl] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState(user?.email || "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(initialResult);

  const load = () => api.get("/mail-settings").then((r) => {
    const d = r.data;
    setProvider(d.provider || "gmail_oauth");
    setSmtpUser(d.smtp_user || "");
    setFromName(d.from_name || "");
    setClientId(d.google_client_id || "");
    setSecretSet(!!d.google_secret_set);
    setGoogleConnected(!!d.google_connected);
    setRedirectUri(d.redirect_uri || "");
    setSmtpHost(d.smtp_host || "smtp.gmail.com");
    setSmtpPort(d.smtp_port || 465);
    setUseSsl(d.use_ssl ?? true);
    setPasswordSet(!!d.password_set);
    setConfigured(!!d.configured);
    setPassword("");
    setClientSecret("");
    setLoaded(true);
    // OAuth dönüşündeki ?mail parametresini URL'den temizle (toast zaten gösterildi)
    if (new URLSearchParams(window.location.search).get("mail")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  });
  useEffect(() => { load(); }, []);

  const buildBody = () => {
    const body = { provider, smtp_user: smtpUser, from_name: fromName };
    if (provider === "gmail_oauth") {
      body.google_client_id = clientId;
      if (clientSecret.trim()) body.google_client_secret = clientSecret.trim();
    } else {
      body.smtp_host = smtpHost;
      body.smtp_port = Number(smtpPort) || 465;
      body.use_ssl = useSsl;
      if (password.trim()) body.password = password.trim();
    }
    return body;
  };

  const save = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const r = await api.put("/mail-settings", buildBody());
      if (r.data?.error) setTestResult({ ok: false, msg: r.data.error });
      else await load();
    } finally { setSaving(false); }
  };

  const connect = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const pr = await api.put("/mail-settings", buildBody());
      if (pr.data?.error) { setTestResult({ ok: false, msg: pr.data.error }); return; }
      const r = await api.get("/mail-settings/google/auth", {
        params: { return_to: window.location.origin + "/parametreler" },
      });
      if (r.data?.url) { window.location.href = r.data.url; return; }
      setTestResult({ ok: false, msg: r.data?.error || "Bağlanma başlatılamadı." });
    } catch (e) {
      setTestResult({ ok: false, msg: e.response?.data?.detail || e.message });
    } finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!testTo.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post("/mail-settings/test", { to: testTo.trim() });
      if (r.data.ok) setTestResult({ ok: true, msg: `Test e-postası ${testTo.trim()} adresine gönderildi.` });
      else setTestResult({ ok: false, msg: r.data.error || "Gönderilemedi." });
    } catch (e) {
      setTestResult({ ok: false, msg: e.response?.data?.detail || e.message });
    } finally { setTesting(false); }
  };

  if (!loaded) return <div className="py-12 flex justify-center"><Spinner /></div>;

  const canConnect = smtpUser.trim() && clientId.trim() && (secretSet || clientSecret.trim());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className={`text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full ${configured
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400"}`}>
          {configured ? "✓ Mail gönderimi aktif" : "Mail gönderimi pasif"}
        </span>
      </div>

      <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-1 inline-flex gap-1">
        {[{ id: "gmail_oauth", label: "Google ile Bağlan (önerilen)" }, { id: "smtp", label: "Gmail SMTP" }].map((p) => (
          <button key={p.id} type="button" onClick={() => setProvider(p.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${provider === p.id
              ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30"
              : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5"}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 space-y-4">
        <div>
          <label className={labelCls}>Gönderen e-posta</label>
          <input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} type="email"
            placeholder="info@baharatmedya.net" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Gönderen görünen ad</label>
          <input value={fromName} onChange={(e) => setFromName(e.target.value)}
            placeholder="Örn: Baharat Medya" className={inputCls} />
        </div>

        {provider === "gmail_oauth" ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>OAuth Client ID</label>
                <input value={clientId} onChange={(e) => setClientId(e.target.value)}
                  placeholder="....apps.googleusercontent.com" className={`${inputCls} font-mono text-xs`} />
              </div>
              <div>
                <label className={labelCls}>OAuth Client Secret</label>
                <input value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} type="password"
                  placeholder={secretSet ? "•••••••• (tanımlı — değiştirmek için yeni gir)" : "GOCSPX-..."}
                  className={`${inputCls} font-mono text-xs`} />
              </div>
            </div>

            <div className="rounded-xl bg-slate-50/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 p-3">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Google'a yapıştıracağın "Yetkili yönlendirme URI'si"
              </div>
              <code className="text-xs text-indigo-700 dark:text-indigo-300 break-all">{redirectUri}</code>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={connect} disabled={saving || !canConnect}
                className="py-2 px-5 rounded-xl text-sm font-semibold text-white transition-all
                  bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600
                  shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
                  disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700">
                {saving ? <Spinner /> : (googleConnected ? "Yeniden Bağlan" : "Google ile Bağlan")}
              </button>
              <span className={`text-xs px-2.5 py-1 rounded-full ${googleConnected
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400"}`}>
                {googleConnected ? "✓ Google bağlı" : "Henüz bağlı değil"}
              </span>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 leading-relaxed">
              <p className="font-semibold text-slate-600 dark:text-slate-300">Kurulum (bir kerelik, admin gerekmez):</p>
              <p>1. console.cloud.google.com → proje → <b>Gmail API</b>'yi etkinleştir.</p>
              <p>2. "OAuth consent screen" (İzin ekranı): User Type = <b>Internal</b> seç (Workspace için; token süresi dolmaz).</p>
              <p>3. "Credentials" → Create Credentials → <b>OAuth client ID</b> → tür <b>Web application</b>.
                "Authorized redirect URIs"e yukarıdaki URL'yi <b>birebir</b> yapıştır.</p>
              <p>4. Çıkan <b>Client ID</b> ve <b>Client Secret</b>'i yukarı gir → <b>Google ile Bağlan</b>'a tıkla →
                {" "}<code>{smtpUser || "info@baharatmedya.net"}</code> ile izin ver.</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className={labelCls}>App Password (uygulama şifresi)</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
                placeholder={passwordSet ? "•••••••• (tanımlı — değiştirmek için yeni gir)" : "16 haneli Gmail uygulama şifresi"}
                className={inputCls} />
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                Not: Railway dışa SMTP portlarını engellediği için bu yöntem sunucuda çalışmaz (timeout).
                Önerilen yöntem "Google ile Bağlan"dır.
              </p>
            </div>
            <div>
              <button type="button" onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline">
                {showAdvanced ? "▾ Gelişmiş ayarları gizle" : "▸ Gelişmiş ayarlar (sunucu / port)"}
              </button>
              {showAdvanced && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className={labelCls}>SMTP sunucu</label>
                    <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Port</label>
                    <input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} type="number" className={inputCls} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer select-none py-2">
                    <input type="checkbox" checked={useSsl} onChange={(e) => setUseSsl(e.target.checked)}
                      className="rounded accent-indigo-500" />
                    SSL (465). Kapalıysa STARTTLS (587).
                  </label>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving}
            className="py-2 px-5 rounded-xl text-sm font-medium transition-colors
              bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
              text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10
              disabled:opacity-50">
            {saving ? <Spinner /> : "Kaydet"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5">
        <div className={labelCls}>Test e-postası gönder</div>
        <div className="flex gap-2 flex-wrap">
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} type="email"
            placeholder="alici@ornek.com" className={`${inputCls} flex-1 min-w-[200px]`} />
          <button onClick={sendTest} disabled={testing || !testTo.trim()}
            className="py-2 px-5 rounded-xl text-sm font-medium transition-colors
              bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
              text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10
              disabled:opacity-50">
            {testing ? <Spinner /> : "Test gönder"}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
          Kaydettiğin ayarlarla bir deneme maili atar. Hata olursa mesajını burada görürsün.
        </p>
        {testResult && (
          <div className={`mt-3 text-sm rounded-xl px-4 py-2.5 break-words ${testResult.ok
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-500/10 text-rose-600 dark:text-rose-300"}`}>
            {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
          </div>
        )}
      </div>
    </div>
  );
}
