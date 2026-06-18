import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import Spinner from "../../components/Spinner";
import FormBuilderModal from "./FormBuilderModal";

function publicLinkFor(slug) {
  return `${window.location.origin}/f/${slug}`;
}

export default function SeminarFormsPage() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // form objesi veya {} (yeni)
  const [copiedSlug, setCopiedSlug] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/seminar-forms");
      setForms(res.data || []);
    } catch (e) {
      alert("Formlar yüklenemedi: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copyLink = async (slug) => {
    const link = publicLinkFor(slug);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug((s) => (s === slug ? "" : s)), 1500);
    } catch {
      window.prompt("Linki kopyala:", link);
    }
  };

  const toggleActive = async (form) => {
    try {
      await api.put(`/seminar-forms/${form.id}`, { is_active: !form.is_active });
      await load();
    } catch (e) {
      alert("Güncellenemedi: " + (e.response?.data?.detail || e.message));
    }
  };

  const remove = async (form) => {
    const sure = window.confirm(
      `"${form.title}" formunu silmek istediğine emin misin?\n\nTüm kayıtlar (${form.registration_count || 0} adet) da silinecek. Bu işlem geri alınamaz.`
    );
    if (!sure) return;
    try {
      await api.delete(`/seminar-forms/${form.id}`);
      await load();
    } catch (e) {
      alert("Silinemedi: " + (e.response?.data?.detail || e.message));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>🎓</span> Seminer Formları
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Ücretsiz seminerler için kayıt formları oluştur. Her formun benzersiz bir public linki olur.
            </p>
          </div>
          <button
            onClick={() => setEditing({})}
            className="py-2 px-5 rounded-xl text-sm font-semibold text-white transition-all
              bg-gradient-to-r from-fuchsia-500 to-indigo-500
              hover:from-fuchsia-600 hover:to-indigo-600
              shadow-lg shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50"
          >
            + Yeni Form
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="w-8 h-8 text-indigo-500" />
          </div>
        ) : forms.length === 0 ? (
          <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-10 text-center">
            <div className="text-5xl mb-3">📋</div>
            <div className="text-slate-700 dark:text-slate-200 font-medium mb-1">
              Henüz seminer formu yok
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Sağ üstteki "Yeni Form" butonuna tıklayarak ilk formunu oluştur.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {forms.map((f) => (
              <div
                key={f.id}
                className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {f.title}
                      </h3>
                      {!f.is_active && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                          Pasif
                        </span>
                      )}
                    </div>
                    {f.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                        {f.description}
                      </p>
                    )}
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                      <span>📝 {f.fields?.length || 0} alan</span>
                      <span>👥 {f.registration_count ?? 0} kayıt</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!!f.is_active}
                      onChange={() => toggleActive(f)}
                    />
                    <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-fuchsia-500 peer-checked:to-indigo-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>

                <div className="rounded-xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 px-3 py-2 mb-3 flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate flex-1">
                    /f/{f.slug}
                  </span>
                  <button
                    onClick={() => copyLink(f.slug)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-indigo-600 dark:text-indigo-300 border border-slate-200/60 dark:border-white/10"
                  >
                    {copiedSlug === f.slug ? "✓ Kopyalandı" : "Linki Kopyala"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/seminer-formlari/${f.id}/kayitlar`}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-500/30 hover:from-indigo-600 hover:to-violet-600 transition-all"
                  >
                    👥 Kayıtlar
                  </Link>
                  <a
                    href={publicLinkFor(f.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10 transition-colors"
                  >
                    👁️ Önizle
                  </a>
                  <button
                    onClick={() => setEditing(f)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => remove(f)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 transition-colors ml-auto"
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <FormBuilderModal
          form={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
