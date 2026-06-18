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

const inputCls =
  "w-full rounded-xl px-4 py-3 text-base transition-all " +
  "bg-white/80 backdrop-blur border border-slate-200 " +
  "focus:outline-none focus:ring-4 focus:ring-fuchsia-300/40 focus:border-fuchsia-500 " +
  "text-slate-900 placeholder:text-slate-400";

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
        redirect_url: res.data.thank_you_redirect_url || null,
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
              className="w-5 h-5 rounded accent-fuchsia-500"
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
              className={`${inputCls} w-28`}
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
              className={`${inputCls} flex-1`}
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600 py-10 px-4 flex items-center justify-center">
      {/* Dekoratif bloblar */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 h-96 w-96 rounded-full bg-pink-300/40 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-fuchsia-300/40 blur-3xl animate-pulse" />
      </div>

      <div className="relative w-full max-w-xl">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin border-4 border-white/70 border-t-transparent rounded-full w-12 h-12" />
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-white/90 backdrop-blur-2xl shadow-2xl shadow-purple-500/30 p-10 text-center">
            <div className="text-6xl mb-3">🚫</div>
            <div className="text-xl font-bold text-slate-800 mb-2">Form Açılamadı</div>
            <p className="text-slate-600">{error}</p>
          </div>
        ) : submitted ? (
          <div className="rounded-3xl bg-white/90 backdrop-blur-2xl shadow-2xl shadow-purple-500/30 p-10 text-center">
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <div className="text-2xl font-extrabold bg-gradient-to-r from-fuchsia-600 to-indigo-600 bg-clip-text text-transparent mb-3">
              Kaydın Alındı!
            </div>
            <p className="text-slate-700 whitespace-pre-line leading-relaxed">{submitted.message}</p>
            {submitted.redirect_url && (
              <a
                href={submitted.redirect_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-6 py-3 px-7 rounded-xl text-base font-semibold text-white
                  bg-gradient-to-r from-fuchsia-500 to-indigo-500
                  hover:from-fuchsia-600 hover:to-indigo-600
                  shadow-lg shadow-fuchsia-500/40 hover:scale-[1.03] active:scale-[0.98] transition-transform"
              >
                Devam Et →
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-3xl bg-white/90 backdrop-blur-2xl shadow-2xl shadow-purple-500/30 p-7 md:p-10">
            <div className="text-center mb-6">
              <div className="text-5xl md:text-6xl mb-3 animate-bounce">🎓</div>
              <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-fuchsia-600 to-indigo-600 bg-clip-text text-transparent leading-tight">
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
                      {f.required && <span className="text-fuchsia-500 ml-1">*</span>}
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
              className="w-full mt-6 py-3.5 rounded-xl text-base font-semibold text-white transition-all
                bg-gradient-to-r from-fuchsia-500 to-indigo-500
                hover:from-fuchsia-600 hover:to-indigo-600
                shadow-lg shadow-fuchsia-500/40 hover:shadow-fuchsia-500/60
                hover:scale-[1.01] active:scale-[0.99]
                disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none disabled:scale-100"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
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
