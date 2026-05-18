import React from 'react';
import { cn } from "@/lib/utils";
import BaseballDiamond from './BaseballDiamond';

// Results that require a location diagram
export const LOCATION_RESULTS = ['flyout', 'popout', 'single', 'double', 'triple', 'home_run', 'bunt_single'];

// Grouped by type for color-coded display
const GROUPS = [
  {
    label: 'Hits',
    color: 'bg-emerald-600 text-white',
    results: [
      { value: 'single', label: '1B' },
      { value: 'double', label: '2B' },
      { value: 'triple', label: '3B' },
      { value: 'home_run', label: 'HR' },
      { value: 'bunt_single', label: 'Bunt 1B' },
    ],
  },
  {
    label: 'On Base',
    color: 'bg-blue-500 text-white',
    results: [
      { value: 'walk', label: 'BB' },
      { value: 'hbp', label: 'HBP' },
      { value: 'error', label: 'E' },
    ],
  },
  {
    label: 'Outs',
    color: 'bg-slate-500 text-white',
    results: [
      { value: 'groundout', label: 'GO' },
      { value: 'flyout', label: 'Fly Out' },
      { value: 'lineout', label: 'LO' },
      { value: 'popout', label: 'Pop Out' },
      { value: 'strikeout_swinging', label: 'K' },
      { value: 'strikeout_looking', label: 'Kʟ' },
      { value: 'bunt_out', label: 'Bunt Out' },
      { value: 'fielders_choice', label: 'FC' },
      { value: 'rbi_groundout', label: 'RBI GO' },
      { value: 'sac_fly', label: 'SF' },
      { value: 'sac_bunt', label: 'SAC' },
      { value: 'double_play', label: 'DP' },
    ],
  },
];

export default function ResultSelector({ selectedResult, onResultSelect, hitLocation, onHitLocationChange }) {
  const needsLocation = LOCATION_RESULTS.includes(selectedResult);

  return (
    <div className="space-y-3">
      {GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{group.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.results.map((result) => (
              <button
                key={result.value}
                onClick={() => onResultSelect(result.value)}
                className={cn(
                  "py-2 px-3 rounded-lg font-semibold text-xs transition-all touch-target",
                  selectedResult === result.value
                    ? `${group.color} ring-2 ring-offset-2 ring-primary scale-105 shadow-lg`
                    : `${group.color} opacity-60 hover:opacity-90`
                )}
              >
                {result.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Location diagram for fly out, pop out, and hits */}
      {needsLocation && onHitLocationChange && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">
            {selectedResult === 'flyout' ? 'Fly Out Location' :
             selectedResult === 'popout' ? 'Pop Out Location' : 'Hit Location'}
            <span className="text-[10px] ml-1">(optional)</span>
          </p>
          <BaseballDiamond
            onLocationSelect={onHitLocationChange}
            selectedLocation={hitLocation}
          />
        </div>
      )}
    </div>
  );
}