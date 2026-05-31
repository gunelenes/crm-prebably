import { useEffect, useState } from "react";
import { useAuth } from "../../AuthContext";
import StatusesTab from "./StatusesTab";
import SectorsTab from "./SectorsTab";
import TrainingSetsTab from "./TrainingSetsTab";
import BankAccountsTab from "./BankAccountsTab";
import AdAccountsTab from "./AdAccountsTab";

const TABS = [
  { id: "statuses", label: "Statüler", icon: "🏷️", Component: StatusesTab },
  { id: "sectors", label: "Sektörler", icon: "🏢", Component: SectorsTab },
  { id: "training_sets", label: "Eğitim Setleri", icon: "🎬", Component: TrainingSetsTab },
  { id: "bank_accounts", label: "Banka Hesapları", icon: "🏦", Component: BankAccountsTab, adminOnly: true },
  { id: "ad_accounts", label: "Reklam Hesapları", icon: "📊", Component: AdAccountsTab, adminOnly: true },
];

export default function ParametersPage() {
  const { user } = useAuth();
  const visibleTabs = TABS.filter((t) => !t.adminOnly || user?.role === "admin");

  const [active, setActive] = useState(visibleTabs[0]?.id || "statuses");

  // Eğer aktif tab gizli olduysa ilk görünüre düş
  useEffect(() => {
    if (!visibleTabs.find((t) => t.id === active)) {
      setActive(visibleTabs[0]?.id);
    }
  }, [visibleTabs, active]);

  const ActiveComponent = visibleTabs.find((t) => t.id === active)?.Component;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Parametreler</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Statü, sektör ve eğitim setlerini buradan yönet</p>
        </div>

        <div className="rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-1 mb-6 inline-flex gap-1">
          {visibleTabs.map((t) => {
            const isActive = active === t.id;
            return (
              <button key={t.id} onClick={() => setActive(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${isActive
                  ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5"}`}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}
