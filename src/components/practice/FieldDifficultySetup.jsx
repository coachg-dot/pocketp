import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import FieldSVG from '../FieldSVG';

// Fielder positions in SVG coordinate space (viewBox 0 0 100 110)
// Diamond: Home(50,100), 1B(75,75), 2B(50,50), 3B(25,75)
export const FIELDERS = [
  { id: 'P',  label: 'P',  group: 'infield',  cx: 50, cy: 72 },
  { id: 'C',  label: 'C',  group: 'infield',  cx: 50, cy: 105 },
  { id: '1B', label: '1B', group: 'infield',  cx: 80, cy: 71 },
  { id: '2B', label: '2B', group: 'infield',  cx: 64, cy: 60 },
  { id: '3B', label: '3B', group: 'infield',  cx: 20, cy: 71 },
  { id: 'SS', label: 'SS', group: 'infield',  cx: 36, cy: 60 },
  { id: 'LF', label: 'LF', group: 'outfield', cx: 22, cy: 30 },
  { id: 'CF', label: 'CF', group: 'outfield', cx: 50, cy: 18 },
  { id: 'RF', label: 'RF', group: 'outfield', cx: 78, cy: 30 },
];

export const DIFFICULTY_LEVELS = [
  { value: 1, label: 'Easy',   color: 'hsl(145 63% 42%)', radius: 4  },
  { value: 2, label: 'Medium', color: 'hsl(35 95% 55%)',  radius: 7  },
  { value: 3, label: 'Hard',   color: 'hsl(0 84% 60%)',   radius: 11 },
];

function getDifficulty(level) {
  return DIFFICULTY_LEVELS.find(d => d.value === level) ?? DIFFICULTY_LEVELS[0];
}

function DifficultyPill({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {DIFFICULTY_LEVELS.map(d => (
        <button
          key={d.value}
          onClick={() => onChange(d.value)}
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all border",
            value === d.value
              ? "text-white border-transparent"
              : "bg-transparent border-border text-muted-foreground hover:bg-secondary"
          )}
          style={value === d.value ? { background: d.color } : {}}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

export default function FieldDifficultySetup({ difficulties, onChange }) {
  const [expanded, setExpanded] = useState(null); // null | fielder id

  const setAll = (group, level) => {
    const next = { ...difficulties };
    FIELDERS.filter(f => f.group === group).forEach(f => { next[f.id] = level; });
    onChange(next);
  };

  const setOne = (id, level) => {
    onChange({ ...difficulties, [id]: level });
  };

  return (
    <div className="space-y-3">
      {/* Group controls */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <p className="text-xs font-semibold mb-2">Infield (all)</p>
          <DifficultyPill
            value={null}
            onChange={(v) => setAll('infield', v)}
          />
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold mb-2">Outfield (all)</p>
          <DifficultyPill
            value={null}
            onChange={(v) => setAll('outfield', v)}
          />
        </Card>
      </div>

      {/* Field diagram */}
      <Card>
        <CardContent className="pt-4 pb-3 px-3">
          <p className="text-xs text-muted-foreground text-center mb-2">Tap a fielder to adjust individually</p>
          <div className="relative w-full max-w-xs mx-auto" style={{ aspectRatio: '100/110' }}>
            <FieldSVG showFence={false} showPositionLabels={false} className="w-full h-full">
              {/* Difficulty range circles + fielder dots */}
              {FIELDERS.map(f => {
                const level = difficulties[f.id] ?? 1;
                const diff = getDifficulty(level);
                return (
                  <g key={f.id} onClick={() => setExpanded(expanded === f.id ? null : f.id)} style={{ cursor: 'pointer' }}>
                    <circle cx={f.cx} cy={f.cy} r={diff.radius} fill={diff.color} opacity="0.25" stroke={diff.color} strokeWidth="0.6" strokeDasharray={level === 1 ? "2 2" : "none"} />
                    <circle cx={f.cx} cy={f.cy} r="3" fill={expanded === f.id ? 'white' : diff.color} stroke="white" strokeWidth="0.8" />
                    <text x={f.cx} y={f.cy - 4.5} textAnchor="middle" fill="white" fontSize="3" fontWeight="700">{f.label}</text>
                  </g>
                );
              })}
            </FieldSVG>
          </div>

          {/* Per-fielder controls (shown when expanded) */}
          {expanded && (() => {
            const f = FIELDERS.find(x => x.id === expanded);
            return (
              <div className="mt-3 flex items-center justify-between px-2 py-2 bg-secondary rounded-lg">
                <p className="text-xs font-semibold">{f.label} — Difficulty</p>
                <DifficultyPill value={difficulties[f.id] ?? 1} onChange={(v) => setOne(f.id, v)} />
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Individual list */}
      <div className="grid grid-cols-3 gap-2">
        {FIELDERS.map(f => {
          const level = difficulties[f.id] ?? 1;
          const diff = getDifficulty(level);
          return (
            <div key={f.id} className="flex flex-col gap-1 p-2 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: diff.color }} />
                <span className="text-xs font-semibold">{f.label}</span>
                <span className="text-[9px] text-muted-foreground ml-auto">{diff.label}</span>
              </div>
              <DifficultyPill value={level} onChange={(v) => setOne(f.id, v)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}