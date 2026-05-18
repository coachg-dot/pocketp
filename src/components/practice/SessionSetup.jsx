import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import FieldDifficultySetup, { FIELDERS } from './FieldDifficultySetup';
import DefensiveShiftSelector from './DefensiveShiftSelector';
import FenceDimensionsInput from './FenceDimensionsInput';
import PlayerSessionPicker from './PlayerSessionPicker';

const COUNTS = [1, 3, 5, 10, 20];

function defaultDifficulties() {
  const d = {};
  FIELDERS.forEach(f => { d[f.id] = 1; });
  return d;
}

export default function SessionSetup({ mode, onStart }) {
  const [playerConfig, setPlayerConfig] = useState(null); // set after player selection step
  const [total, setTotal] = useState(5);
  const [useRandom, setUseRandom] = useState(true);
  const [difficulties, setDifficulties] = useState(defaultDifficulties);
  const [infieldShift, setInfleldShift] = useState('standard');
  const [outfieldShift, setOutfieldShift] = useState('of_standard');
  const [fences, setFences] = useState({ lf: 300, cf: 350, rf: 300 });

  const handleShiftChange = ({ infieldShift: i, outfieldShift: o }) => {
    setInfleldShift(i);
    setOutfieldShift(o);
  };

  // Step 1: player/staff selection
  if (!playerConfig) {
    return <PlayerSessionPicker mode={mode} onSelect={setPlayerConfig} />;
  }

  return (
    <div className="space-y-6">
      {/* Player config summary */}
      <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
        <p className="text-xs font-medium text-primary">
          {mode === 'pitching'
            ? playerConfig.sessionType === 'open' ? '⚾ Open Practice' : `⚾ Rotation: ${playerConfig.lineup?.join(', ')}`
            : playerConfig.sessionType === 'open' ? '🏏 Open Practice' : `🏏 Order: ${playerConfig.lineup?.join(', ')}`
          }
        </p>
        <button className="text-xs text-muted-foreground underline" onClick={() => setPlayerConfig(null)}>Change</button>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">How many scenarios?</p>
        <div className="flex gap-2 flex-wrap">
          {COUNTS.map(n => (
            <button
              key={n}
              onClick={() => setTotal(n)}
              className={cn(
                "w-12 h-12 rounded-full font-bold text-sm transition-all",
                total === n
                  ? "bg-primary text-primary-foreground shadow-lg scale-110"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
              )}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setTotal('unlimited')}
            className={cn(
              "px-4 h-12 rounded-full font-bold text-sm transition-all",
              total === 'unlimited'
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
            )}
          >
            ∞
          </button>
        </div>
        {total === 'unlimited' && (
          <p className="text-xs text-muted-foreground mt-2">No limit — report card shown when you exit</p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">Scenario type</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setUseRandom(true)}
            className={cn(
              "p-4 rounded-xl border text-left transition-all",
              useRandom ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-1" : "border-border hover:border-primary/40"
            )}
          >
            <p className="font-semibold text-sm">🎲 Random</p>
            <p className="text-xs text-muted-foreground mt-1">Scenarios generated automatically</p>
          </button>
          <button
            onClick={() => setUseRandom(false)}
            className={cn(
              "p-4 rounded-xl border text-left transition-all",
              !useRandom ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-1" : "border-border hover:border-primary/40"
            )}
          >
            <p className="font-semibold text-sm">🎯 Custom</p>
            <p className="text-xs text-muted-foreground mt-1">Build each scenario yourself</p>
          </button>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">Field Dimensions</p>
        <FenceDimensionsInput {...fences} onChange={setFences} />
      </div>

      {mode === 'hitting' && (
        <>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Defensive Shifts</p>
            <DefensiveShiftSelector infieldShift={infieldShift} outfieldShift={outfieldShift} onChange={handleShiftChange} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Fielder Difficulty</p>
            <FieldDifficultySetup difficulties={difficulties} onChange={setDifficulties} />
          </div>
        </>
      )}

      <Button className="w-full h-12 text-base" onClick={() => onStart({ total, useRandom, difficulties, infieldShift, outfieldShift, ...fences, playerConfig })}>
        Start Session
      </Button>
    </div>
  );
}