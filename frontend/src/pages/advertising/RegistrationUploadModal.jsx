import { useState } from "react";
import api from "../../api";
import Spinner from "../../components/Spinner";

const MAX_SIZE = 5 * 1024 * 1024;

export default function RegistrationUploadModal({ onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const onPick = (f) => {
    setError("");
    setResult(null);
    if (!f) { setFile(null); return; }
    const isCsv = f.name.toLowerCase().endsWith(".csv") || (f.type || "").includes("csv") || (f.type || "").includes("excel");
    if (!isCsv) { setError("Lütfen bir .csv dosyası seçin"); return; }
    if (f.size > MAX_SIZE) { setError("Dosya 5MB'tan büyük olamaz"); return; }
    setFile(f);
  };

  const submit = async () => {
    if (!file) { setError("Dosya seçin"); return; }
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/registrations/upload", fd);
      setResult(res.data);
      onUploaded?.();
    } catch (err) {
      setError(err.response?.data?.detail || "Yükleme başarısız");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-3xl p-7 bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl shadow-indigo-500/20">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-1 flex items-center gap-2">
          <span>📥</span> Wix Kayıt CSV Yükle
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Wix'ten indirdiğiniz seminer kayıt CSV'sini yükleyin. İsim, e-posta, telefon ve seminer sütunları otomatik tanınır; tekrar yüklemede mükerrer kayıtlar atlanır.
        </p>

        {result ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <ResultStat label="Eklendi" value={result.inserted} accent="text-emerald-500" />
              <ResultStat label="Atlandı" value={result.skipped} accent="text-amber-500" />
              <ResultStat label="Eşleşti" value={result.matched} accent="text-indigo-500" />
            </div>
            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
              Toplam {result.total_rows} satır işlendi. “Eşleşti” = CRM'deki bir kişiyle e-posta/telefon eşleşmesi.
            </p>
            <button onClick={onClose}
              className="w-full py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 shadow-lg shadow-indigo-500/30">
              Kapat
            </button>
          </div>
        ) : (
          <>
            {file ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 mb-4">
                <span className="text-2xl">📄</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{file.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
                <button type="button" onClick={() => setFile(null)}
                  className="text-rose-500 hover:bg-rose-500/10 rounded-lg px-2 py-1 text-xs">Kaldır</button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 p-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/10 cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors mb-4">
                <span className="text-2xl">📎</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">CSV dosyası seç</span>
                <input type="file" accept=".csv,text/csv" onChange={(e) => onPick(e.target.files?.[0])} className="hidden" />
              </label>
            )}

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded-xl px-3 py-2 mb-3">{error}</div>
            )}

            <div className="flex gap-2">
              <button onClick={submit} disabled={saving || !file}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 shadow-lg shadow-indigo-500/30 disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700">
                {saving ? <Spinner /> : "Yükle"}
              </button>
              <button onClick={onClose} disabled={saving}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10">İptal</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResultStat({ label, value, accent }) {
  return (
    <div className="rounded-xl bg-slate-100/60 dark:bg-white/5 py-3">
      <div className={`text-2xl font-bold font-mono ${accent}`}>{value ?? 0}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
