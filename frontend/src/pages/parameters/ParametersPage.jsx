import { useState } from "react";
import StatusesTab from "./StatusesTab";
import SectorsTab from "./SectorsTab";
import TrainingSetsTab from "./TrainingSetsTab";

const TABS = [
  { id: "statuses", label: "🏷️ Statüler", Component: StatusesTab },
  { id: "sectors", label: "🏢 Sektörler", Component: SectorsTab },
  { id: "training_sets", label: "🎬 Eğitim Setleri", Component: TrainingSetsTab },
];

export default function ParametersPage() {
  const [active, setActive] = useState("statuses");
  const ActiveComponent = TABS.find((t) => t.id === active).Component;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Parametreler</h2>
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActive(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              active === t.id
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      <ActiveComponent />
    </div>
  );
}
