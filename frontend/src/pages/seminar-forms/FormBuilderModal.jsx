import { useEffect, useRef, useState } from "react";
import api from "../../api";
import Spinner from "../../components/Spinner";

// `w-full`'ı ayrı tutuyoruz: aksi halde alan satırındaki sabit genişlikli
// (w-44) tip seçici select'i ezip tüm satırı bozuyordu.
const inputBase =
  "rounded-xl px-4 py-2 text-sm transition-all " +
  "bg-white/60 dark:bg-slate-800/50 backdrop-blur " +
  "border border-slate-200/60 dark:border-white/10 " +
  "focus:bg-white dark:focus:bg-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 focus:border-fuchsia-500 " +
  "text-slate-800 dark:text-slate-100";

const inputCls = `w-full ${inputBase}`;

const FIELD_TYPES = [
  { value: "text", label: "Kısa Metin" },
  { value: "textarea", label: "Uzun Metin" },
  { value: "email", label: "E-posta" },
  { value: "phone", label: "Telefon (ülke kodu + numara)" },
  { value: "select", label: "Açılır Liste" },
  { value: "checkbox", label: "Onay Kutusu" },
  { value: "number", label: "Sayı" },
  { value: "date", label: "Tarih" },
];

const DEFAULT_TEMPLATE = [
  { key: "ad", label: "Adınız", type: "text", required: true, placeholder: "" },
  { key: "soyad", label: "Soyadınız", type: "text", required: true, placeholder: "" },
  { key: "email", label: "E-posta", type: "email", required: true, placeholder: "ornek@mail.com" },
  { key: "telefon", label: "Telefon", type: "phone", required: true, placeholder: "" },
];

