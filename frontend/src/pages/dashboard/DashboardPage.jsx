import { useEffect, useState } from "react";
import api from "../../api";
import { useAuth } from "../../AuthContext";
import DashboardKpiCards from "./DashboardKpiCards";
import DashboardFinancialCard from "./DashboardFinancialCard";
import DashboardStatusChart from "./DashboardStatusChart";
import DashboardActivityFeed from "./DashboardActivityFeed";

const todayLabel = () =>
  new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get("/dashboard/summary");
      setSummary(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    // 60sn polling — açık iken canlı KPI
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Hoş geldin, <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-violet-500">
              {user?.full_name || user?.username || "👋"}
            </span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 capitalize">{todayLabel()}</p>
        </div>

        {loading && !summary ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-200/60 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <DashboardKpiCards today={summary?.today} />
        )}

        {summary?.this_month && <DashboardFinancialCard data={summary.this_month} />}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2">
            <DashboardStatusChart items={summary?.status_distribution || []} />
          </div>
          <div className="lg:col-span-3">
            <DashboardActivityFeed items={summary?.recent_activity || []} />
          </div>
        </div>
      </div>
    </div>
  );
}
