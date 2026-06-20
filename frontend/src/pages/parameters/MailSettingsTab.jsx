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

export default function MailSettingsTab() {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);

  const [smtpUser, setSmtpUser] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(465);
  const [useSsl, setUseSsl] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState(user?.email || "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // {ok, msg}

  const load = () => api.get("/mail-settings").then((r) => {
    const d = r.data;
    setSmtpUser(d.smtp_user || "");
    setFromName(d.from_name || "");
    setSmtpHost(d.smtp_host || "smtp.gmail.com");
    setSmtpPort(d.smtp_port || 465);
    setUseSsl(d.use_ssl ?? true);
    setPasswordSet(!!d.password_set);
    setConfigured(!!d.configured);
    setPassword("");
    setLoaded(true);
  });
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const body = {
        smtp_user: smtpUser,
        from_name: fromName,
        smtp_host: smtpHost,
        smtp_port: Number(smtpPort) || 465,
        use_ssl: useSsl,
      };
      if (password.trim()) body.password = password.trim();
      await api.put("/mail-settings", body);
      await load();
    } finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!testTo.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post("/mail-settings/test", { to: testTo.trim() });
      if (r.data.ok) {
        setTestResult({ ok: true, msg: `Test e-postası ${testTo.trim()} adresine gönderildi.` });
      } else {
        setTestResult({ ok: false, msg: r.data.error || "Gönderilemedi." });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e.response?.data?.detail || e.message });
    } finally { setTesting(false); }
  };

  if (!loaded) return <div className="py-12 flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className={`text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full ${configured
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400"}`}>
          {configured ? "✓ Mail gönderimi aktif" : "Mail gönderimi pasif"}
        </span>
      </div>

      <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 space-y-4">
        <div>
          <label className={labelCls}>Gönderen e-posta (Gmail hesabı)</label>
          <input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} type="email"
            placeholder="info@baharatmedya.net" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>App Password (uygulama şifresi)</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
            placeholder={passwordSet ? "•••••••• (tanımlı — değiştirmek için yeni gir)" : "16 haneli Gmail uygulama şifresi"}
            className={inputCls} />
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Normal Gmail şifren değil. Google Hesabı → Güvenlik → 2 Adımlı Doğrulama açıkken
            "Uygulama Şifreleri"nden üretilir. Boş bırakırsan mevcut şifre korunur.
          </p>
        </div>

        <div>
          <label className={labelCls}>Gönderen görünen ad</label>
          <input value={fromName} onChange={(e) => setFromName(e.target.value)}
            placeholder="Örn: Baharat Medya" className={inputCls} />
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

        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving}
            className="py-2 px-5 rounded-xl text-sm font-semibold text-white transition-all min-w-[100px]
              bg-gradient-to-r from-indigo-500 to-violet-500
              hover:from-indigo-600 hover:to-violet-600
              shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
              disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700">
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
          Kaydettiğin ayarlarla bir deneme maili atar. Şifre yanlışsa hata mesajını burada görürsün.
        </p>
        {testResult && (
          <div className={`mt-3 text-sm rounded-xl px-4 py-2.5 ${testResult.ok
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-500/10 text-rose-600 dark:text-rose-300"}`}>
            {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
          </div>
        )}
      </div>
    </div>
  );
}
