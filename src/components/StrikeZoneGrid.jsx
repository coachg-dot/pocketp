import React from 'react';
import { cn } from '@/lib/utils';

// Strike zone: zones 1-9 (3x3 inner grid)
// Ball zones: 11-19 (outer ring, 5x5 grid minus inner 3x3)
// 5x5 layout:
//  11 12 13 14 15
//  16  1  2  3 17
//  18  4  5  6 19
//  20  7  8  9 21
//  22 23 24 25 26

// Each cell in the 5x5 grid: [row, col] → zone id
const GRID_5x5 = [
  [11, 12, 13, 14, 15],
  [16,  1,  2,  3, 17],
  [18,  4,  5,  6, 19],
  [20,  7,  8,  9, 21],
  [22, 23, 24, 25, 26],
];

const STRIKE_ZONES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

const RESULT_COLORS = {
  ball: 'bg-blue-500',
  called_strike: 'bg-red-500',
  swinging_strike: 'bg-orange-500',
  foul: 'bg-yellow-500',
  in_play_out: 'bg-green-600',
  in_play_hit: 'bg-green-400',
  hit_by_pitch: 'bg-purple-500',
};

export default function StrikeZoneGrid({ pitches = [], onZoneSelect, selectedZone }) {
  // Build map: zone number → pitches
  const heatMap = {};
  pitches.forEach(p => {
    if (p.zone != null) {
      heatMap[p.zone] = heatMap[p.zone] || [];
      heatMap[p.zone].push(p);
    }
  });

  const allCounts = Object.values(heatMap).map(a => a.length);
  const maxCount = Math.max(1, ...allCounts);

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-muted-foreground">Tap a zone to mark pitch location</p>

      {/* Legend: zone type */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-muted/60 border border-foreground/30 inline-block" /> Strike Zone</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-400/50 inline-block" /> Ball Zone</span>
      </div>

      <div
        className="grid gap-0.5 rounded p-1"
        style={{ gridTemplateColumns: 'repeat(5, 1fr)', width: 230 }}
      >
        {GRID_5x5.map((row, ri) =>
          row.map((zone, ci) => {
            const hits = heatMap[zone] || [];
            const heat = hits.length / maxCount;
            const isSelected = selectedZone === zone;
            const isStrike = STRIKE_ZONES.has(zone);

            return (
              <button
                type="button"
                key={`${ri}-${ci}`}
                onClick={() => onZoneSelect?.(zone)}
                className={cn(
                  'relative rounded flex items-center justify-center transition-all border-2',
                  isSelected
                    ? 'border-primary ring-2 ring-primary/50 bg-primary/20 scale-105'
                    : isStrike
                      ? 'border-foreground/30 bg-muted/60 hover:bg-muted'
                      : 'border-blue-400/40 bg-blue-500/10 hover:bg-blue-500/20'
                )}
                style={{ height: isStrike ? 52 : 42, width: '100%', minHeight: 'unset', minWidth: 'unset' }}
              >
                {/* Heat overlay */}
                {hits.length > 0 && (
                  <span
                    className="absolute inset-0 rounded"
                    style={{ backgroundColor: `rgba(255, 80, 0, ${heat * 0.65})` }}
                  />
                )}

                {/* Pitch dots */}
                <span className="relative z-10 flex flex-wrap gap-0.5 justify-center items-center p-0.5 h-full w-full">
                  {hits.slice(0, 4).map((p, i) => (
                    <span
                      key={i}
                      className={cn('w-2 h-2 rounded-full shrink-0', RESULT_COLORS[p.result] || 'bg-gray-400')}
                    />
                  ))}
                </span>

                {/* Zone number when empty */}
                {hits.length === 0 && (
                  <span className={cn(
                    'relative z-10 font-bold',
                    isStrike ? 'text-sm' : 'text-[10px]',
                    isSelected ? 'text-primary' : 'text-muted-foreground/50'
                  )}>
                    {isStrike ? zone : '·'}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Result color legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
        {Object.entries(RESULT_COLORS).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1">
            <span className={cn('w-2 h-2 rounded-full shrink-0', color)} />
            <span className="text-[10px] text-muted-foreground">{key.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}