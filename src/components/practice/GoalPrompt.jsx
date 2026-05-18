import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ScenarioDisplay from './ScenarioDisplay';

const PITCHING_GOALS = [
  { id: 'stop_run',        label: 'Stop a run from scoring',      emoji: '🛑' },
  { id: 'get_out',         label: 'Record an out',                emoji: '⚾' },
  { id: 'strikeout',       label: 'Strike the batter out',        emoji: '🔥' },
  { id: 'ground_ball',     label: 'Get a ground ball',            emoji: '↘️' },
  { id: 'double_play',     label: 'Turn a double play',           emoji: '💫' },
  { id: 'force_at_base',   label: 'Make the play at 2nd',         emoji: '🏃' },
  { id: 'force_at_home',   label: 'Make the play at home',        emoji: '🏠' },
  { id: 'limit_damage',    label: 'Limit to 1 run max',           emoji: '🧱' },
];

const HITTING_GOALS = [
  { id: 'score_run',       label: 'Score a run',                  emoji: '🏠' },
  { id: 'drive_in_run',    label: 'Drive in a run (RBI)',         emoji: '💥' },
  { id: 'get_on_base',     label: 'Get on base',                  emoji: '🦶' },
  { id: 'hit_hard',        label: 'Hit the ball hard',            emoji: '💪' },
  { id: 'advance_runner',  label: 'Advance the runner',           emoji: '🏃' },
  { id: 'sac_fly',         label: 'Hit a sacrifice fly',          emoji: '🦅' },
  { id: 'walk',            label: 'Work a walk',                  emoji: '👣' },
  { id: 'hit_gap',         label: 'Hit a gap shot',               emoji: '↔️' },
];

export default function GoalPrompt({ mode, scenario, onGoalSet, currentPlayer }) {
  const [selected, setSelected] = useState(null);
  const goals = mode === 'hitting' ? HITTING_GOALS : PITCHING_GOALS;

  return (
    <div className="space-y-5">
      <ScenarioDisplay scenario={scenario} mode={mode} currentPlayer={currentPlayer} />

      <div>
        <p className="text-sm font-semibold mb-3">What's your goal this at-bat?</p>
        <div className="grid grid-cols-2 gap-2">
          {goals.map(g => (
            <button
              key={g.id}
              onClick={() => setSelected(g)}
              className={cn(
                "flex items-center gap-2 p-3 rounded-xl border text-left text-sm transition-all",
                selected?.id === g.id
                  ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-1 font-semibold"
                  : "border-border hover:border-primary/40"
              )}
            >
              <span className="text-lg shrink-0">{g.emoji}</span>
              <span className="text-xs leading-tight">{g.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Button
        className="w-full h-12"
        disabled={!selected}
        onClick={() => onGoalSet(selected)}
      >
        Set Goal & Go
      </Button>
    </div>
  );
}