function slugifyKey(text) {
  if (!text) return "";
  const map = { ı: "i", İ: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g", ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c" };
  return text
    .split("")
    .map((c) => map[c] || c)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function newField() {
  return { key: "", label: "", type: "text", required: false, placeholder: "", options: [] };
}

export default function FormBuilderModal({ form = null, onClose, onSaved }) {
  const isEdit = !!form;
  const [title, setTitle] = useState(form?.title || "");
  const [slug, setSlug] = useState(form?.slug || "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(form?.description || "");
  const [fields, setFields] = useState(
    form?.fields?.length ? form.fields.map((f) => ({ ...f, options: f.options || [] })) : []
  );
  const [thankYouMessage, setThankYouMessage] = useState(form?.thank_you_message || "");
  const [whatsappUrl, setWhatsappUrl] = useState(form?.whatsapp_url || "");
  const [websiteUrl, setWebsiteUrl] = useState(form?.website_url || form?.thank_you_redirect_url || "");
  const [isActive, setIsActive] = useState(form?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  // Otomatik e-posta
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(form?.company_id ? String(form.company_id) : "");
  const [emailSubject, setEmailSubject] = useState(form?.email_subject || "");
  const [emailBody, setEmailBody] = useState(form?.email_body || "");
  const [emailAutosend, setEmailAutosend] = useState(form?.email_autosend ?? false);

  useEffect(() => {
    api.get("/companies").then((r) => setCompanies(r.data)).catch(() => setCompanies([]));
  }, []);

  // İçeriğe değişken eklemek için kullanılabilir alan anahtarları
  const varKeys = fields.map((f) => (f.key || slugifyKey(f.label))).filter(Boolean);
  const emailBodyRef = useRef(null);

  // Seçili metni başına/sonuna ekleyerek sarar (kalın, link). Seçim yoksa placeholder kullanır.
  const wrapSelection = (before, after, placeholder) => {
    const el = emailBodyRef.current;
    if (!el) {
      setEmailBody((b) => b + before + placeholder + after);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = emailBody.slice(start, end) || placeholder;
    const next = emailBody.slice(0, start) + before + sel + after + emailBody.slice(end);
    setEmailBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + before.length;
      el.setSelectionRange(pos, pos + sel.length);
    });
  };
  const insertVar = (k) => {
    const token = `{${k}}`;
    const el = emailBodyRef.current;
    if (!el) { setEmailBody((b) => (b ? `${b} ${token}` : token)); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setEmailBody(emailBody.slice(0, start) + token + emailBody.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  useEffect(() => {
    if (!slugTouched && title) {
      setSlug(slugifyKey(title).replace(/_/g, "-"));
    }
  }, [title, slugTouched]);

  const useTemplate = () => {
    setFields(DEFAULT_TEMPLATE.map((f) => ({ ...f, options: [] })));
  };

  const updateField = (idx, patch) => {
    setFields((arr) => arr.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const moveField = (idx, dir) => {
    setFields((arr) => {
      const next = [...arr];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return arr;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const removeField = (idx) => {
    setFields((arr) => arr.filter((_, i) => i !== idx));
  };

  const addField = () => {
    setFields((arr) => [...arr, newField()]);
  };

  const setOptions = (idx, raw) => {
    const opts = raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    updateField(idx, { options: opts });
  };

  const save = async () => {
    if (!title.trim()) {
      alert("Başlık zorunlu");
      return;
    }
    if (fields.length === 0) {
      alert("En az bir alan eklemelisin");
      return;
    }
    // Eksik etiket / select için seçenek kontrolü (backend de doğrular ama kullanıcıya hızlı feedback)
    for (const f of fields) {
      if (!f.label?.trim()) {
        alert("Her alanın bir etiketi olmalı");
        return;
      }
      if (f.type === "select" && (!f.options || f.options.length === 0)) {
        alert(`'${f.label}' için en az bir seçenek girmelisin`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        description: description.trim(),
        fields: fields.map((f) => ({
          key: (f.key || slugifyKey(f.label)).trim(),
          label: f.label.trim(),
          type: f.type,
          required: !!f.required,
          placeholder: f.placeholder || "",
          ...(f.type === "select" ? { options: f.options } : {}),
        })),
        thank_you_message: thankYouMessage.trim(),
        whatsapp_url: whatsappUrl.trim(),
        website_url: websiteUrl.trim(),
        is_active: isActive,
        company_id: companyId ? Number(companyId) : null,
        email_subject: emailSubject.trim(),
        email_body: emailBody.trim(),
        email_autosend: emailAutosend,
      };
      if (isEdit) {
        await api.put(`/seminar-forms/${form.id}`, payload);
      } else {
        await api.post("/seminar-forms", payload);
      }
      onSaved?.();
    } catch (e) {
      alert("Kaydedilemedi: " + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="rounded-3xl p-7 w-full max-w-2xl my-8 bg-white/85 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl shadow-fuchsia-500/10">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-5 flex items-center gap-2">
          <span>{isEdit ? "✏️" : "✨"}</span>
          {isEdit ? "Formu Düzenle" : "Yeni Seminer Formu"}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
              Başlık
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Yapay Zeka ile Verimlilik Semineri"
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
              Public Link (slug)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {window.location.origin}/f/
              </span>
              <input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""));
                  setSlugTouched(true);
                }}
                placeholder="yapay-zeka-semineri"
                className={inputCls}
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Başlıktan otomatik üretilir; istersen değiştir. Çakışırsa otomatik numara eklenir.
            </p>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
              Açıklama (form sayfasının üstünde gösterilir)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bu seminere kayıt için aşağıdaki bilgileri doldurman yeterli."
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Alanlar */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/10 p-4 bg-slate-50/50 dark:bg-white/5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                📝 Form Alanları ({fields.length})
              </div>
              <div className="flex gap-2">
                {fields.length === 0 && (
                  <button
                    type="button"
                    onClick={useTemplate}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500/15 to-indigo-500/15 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-300/40 dark:border-fuchsia-500/30 hover:from-fuchsia-500/25 hover:to-indigo-500/25 transition-all"
                  >
                    ✨ Standart şablondan başla
                  </button>
                )}
                <button
                  type="button"
                  onClick={addField}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10 transition-colors"
                >
                  + Alan Ekle
                </button>
              </div>
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">
                Henüz alan yok. "Standart şablondan başla" ile hızlı doldur veya "Alan Ekle" ile teker teker ekle.
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((f, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl bg-white/80 dark:bg-slate-900/60 backdrop-blur border border-slate-200/60 dark:border-white/10 p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400 w-6">#{idx + 1}</span>
                      <input
                        value={f.label}
                        onChange={(e) => updateField(idx, { label: e.target.value })}
                        placeholder="Alan etiketi (ör. Mesleğiniz)"
                        className={`${inputBase} flex-1 min-w-0`}
                      />
                      <select
                        value={f.type}
                        onChange={(e) => updateField(idx, { type: e.target.value })}
                        className={`${inputBase} w-44 shrink-0`}
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap pl-8">
                      {f.type !== "checkbox" && (
                        <input
                          value={f.placeholder || ""}
                          onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                          placeholder="İpucu metni (placeholder, opsiyonel)"
                          className={`${inputCls} flex-1 min-w-[180px]`}
                        />
                      )}
                      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!f.required}
                          onChange={(e) => updateField(idx, { required: e.target.checked })}
                          className="rounded accent-fuchsia-500"
                        />
                        Zorunlu
                      </label>
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          type="button"
                          onClick={() => moveField(idx, -1)}
                          disabled={idx === 0}
                          title="Yukarı"
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(idx, +1)}
                          disabled={idx === fields.length - 1}
                          title="Aşağı"
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 disabled:opacity-30"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => removeField(idx)}
                          className="text-rose-500 hover:bg-rose-500/10 rounded-lg px-2 py-1 text-xs transition-colors"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                    {f.type === "select" && (
                      <div className="pl-8">
                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                          Seçenekler (her satıra bir tane)
                        </label>
                        <textarea
                          value={(f.options || []).join("\n")}
                          onChange={(e) => setOptions(idx, e.target.value)}
                          placeholder={"Instagram\nArkadaş tavsiyesi\nGoogle"}
                          rows={3}
                          className={`${inputCls} resize-none font-mono text-xs`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teşekkür */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/10 p-4 bg-slate-50/50 dark:bg-white/5 space-y-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              🎉 Kayıt Sonrası Mesaj
            </div>
            <textarea
              value={thankYouMessage}
              onChange={(e) => setThankYouMessage(e.target.value)}
              placeholder="Teşekkürler! Seminer detayları en kısa sürede e-posta adresine gönderilecek."
              rows={2}
              className={`${inputCls} resize-none`}
            />
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                💬 WhatsApp grubu linki (opsiyonel)
              </label>
              <input
                value={whatsappUrl}
                onChange={(e) => setWhatsappUrl(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400 block mb-1">
                🌐 Web sitesi linki (opsiyonel)
              </label>
              <input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://baharatmedya.net"
                className={inputCls}
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Girdiğin linkler kayıt sonrası teşekkür ekranında ayrı butonlar olarak gösterilir.
            </p>
          </div>

          {/* Otomatik e-posta */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/10 p-4 bg-slate-50/50 dark:bg-white/5 space-y-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              📧 Otomatik E-posta
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-1">
              Açarsan, forma e-posta adresiyle kayıt olan herkese otomatik bir mail gider.
              Gönderen ismi seçtiğin şirket olur; mail "info@baharatmedya.net" üzerinden gönderilir.
            </p>

            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                Gönderen Şirket (yanıt adresi)
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className={inputCls}
              >
                <option value="">Şirket seçilmedi</option>
                {companies.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
              {companies.length === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  Henüz şirket yok. Parametreler → Şirket Bilgileri'nden ekleyebilirsin.
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                Mail Konusu
              </label>
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Örn: Merhaba {ad}, kaydın alındı!"
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                Mail İçeriği
              </label>
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <button type="button" onClick={() => wrapSelection("**", "**", "kalın yazı")}
                  className="text-xs font-bold px-2.5 py-1 rounded-md bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10 transition-colors"
                  title="Seçili metni kalın yapar">B</button>
                <button type="button" onClick={() => wrapSelection("[", "](https://)", "bağlantı metni")}
                  className="text-xs px-2.5 py-1 rounded-md bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10 transition-colors"
                  title="Bağlantı (link) ekler">🔗 Link</button>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Kalın için **metin**, link için [metin](https://...)
                </span>
              </div>
              <textarea
                ref={emailBodyRef}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder={"Merhaba {ad},\n\nSeminere kaydın başarıyla alındı. Detaylar yakında bu adrese gönderilecek.\n\nSevgiler."}
                rows={6}
                className={`${inputCls} resize-none`}
              />
              {varKeys.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">Değişken ekle:</span>
                  {varKeys.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => insertVar(k)}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-300/40 dark:border-fuchsia-500/30 hover:bg-fuchsia-500/20 transition-colors"
                    >
                      {`{${k}}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={emailAutosend}
                onChange={(e) => setEmailAutosend(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-fuchsia-500 peer-checked:to-indigo-500 after:content-[''] after:absolute after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 relative" />
              <span className="text-sm text-slate-700 dark:text-slate-200">
                Kayıttan sonra otomatik e-posta gönder
              </span>
            </label>
          </div>

          {/* Aktif toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-fuchsia-500 peer-checked:to-indigo-500 after:content-[''] after:absolute after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 relative" />
            <span className="text-sm text-slate-700 dark:text-slate-200">
              Form aktif (link açık olsun)
            </span>
          </label>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all
              bg-gradient-to-r from-fuchsia-500 to-indigo-500
              hover:from-fuchsia-600 hover:to-indigo-600
              shadow-lg shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50
              disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700"
          >
            {saving ? <Spinner /> : isEdit ? "Güncelle" : "Oluştur"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors
              bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10
              text-slate-700 dark:text-slate-200
              border border-slate-200/60 dark:border-white/10"
          >
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}
