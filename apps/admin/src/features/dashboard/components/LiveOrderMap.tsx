import { useState } from 'react';
import type { OrderDistrict } from '../api/platformAnalytics.api';

// HCMC simplified district SVG paths (normalized 0..1 space)
const DISTRICT_PATHS = [
  'M 0.22,0.18 L 0.78,0.18 L 0.88,0.32 L 0.82,0.55 L 0.75,0.72 L 0.62,0.88 L 0.42,0.88 L 0.28,0.78 L 0.18,0.62 L 0.15,0.42 L 0.18,0.28 Z',
  'M 0.68,0.18 L 0.88,0.18 L 0.88,0.32 L 0.82,0.48 L 0.72,0.42 L 0.68,0.28 Z',
  'M 0.42,0.72 L 0.62,0.72 L 0.65,0.88 L 0.42,0.88 Z',
];

// Static SVG coordinates per HCMC district name
const DISTRICT_COORDS: Record<string, { x: number; y: number }> = {
  'Q.1':        { x: 0.56, y: 0.44 },
  'Q.3':        { x: 0.48, y: 0.55 },
  'Q.5':        { x: 0.42, y: 0.50 },
  'Q.7':        { x: 0.52, y: 0.65 },
  'Q.10':       { x: 0.46, y: 0.42 },
  'Q.11':       { x: 0.44, y: 0.46 },
  'Q.12':       { x: 0.45, y: 0.22 },
  'Bình Thạnh': { x: 0.62, y: 0.38 },
  'Gò Vấp':     { x: 0.50, y: 0.30 },
  'Tân Bình':   { x: 0.43, y: 0.36 },
  'Thủ Đức':    { x: 0.70, y: 0.28 },
  'Bình Tân':   { x: 0.30, y: 0.48 },
  'Nhà Bè':     { x: 0.58, y: 0.78 },
  'Hóc Môn':    { x: 0.38, y: 0.20 },
  'Bình Chánh': { x: 0.32, y: 0.62 },
};

// Fallback for districts not in the static map — scatter them
function defaultCoords(index: number): { x: number; y: number } {
  const angle = (index / 8) * Math.PI * 2;
  return { x: 0.5 + Math.cos(angle) * 0.15, y: 0.5 + Math.sin(angle) * 0.15 };
}

interface Props {
  districts?: OrderDistrict[];
}

export function LiveOrderMap({ districts = [] }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const maxOrders = Math.max(...districts.map((d) => d.orderCount), 1);

  const clusters = districts.map((d, i) => {
    const coords = DISTRICT_COORDS[d.district] ?? defaultCoords(i);
    return { ...d, ...coords, density: d.orderCount / maxOrders };
  });

  return (
    <div className="relative w-full h-64 rounded-xl overflow-hidden bg-[#0f1a14] border border-white/5">
      {/* Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-10" preserveAspectRatio="none">
        <defs>
          <pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4ade80" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mapgrid)" />
      </svg>

      {/* District outlines + clusters */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet">
        {DISTRICT_PATHS.map((d, i) => (
          <path key={i} d={d} fill="rgba(13,99,27,0.06)" stroke="rgba(13,99,27,0.25)" strokeWidth="0.005" />
        ))}

        {/* River */}
        <path d="M 0.60,0.18 Q 0.58,0.34 0.56,0.44 Q 0.54,0.54 0.55,0.65 Q 0.56,0.75 0.58,0.88"
          fill="none" stroke="rgba(56,189,248,0.25)" strokeWidth="0.012" strokeLinecap="round" />

        {clusters.map((c) => {
          const isHovered = hovered === c.district;
          const r = 0.015 + c.density * 0.028;
          return (
            <g key={c.district}>
              <circle cx={c.x} cy={c.y} r={r * 1.8}
                fill="rgba(13,99,27,0.08)" className="animate-ping"
                style={{ animationDuration: `${2 + c.density}s` }} />
              <circle cx={c.x} cy={c.y} r={r}
                fill={`rgba(13,99,27,${0.4 + c.density * 0.5})`}
                stroke={isHovered ? '#88d982' : 'rgba(138,215,130,0.4)'}
                strokeWidth={isHovered ? 0.006 : 0.003}
                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={() => setHovered(c.district)}
                onMouseLeave={() => setHovered(null)} />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (() => {
        const c = clusters.find((cl) => cl.district === hovered);
        if (!c) return null;
        return (
          <div className="absolute pointer-events-none z-10 px-2.5 py-1.5 bg-surface-container-lowest border border-outline-variant/60 rounded-lg shadow-lg text-xs"
            style={{ left: `calc(${c.x * 100}% + 12px)`, top: `calc(${c.y * 100}% - 20px)` }}>
            <p className="font-semibold text-on-surface">{c.district}</p>
            <p className="font-mono text-on-surface-variant">{c.orderCount} orders</p>
          </div>
        );
      })()}

      {districts.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-white/30 font-mono">No district data in this window</p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-white/50">
          <span className="w-2 h-2 rounded-full bg-primary/80 inline-block" /> High density
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-white/50">
          <span className="w-2 h-2 rounded-full bg-sky-400/30 inline-block" /> River
        </span>
      </div>
      <div className="absolute top-3 right-3 text-[10px] font-mono text-white/30 uppercase tracking-widest">
        Ho Chi Minh City
      </div>
    </div>
  );
}
