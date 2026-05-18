import React from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const RANK_COLORS = ['#d4a017', '#3b6fd4', '#8ca0c0'];

// Normalize a stat so that higher = better for the radar.
// For BB% and WHIP, lower is better, so we invert them.
function normalize(value, min, max, invertLowerBetter = false) {
  if (max === min) return 50;
  const raw = ((value - min) / (max - min)) * 100;
  return invertLowerBetter ? 100 - raw : raw;
}

export default function BestBetChart({ picks, pitcherProfiles }) {
  if (!picks?.length || !pitcherProfiles?.length) return null;

  // Match picks to their profiles
  const picksWithStats = picks.slice(0, 3).map((pick, i) => {
    const prof = pitcherProfiles.find(p =>
      p.name?.trim().toLowerCase() === pick.pitcher_name?.trim().toLowerCase()
    );
    return { ...pick, prof, color: RANK_COLORS[i] };
  }).filter(p => p.prof);

  if (picksWithStats.length < 2) return null;

  const metrics = [
    { key: 'kPct',       label: 'K%',      invert: false },
    { key: 'strikePct',  label: 'STR%',    invert: false },
    { key: 'whiffPct',   label: 'WHF%',    invert: false },
    { key: 'bbPct',      label: 'BB%',     invert: true  },
    { key: 'whip',       label: 'WHIP',    invert: true  },
  ];

  // Build normalized radar data
  const radarData = metrics.map(({ key, label, invert }) => {
    const vals = picksWithStats.map(p => parseFloat(p.prof[key]) || 0);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const entry = { metric: label };
    picksWithStats.forEach((p, i) => {
      entry[`p${i}`] = Math.round(normalize(parseFloat(p.prof[key]) || 0, min, max, invert));
    });
    return entry;
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
        <p className="font-bold mb-1">{label}</p>
        {payload.map((entry, i) => {
          const p = picksWithStats[parseInt(entry.dataKey.replace('p', ''))];
          const metric = metrics.find(m => m.label === label);
          const rawVal = metric ? (parseFloat(p.prof[metric.key]) ?? '—') : '—';
          return (
            <div key={i} style={{ color: entry.color }} className="flex items-center gap-1.5">
              <span>{p.pitcher_name?.toUpperCase()}: </span>
              <span className="font-semibold">{rawVal}{label !== 'WHIP' ? '%' : ''}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-muted/30 rounded-xl p-3 space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-center">
        Pitcher Comparison — Key Metrics
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={radarData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
          />
          {picksWithStats.map((p, i) => (
            <Radar
              key={i}
              name={p.pitcher_name?.toUpperCase()}
              dataKey={`p${i}`}
              stroke={p.color}
              fill={p.color}
              fillOpacity={0.12}
              strokeWidth={2}
              dot={{ r: 3, fill: p.color }}
            />
          ))}
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-[10px] font-semibold">{value}</span>
            )}
            iconSize={8}
          />
        </RadarChart>
      </ResponsiveContainer>
      <p className="text-[9px] text-muted-foreground text-center opacity-60">
        Scores normalized per category · BB% &amp; WHIP inverted (higher = better)
      </p>
    </div>
  );
}