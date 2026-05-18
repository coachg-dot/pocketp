import React from 'react';
import { cn } from "@/lib/utils";

const RESULT_DISPLAY = {
  single: { label: '1B', color: 'bg-primary text-primary-foreground' },
  double: { label: '2B', color: 'bg-primary text-primary-foreground' },
  triple: { label: '3B', color: 'bg-primary text-primary-foreground' },
  home_run: { label: 'HR', color: 'bg-accent text-accent-foreground' },
  walk: { label: 'BB', color: 'bg-blue-500 text-white' },
  hbp: { label: 'HBP', color: 'bg-blue-500 text-white' },
  sac_fly: { label: 'SF', color: 'bg-secondary text-secondary-foreground' },
  sac_bunt: { label: 'SAC', color: 'bg-secondary text-secondary-foreground' },
  rbi_groundout: { label: 'RBI GO', color: 'bg-secondary text-secondary-foreground' },
  groundout: { label: 'GO', color: 'bg-muted text-muted-foreground' },
  flyout: { label: 'FO', color: 'bg-muted text-muted-foreground' },
  lineout: { label: 'LO', color: 'bg-muted text-muted-foreground' },
  popout: { label: 'PO', color: 'bg-muted text-muted-foreground' },
  strikeout_swinging: { label: 'K', color: 'bg-destructive text-destructive-foreground' },
  strikeout_looking: { label: 'Kʟ', color: 'bg-destructive text-destructive-foreground' },
  fielders_choice: { label: 'FC', color: 'bg-muted text-muted-foreground' },
  error: { label: 'E', color: 'bg-purple-500 text-white' },
  double_play: { label: 'DP', color: 'bg-destructive text-destructive-foreground' },
  triple_play: { label: 'TP', color: 'bg-destructive text-destructive-foreground' },
};

export default function AtBatCard({ atBat, onDelete }) {
  const display = RESULT_DISPLAY[atBat.result] || { label: atBat.result, color: 'bg-muted' };

  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-lg border">
      <span className={cn(
        "px-2.5 py-1 rounded-md text-xs font-bold min-w-[45px] text-center",
        display.color
      )}>
        {display.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate uppercase">{atBat.player_name}</p>
        <p className="text-xs text-muted-foreground">
          Inn {atBat.inning} • {atBat.balls}-{atBat.strikes} count
          {atBat.is_pinch_hitter && ' • PH'}
        </p>
      </div>
      {atBat.hit_location_x !== undefined && (
        <div className="w-8 h-8 bg-primary/10 rounded relative">
          <div 
            className="absolute w-1.5 h-1.5 bg-destructive rounded-full"
            style={{
              left: `${atBat.hit_location_x}%`,
              top: `${atBat.hit_location_y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        </div>
      )}
      {onDelete && (
        <button
          onClick={() => onDelete(atBat.id)}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          ×
        </button>
      )}
    </div>
  );
}