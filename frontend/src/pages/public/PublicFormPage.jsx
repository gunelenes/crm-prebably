import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API } from "../../api";

// Auth interceptor olmayan çıplak axios istemcisi — public sayfa için
const publicApi = axios.create({ baseURL: API });

const COUNTRY_CODES = [
  "+90", "+1", "+44", "+49", "+33", "+39", "+34", "+31", "+32", "+41",
  "+43", "+45", "+46", "+47", "+48", "+351", "+353", "+30", "+7", "+380",
  "+994", "+995", "+98", "+971", "+966", "+962", "+20", "+212", "+27",
  "+81", "+82", "+86", "+91", "+92", "+93", "+880", "+60", "+62", "+63",
  "+64", "+65", "+66", "+852", "+886", "+55", "+52", "+54", "+56", "+57",
  "+58", "+503", "+504", "+505", "+506", "+507",
];

// Genişlik dışı ortak stiller. `w-full`'ı ayrı tutuyoruz; aksi halde
// telefon alanındaki sabit genişlikli (w-28) ülke kodu select'i ile çakışıp
// onu eziyordu (Tailwind'de aynı özgüllükte son kural kazanır).
const inputBase =
  "rounded-xl px-4 py-3 text-base transition-all " +
  "bg-white/80 backdrop-blur border border-slate-200 " +
  "focus:outline-none focus:ring-4 focus:ring-purple-300/50 focus:border-purple-500 " +
  "text-slate-900 placeholder:text-slate-400";

const inputCls = `w-full ${inputBase}`;

const LOGO_SRC = "/i.webp";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0" aria-hidden="true">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" />
    </svg>
  );
}

