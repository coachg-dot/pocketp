import React from 'react';

/**
 * Compact baseball diamond with base runner indicators.
 * Props:
 *   bases: { first, second, third } booleans
 *   runnerLabels: { first, second, third } — optional label per base (jersey # or initials)
 */
function RunnerDot({ x, y, occupied, label }) {
  if (!occupied) return null;
  return (
    <g>
      <circle cx={x} cy={y} r="10" fill="#ef4444" stroke="white" strokeWidth="1.5" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">
        {label || '●'}
      </text>
    </g>
  );
}

export default function BasesRunnerMini({ bases = {}, runnerLabels = {} }) {
  const occupied = {
    first: !!bases.first,
    second: !!bases.second,
    third: !!bases.third,
  };

  return (
    <div className="flex items-center justify-center py-1">
      <svg viewBox="0 0 90 82" width="90" height="82">
        {/* Diamond outline */}
        <polygon points="45,8 78,42 45,76 12,42"
          fill="none" stroke="hsl(210 15% 88%)" strokeWidth="1.5" />

        {/* Home plate */}
        <polygon points="45,76 40,81 40,86 50,86 50,81"
          fill="white" stroke="hsl(210 15% 88%)" strokeWidth="1" />

        {/* Base squares (empty = muted, occupied handled by RunnerDot) */}
        {/* Second (top) */}
        {!occupied.second && (
          <rect x="41" y="4" width="8" height="8"
            fill="hsl(210 15% 88%)" stroke="white" strokeWidth="1"
            transform="rotate(45 45 8)" />
        )}
        {/* Third (left) */}
        {!occupied.third && (
          <rect x="8" y="38" width="8" height="8"
            fill="hsl(210 15% 88%)" stroke="white" strokeWidth="1"
            transform="rotate(45 12 42)" />
        )}
        {/* First (right) */}
        {!occupied.first && (
          <rect x="74" y="38" width="8" height="8"
            fill="hsl(210 15% 88%)" stroke="white" strokeWidth="1"
            transform="rotate(45 78 42)" />
        )}

        {/* Runner dots */}
        <RunnerDot x={45} y={8}  occupied={occupied.second} label={runnerLabels.second} />
        <RunnerDot x={12} y={42} occupied={occupied.third}  label={runnerLabels.third}  />
        <RunnerDot x={78} y={42} occupied={occupied.first}  label={runnerLabels.first}  />
      </svg>

      {/* Legend */}
      {(occupied.first || occupied.second || occupied.third) && (
        <div className="ml-2 text-[10px] text-muted-foreground leading-tight">
          {occupied.first  && <div>1B: {runnerLabels.first  || '—'}</div>}
          {occupied.second && <div>2B: {runnerLabels.second || '—'}</div>}
          {occupied.third  && <div>3B: {runnerLabels.third  || '—'}</div>}
        </div>
      )}
    </div>
  );
}