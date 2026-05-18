import React, { useMemo } from 'react';

const HIT_RESULTS = ['single', 'double', 'triple', 'home_run', 'bunt_single'];
const AT_BAT_RESULTS = ['single','double','triple','home_run','bunt_single','groundout','flyout','lineout',
  'popout','strikeout_swinging','strikeout_looking','fielders_choice','double_play','triple_play',
  'error','rbi_groundout','bunt_out'];

const PITCH_LABEL = {
  '4seam':'4-Seam','2seam':'2-Seam','fastball':'Fastball','sinker':'Sinker',
  'cutter':'Cutter','slider':'Slider','sweeper':'Sweeper','slurve':'Slurve',
  'curveball':'Curveball','knuckle_curve':'Knuckle Curve','changeup':'Changeup',
  'splitter':'Splitter','knuckleball':'Knuckleball','eephus':'Eephus',
};
const PITCH_COLOR = {
  '4seam':'bg-red-500','2seam':'bg-orange-500','fastball':'bg-red-400','sinker':'bg-amber-500',
  'cutter':'bg-lime-500','slider':'bg-purple-500','sweeper':'bg-violet-600','slurve':'bg-violet-400',
  'curveball':'bg-blue-500','knuckle_curve':'bg-blue-400','changeup':'bg-green-500',
  'splitter':'bg-emerald-500','knuckleball':'bg-slate-500','eephus':'bg-pink-500',
};

function fmt3(n) {
  if (n == null || isNaN(n)) return '—';
  return '.' + String(Math.round(n * 1000)).padStart(3, '0');
}

export default function BatterPitchSplits({ pitches, atBats }) {
  const splits = useMemo(() => {
    // Build a map from at_bat_id → last pitch type to know what was thrown in a given PA
    const abPitchType = {};
    // Group pitches by at_bat_id, pick the last one
    const byAB = {};
    pitches.forEach(p => {
      if (!p.at_bat_id) return;
      if (!byAB[p.at_bat_id]) byAB[p.at_bat_id] = [];
      byAB[p.at_bat_id].push(p);
    });
    Object.entries(byAB).forEach(([abId, ps]) => {
      const sorted = [...ps].sort((a, b) => (a.pitch_number || 0) - (b.pitch_number || 0));
      const last = sorted[sorted.length - 1];
      if (last?.pitch_type) abPitchType[abId] = last.pitch_type;
    });

    // Also build by (player_name + inning) as fallback when at_bat_id is not linked
    const typeStats = {};

    atBats.forEach(ab => {
      const type = abPitchType[ab.id];
      if (!type) return;
      if (!AT_BAT_RESULTS.includes(ab.result)) return;
      if (!typeStats[type]) typeStats[type] = { abs: 0, hits: 0, ks: 0, walks: 0 };
      typeStats[type].abs++;
      if (HIT_RESULTS.includes(ab.result)) typeStats[type].hits++;
      if (ab.result?.includes('strikeout')) typeStats[type].ks++;
      if (ab.result === 'walk') typeStats[type].walks++;
    });

    return Object.entries(typeStats)
      .filter(([, s]) => s.abs >= 2)
      .sort((a, b) => b[1].abs - a[1].abs)
      .map(([type, s]) => ({
        type,
        label: PITCH_LABEL[type] || type,
        color: PITCH_COLOR[type] || 'bg-slate-400',
        abs: s.abs,
        hits: s.hits,
        ks: s.ks,
        avg: s.abs > 0 ? s.hits / s.abs : null,
        kPct: s.abs > 0 ? s.ks / s.abs : null,
      }));
  }, [pitches, atBats]);

  if (splits.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-3">
        No pitch-type split data yet — pitch tracking required.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b">
            <th className="text-left pb-2 pr-2">Pitch</th>
            <th className="text-center pb-2 px-1">AB</th>
            <th className="text-center pb-2 px-1">H</th>
            <th className="text-center pb-2 px-1">AVG</th>
            <th className="text-center pb-2 px-1">K%</th>
          </tr>
        </thead>
        <tbody>
          {splits.map(s => {
            const avgNum = s.avg ?? 0;
            const isWeak = avgNum < 0.200 && s.abs >= 5;
            const isGood = avgNum >= 0.300 && s.abs >= 5;
            return (
              <tr key={s.type} className={`border-b border-muted/30 last:border-0 ${isWeak ? 'bg-destructive/5' : isGood ? 'bg-primary/5' : ''}`}>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${s.color}`} />
                    <span className="font-medium">{s.label}</span>
                    {isWeak && <span className="text-destructive text-[9px] font-bold ml-1">↓ WEAK</span>}
                    {isGood && <span className="text-primary text-[9px] font-bold ml-1">↑ HOT</span>}
                  </div>
                </td>
                <td className="py-2 px-1 text-center text-muted-foreground">{s.abs}</td>
                <td className="py-2 px-1 text-center">{s.hits}</td>
                <td className={`py-2 px-1 text-center font-semibold ${isWeak ? 'text-destructive' : isGood ? 'text-primary' : ''}`}>
                  {s.avg != null ? fmt3(s.avg) : '—'}
                </td>
                <td className={`py-2 px-1 text-center ${s.kPct != null && s.kPct >= 0.35 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                  {s.kPct != null ? Math.round(s.kPct * 100) + '%' : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}