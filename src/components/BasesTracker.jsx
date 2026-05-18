import React from 'react';

// bases = { first: bool, second: bool, third: bool }
export default function BasesTracker({ bases = {}, onChange, readOnly = false, size = 140 }) {
  const toggle = (base) => {
    if (!readOnly && onChange) onChange({ ...bases, [base]: !bases[base] });
  };

  const BASE_COLOR_ON = 'hsl(145 63% 32%)';
  const BASE_COLOR_OFF = 'hsl(210 15% 85%)';
  const STROKE = 'white';

  // positions in a 120x120 viewBox with padding so home plate is never clipped
  const BASES = [
    { key: 'second', cx: 60, cy: 16, label: '2' },
    { key: 'third',  cx: 14, cy: 62, label: '3' },
    { key: 'first',  cx: 106, cy: 62, label: '1' },
  ];

  const diamondPoints = (cx, cy, r = 10) =>
    `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;

  return (
    <div style={{ width: size, height: size }} className="mx-auto select-none">
      <svg viewBox="0 0 120 120" width="100%" height="100%">
        {/* Base paths */}
        <line x1="60" y1="16" x2="106" y2="62" stroke="hsl(210 15% 75%)" strokeWidth="1.5" />
        <line x1="60" y1="16" x2="14"  y2="62" stroke="hsl(210 15% 75%)" strokeWidth="1.5" />
        <line x1="106" y1="62" x2="60" y2="108" stroke="hsl(210 15% 75%)" strokeWidth="1.5" />
        <line x1="14"  y1="62" x2="60" y2="108" stroke="hsl(210 15% 75%)" strokeWidth="1.5" />

        {/* Home plate — pentagon-ish shape, fully visible */}
        <polygon
          points={diamondPoints(60, 108, 9)}
          fill="hsl(210 15% 78%)"
          stroke={STROKE}
          strokeWidth="1.5"
        />
        <text x="60" y="112" textAnchor="middle" fontSize="6" fontWeight="bold"
          fill="hsl(220 15% 40%)" style={{ pointerEvents: 'none', userSelect: 'none' }}>H</text>

        {/* Tappable bases */}
        {BASES.map(({ key, cx, cy, label }) => (
          <g
            key={key}
            onClick={() => toggle(key)}
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
          >
            <polygon
              points={diamondPoints(cx, cy, 12)}
              fill={bases[key] ? BASE_COLOR_ON : BASE_COLOR_OFF}
              stroke={STROKE}
              strokeWidth="1.5"
            />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              fill={bases[key] ? 'white' : 'hsl(220 15% 40%)'}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {label}
            </text>
          </g>
        ))}

        {/* Runner dots */}
        {BASES.map(({ key, cx, cy }) =>
          bases[key] ? (
            <circle
              key={`dot-${key}`}
              cx={cx}
              cy={cy - 20}
              r="5"
              fill="hsl(35 95% 55%)"
              stroke="white"
              strokeWidth="1.5"
              style={{ pointerEvents: 'none' }}
            />
          ) : null
        )}
      </svg>
    </div>
  );
}