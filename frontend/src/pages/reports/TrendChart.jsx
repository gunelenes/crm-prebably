import { useRef, useState } from "react";

// Basit, bağımlılıksız çok-serili SVG çizgi grafiği (hover ipucu ile).
export default function TrendChart({ data = [], series = [], formatValue = (v) => v, height = 260 }) {
  const [hover, setHover] = useState(null); // index
  const svgRef = useRef(null);

  const W = 820;
  const H = height;
  const padL = 56, padR = 16, padT = 14, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;

  if (!n || !series.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300/70 dark:border-white/10 py-12 text-center text-sm text-slate-400 dark:text-slate-500">
        Bu aralıkta veri yok.
      </div>
    );
  }

  const vals = data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0));
  const maxV = Math.max(1, ...vals);
  const minV = Math.min(0, ...vals);
  const range = maxV - minV || 1;

  const x = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => padT + plotH - ((Number(v) || 0) - minV) / range * plotH;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minV + (range * i) / ticks);
  const zeroY = y(0);

  // x ekseni etiketleri (~6 adet)
  const labelStep = Math.max(1, Math.ceil(n / 6));
  const fmtDate = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const onMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let i = Math.round(((vx - padL) / plotW) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHover(i);
  };

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        className="overflow-visible select-none">
        {/* y gridlines + etiketler */}
        {yTicks.map((tv, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(tv)} y2={y(tv)}
              className="stroke-slate-200 dark:stroke-white/10" strokeWidth="1" />
            <text x={padL - 8} y={y(tv) + 3} textAnchor="end"
              className="fill-slate-400 dark:fill-slate-500" fontSize="10">
              {formatValue(Math.round(tv))}
            </text>
          </g>
        ))}
        {/* sıfır çizgisi (net negatif olabilir) */}
        {minV < 0 && (
          <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY}
            className="stroke-slate-400/60 dark:stroke-white/20" strokeWidth="1" strokeDasharray="3 3" />
        )}
        {/* x etiketleri */}
        {data.map((d, i) => (i % labelStep === 0 || i === n - 1) ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle"
            className="fill-slate-400 dark:fill-slate-500" fontSize="10">{fmtDate(d.date)}</text>
        ) : null)}
        {/* seriler */}
        {series.map((s) => (
          <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round"
            points={data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(" ")} />
        ))}
        {/* hover dikey çizgi + noktalar */}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH}
              className="stroke-slate-400/50 dark:stroke-white/20" strokeWidth="1" />
            {series.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key])} r="3.5"
                fill={s.color} stroke="white" strokeWidth="1.5" />
            ))}
          </g>
        )}
      </svg>

      {/* hover ipucu */}
      {hover != null && (
        <div className="absolute -top-1 pointer-events-none rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200/70 dark:border-white/10 shadow-lg px-3 py-2 text-xs"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > n / 2 ? "-110%" : "10%"})` }}>
          <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1">
            {new Date(data[hover].date + "T00:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
          </div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{s.label}
              </span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{formatValue(data[hover][s.key])}</span>
            </div>
          ))}
        </div>
      )}

      {/* legend */}
      <div className="flex flex-wrap gap-3 mt-2 px-1">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />{s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