function Logo() {
  return (
    <img
      src={LOGO_SRC}
      alt="Logo"
      className="mx-auto mb-4 h-16 w-auto object-contain drop-shadow-lg"
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}

export default function PublicFormPage() {
  const { slug } = useParams();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // { message, redirect_url }
  const [fieldErr, setFieldErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    publicApi
      .get(`/public/forms/${slug}`)
      .then((res) => {
        if (cancelled) return;
        setForm(res.data);
        const init = {};
        (res.data.fields || []).forEach((f) => {
          if (f.type === "checkbox") init[f.key] = false;
          else if (f.type === "phone") init[f.key] = { code: "+90", number: "" };
          else init[f.key] = "";
        });
        setValues(init);
        document.title = `${res.data.title} — Kayıt`;
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e.response?.status === 404
            ? "Bu form bulunamadı veya artık aktif değil."
            : "Form yüklenirken bir sorun oluştu."
        );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const setValue = (key, v) => setValues((prev) => ({ ...prev, [key]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setFieldErr("");
    // Basit client-side kontrol — backend de doğrular
    for (const f of form.fields) {
      if (!f.required) continue;
      const v = values[f.key];
      if (f.type === "phone") {
        if (!v || !v.number || !v.number.trim()) {
          setFieldErr(`Lütfen '${f.label}' alanını doldur.`);
          return;
        }
      } else if (f.type === "checkbox") {
        if (!v) {
          setFieldErr(`Lütfen '${f.label}' kutusunu işaretle.`);
          return;
        }
      } else if (typeof v !== "string" || !v.trim()) {
        setFieldErr(`Lütfen '${f.label}' alanını doldur.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await publicApi.post(`/public/forms/${slug}/register`, { answers: values });
      setSubmitted({
        message: res.data.thank_you_message || "Kaydın alındı! En kısa sürede sana ulaşacağız.",
        whatsapp_url: res.data.whatsapp_url || null,
        website_url: res.data.website_url || res.data.thank_you_redirect_url || null,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFieldErr(err.response?.data?.detail || "Bir hata oluştu. Lütfen tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (f) => {
    const v = values[f.key];
    const common = { id: `f-${f.key}`, placeholder: f.placeholder || "" };
    switch (f.type) {
      case "textarea":
        return (
          <textarea
            {...common}
            value={v || ""}
            onChange={(e) => setValue(f.key, e.target.value)}
            rows={4}
            className={`${inputCls} resize-none`}
          />
        );
      case "email":
        return (
          <input
            {...common}
            type="email"
            value={v || ""}
            onChange={(e) => setValue(f.key, e.target.value)}
            className={inputCls}
          />
        );
      case "number":
        return (
          <input
            {...common}
            type="number"
            value={v || ""}
            onChange={(e) => setValue(f.key, e.target.value)}
            className={inputCls}
          />
        );
      case "date":
        return (
          <input
            {...common}
            type="date"
            value={v || ""}
            onChange={(e) => setValue(f.key, e.target.value)}
            className={inputCls}
          />
        );
      case "select":
        return (
          <select
            {...common}
            value={v || ""}
            onChange={(e) => setValue(f.key, e.target.value)}
            className={inputCls}
          >
            <option value="">Seç...</option>
            {(f.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!v}
              onChange={(e) => setValue(f.key, e.target.checked)}
              className="w-5 h-5 rounded accent-purple-600"
            />
            <span className="text-slate-700">{f.placeholder || "Onaylıyorum"}</span>
          </label>
        );
      case "phone": {
        const pv = v || { code: "+90", number: "" };
        return (
          <div className="flex gap-2">
            <select
              value={pv.code}
              onChange={(e) => setValue(f.key, { ...pv, code: e.target.value })}
              className={`${inputBase} w-28 shrink-0`}
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="tel"
              value={pv.number}
              onChange={(e) => setValue(f.key, { ...pv, number: e.target.value })}
              placeholder={f.placeholder || "555 123 45 67"}
              className={`${inputBase} flex-1 min-w-0`}
            />
          </div>
        );
      }
      default:
        return (
          <input
            {...common}
            type="text"
            value={v || ""}
            onChange={(e) => setValue(f.key, e.target.value)}
            className={inputCls}
          />
        );
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#7a28c0] via-[#641fa8] to-[#3f1374] py-10 px-4 flex items-center justify-center">
      {/* Dekoratif bloblar — marka: mor zemin + altın vurgu */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-violet-400/30 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl animate-pulse" />
      </div>

      <div className="relative w-full max-w-xl">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin border-4 border-white/70 border-t-transparent rounded-full w-12 h-12" />
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-white/90 backdrop-blur-2xl shadow-2xl shadow-purple-500/30 p-10 text-center">
            <Logo />
            <div className="text-6xl mb-3">🚫</div>
            <div className="text-xl font-bold text-slate-800 mb-2">Form Açılamadı</div>
            <p className="text-slate-600">{error}</p>
          </div>
        ) : submitted ? (
          <div className="rounded-3xl bg-white/90 backdrop-blur-2xl shadow-2xl shadow-purple-500/30 p-10 text-center">
            <Logo />
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <div className="text-2xl font-extrabold bg-gradient-to-r from-purple-700 to-violet-600 bg-clip-text text-transparent mb-3">
              Kaydın Alındı!
            </div>
            <p className="text-slate-700 whitespace-pre-line leading-relaxed">{submitted.message}</p>

            {(submitted.whatsapp_url || submitted.website_url) && (
              <div className="mt-7 flex flex-col gap-3">
                {submitted.whatsapp_url && (
                  <a
                    href={submitted.whatsapp_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl text-base font-bold text-white
                      bg-gradient-to-r from-emerald-500 to-green-600
                      hover:from-emerald-600 hover:to-green-700
                      shadow-lg shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    <WhatsAppIcon /> WhatsApp Grubuna Katıl
                  </a>
                )}
                {submitted.website_url && (
                  <a
                    href={submitted.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl text-base font-bold text-white
                      bg-gradient-to-r from-purple-600 to-violet-600
                      hover:from-purple-700 hover:to-violet-700
                      shadow-lg shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    <GlobeIcon /> Web Sitemizi Ziyaret Et
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-3xl bg-white/90 backdrop-blur-2xl shadow-2xl shadow-purple-500/30 p-7 md:p-10">
            <div className="text-center mb-6">
              <Logo />
              <div className="text-4xl md:text-5xl mb-2">🎓</div>
              <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-purple-700 via-violet-600 to-purple-700 bg-clip-text text-transparent leading-tight">
                {form.title}
              </h1>
              {form.description && (
                <p className="text-slate-600 mt-3 leading-relaxed whitespace-pre-line">
                  {form.description}
                </p>
              )}
            </div>

            <div className="space-y-5">
              {form.fields.map((f) => (
                <div key={f.key}>
                  {f.type !== "checkbox" && (
                    <label htmlFor={`f-${f.key}`} className="block text-sm font-semibold text-slate-700 mb-1.5">
                      {f.label}
                      {f.required && <span className="text-amber-500 ml-1">*</span>}
                    </label>
                  )}
                  {renderField(f)}
                </div>
              ))}
            </div>

            {fieldErr && (
              <div className="mt-5 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                {fieldErr}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-6 py-3.5 rounded-xl text-base font-extrabold text-purple-900 transition-all
                bg-gradient-to-r from-amber-300 to-yellow-400
                hover:from-amber-400 hover:to-yellow-500
                shadow-lg shadow-amber-500/40 hover:shadow-amber-500/60
                hover:scale-[1.01] active:scale-[0.99]
                disabled:from-slate-300 disabled:to-slate-400 disabled:text-white disabled:shadow-none disabled:scale-100"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block animate-spin border-2 border-purple-900 border-t-transparent rounded-full w-4 h-4" />
                  Gönderiliyor...
                </span>
              ) : (
                "🚀 Kayıt Ol"
              )}
            </button>

            <p className="text-center text-xs text-slate-400 mt-5">
              Bilgilerin yalnızca bu seminer için kullanılır.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
