const fmt = (n) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n || 0);

function Card({ icon, label, value, gradient, shadow }) {
  return (
    <div className={`rounded-2xl p-5 text-white shadow-xl ${gradient} ${shadow}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider opacity-90 font-semibold">{label}</span>
        <span className="text-xl opacity-90">{icon}</span>
      </div>
      <div className="text-2xl font-bold mt-1">{fmt(value)}</div>
    </div>
  );
}

export default function PaymentSummary({ summary }) {
  const { income = 0, expense = 0, net = 0 } = summary || {};
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Card icon="💰" label="Toplam Gelir" value={income}
        gradient="bg-gradient-to-br from-emerald-400 to-emerald-600" shadow="shadow-emerald-500/30" />
      <Card icon="💸" label="Toplam Gider" value={expense}
        gradient="bg-gradient-to-br from-rose-400 to-rose-600" shadow="shadow-rose-500/30" />
      <Card icon="📊" label="Net" value={net}
        gradient="bg-gradient-to-br from-indigo-500 to-violet-500" shadow="shadow-indigo-500/30" />
    </div>
  );
}
