import React from 'react';
import { cn } from "@/lib/utils";

export const DEFENSIVE_SHIFTS = [
  // Infield
  { id: 'standard',         label: 'Standard',           group: 'infield',  emoji: '⚾', desc: 'Normal positioning' },
  { id: 'double_play',      label: 'Double Play Depth',  group: 'infield',  emoji: '2️⃣', desc: 'Up the middle, turn two' },
  { id: 'guard_lines',      label: 'Guard the Lines',    group: 'infield',  emoji: '📏', desc: '3B & 1B hug the foul lines' },
  { id: 'infield_in',       label: 'Infield In',         group: 'infield',  emoji: '⬆️', desc: 'Cut the run at the plate' },
  { id: 'ted_williams',     label: 'Ted Williams Shift',  group: 'infield',  emoji: '➡️', desc: '3 infielders on right side' },
  { id: 'no_doubles',       label: 'No Doubles',         group: 'infield',  emoji: '🚫', desc: '2B & SS shade toward gaps' },
  { id: 'corners_in',       label: 'Corners In',         group: 'infield',  emoji: '↙️↘️', desc: '3B & 1B crash for bunt' },
  { id: 'wheel',            label: 'Wheel Play',         group: 'infield',  emoji: '🔄', desc: 'All corners crash hard' },
  // Outfield
  { id: 'of_standard',      label: 'Standard',           group: 'outfield', emoji: '⚾', desc: 'Normal depth & alignment' },
  { id: 'of_shallow',       label: 'Shallow',            group: 'outfield', emoji: '⬇️', desc: 'Prevent shallow singles' },
  { id: 'of_deep',          label: 'Deep',               group: 'outfield', emoji: '⬆️', desc: 'No extra-base hits' },
  { id: 'of_no_doubles',    label: 'No Doubles',         group: 'outfield', emoji: '📐', desc: 'Play corners back, gaps covered' },
  { id: 'of_shade_right',   label: 'Shade Right',        group: 'outfield', emoji: '➡️', desc: 'All three shift toward right field' },
  { id: 'of_shade_left',    label: 'Shade Left',         group: 'outfield', emoji: '⬅️', desc: 'All three shift toward left field' },
  { id: 'of_pull',          label: 'Pull Shift',         group: 'outfield', emoji: '🎯', desc: 'LF plays center, CF plays right gap' },
  { id: 'five_man_infield', label: '5-Man Infield',      group: 'outfield', emoji: '5️⃣', desc: 'CF drops in as 5th infielder' },
];

export const INFIELD_SHIFTS  = DEFENSIVE_SHIFTS.filter(s => s.group === 'infield');
export const OUTFIELD_SHIFTS = DEFENSIVE_SHIFTS.filter(s => s.group === 'outfield');

export default function DefensiveShiftSelector({ infieldShift, outfieldShift, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Infield Alignment</p>
        <div className="grid grid-cols-2 gap-2">
          {INFIELD_SHIFTS.map(s => (
            <button
              key={s.id}
              onClick={() => onChange({ infieldShift: s.id, outfieldShift })}
              className={cn(
                "flex items-start gap-2 p-2.5 rounded-xl border text-left transition-all",
                infieldShift === s.id
                  ? "border-primary bg-primary/8 ring-1 ring-primary"
                  : "border-border hover:border-primary/40 bg-card"
              )}
            >
              <span className="text-lg leading-none mt-0.5">{s.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight">{s.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Outfield Alignment</p>
        <div className="grid grid-cols-2 gap-2">
          {OUTFIELD_SHIFTS.map(s => (
            <button
              key={s.id}
              onClick={() => onChange({ infieldShift, outfieldShift: s.id })}
              className={cn(
                "flex items-start gap-2 p-2.5 rounded-xl border text-left transition-all",
                outfieldShift === s.id
                  ? "border-primary bg-primary/8 ring-1 ring-primary"
                  : "border-border hover:border-primary/40 bg-card"
              )}
            >
              <span className="text-lg leading-none mt-0.5">{s.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight">{s.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}