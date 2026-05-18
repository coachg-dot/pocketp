import React from 'react';
import { cn } from "@/lib/utils";

export const ALL_PITCH_TYPES = [
  { id: '4seam',      label: '4-Seam FB',   short: '4S',  color: 'bg-red-500' },
  { id: '2seam',      label: '2-Seam FB',   short: '2S',  color: 'bg-red-400' },
  { id: 'sinker',     label: 'Sinker',       short: 'SI',  color: 'bg-orange-500' },
  { id: 'cutter',     label: 'Cutter',       short: 'CT',  color: 'bg-orange-400' },
  { id: 'slider',     label: 'Slider',       short: 'SL',  color: 'bg-purple-500' },
  { id: 'sweeper',    label: 'Sweeper',      short: 'SW',  color: 'bg-purple-400' },
  { id: 'slurve',     label: 'Slurve',       short: 'SLV', color: 'bg-violet-500' },
  { id: 'curveball',  label: 'Curveball',    short: 'CB',  color: 'bg-blue-500' },
  { id: 'knuckle_curve', label: 'Knuckle Curve', short: 'KC', color: 'bg-blue-400' },
  { id: 'changeup',   label: 'Changeup',     short: 'CH',  color: 'bg-green-500' },
  { id: 'splitter',   label: 'Splitter',     short: 'SP',  color: 'bg-green-400' },
  { id: 'screwball',  label: 'Screwball',    short: 'SCR', color: 'bg-teal-500' },
  { id: 'forkball',   label: 'Forkball',     short: 'FK',  color: 'bg-cyan-500' },
  { id: 'knuckleball',label: 'Knuckleball',  short: 'KN',  color: 'bg-gray-500' },
  { id: 'eephus',     label: 'Eephus',       short: 'EP',  color: 'bg-pink-400' },
];

export default function PitchRepertoireSelector({ selected = [], onChange }) {
  const toggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter(p => p !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_PITCH_TYPES.map(pt => {
        const isOn = selected.includes(pt.id);
        return (
          <button
            key={pt.id}
            onClick={() => toggle(pt.id)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-all",
              isOn
                ? `${pt.color} text-white border-transparent`
                : 'bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30'
            )}
          >
            {pt.short} · {pt.label}
          </button>
        );
      })}
    </div>
  );
}