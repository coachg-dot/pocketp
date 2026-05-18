import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RUNNER_OPTIONS = [
  { value: 'none',          label: 'Empty',      icon: '○○○' },
  { value: 'first',         label: '1st',         icon: '○○●' },
  { value: 'second',        label: '2nd',         icon: '○●○' },
  { value: 'third',         label: '3rd',         icon: '●○○' },
  { value: 'first_second',  label: '1st & 2nd',   icon: '○●●' },
  { value: 'first_third',   label: '1st & 3rd',   icon: '●○●' },
  { value: 'second_third',  label: '2nd & 3rd',   icon: '●●○' },
  { value: 'bases_loaded',  label: 'Loaded',      icon: '●●●' },
];

function PillGroup({ label, options, value, onChange }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              value === opt.value
                ? "bg-primary text-primary-foreground shadow"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CountButton({ value, selected, onClick, label }) {
  return (
    <button
      onClick={() => onClick(value)}
      className={cn(
        "w-10 h-10 rounded-full font-bold text-sm transition-all",
        selected
          ? "bg-primary text-primary-foreground shadow-lg scale-110"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
      )}
    >
      {label ?? value}
    </button>
  );
}

export default function ScenarioBuilder({ mode, onSubmit }) {
  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [outs, setOuts] = useState(0);
  const [inning, setInning] = useState(1);
  const [runners, setRunners] = useState('none');
  const [hitterSide, setHitterSide] = useState('right');
  const [pitcherSide, setPitcherSide] = useState('right');

  const handleSubmit = () => {
    const scenario = { balls, strikes, outs, inning, runners, hitterSide };
    if (mode === 'hitting') scenario.pitcherSide = pitcherSide;
    onSubmit(scenario);
  };

  return (
    <div className="space-y-5">
      {/* Count */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Balls</p>
          <div className="flex gap-2">
            {[0,1,2,3].map(n => (
              <CountButton key={n} value={n} selected={balls === n} onClick={setBalls} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Strikes</p>
          <div className="flex gap-2">
            {[0,1,2].map(n => (
              <CountButton key={n} value={n} selected={strikes === n} onClick={setStrikes} />
            ))}
          </div>
        </div>
      </div>

      {/* Outs */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Outs</p>
        <div className="flex gap-2">
          {[0,1,2].map(n => (
            <CountButton key={n} value={n} selected={outs === n} onClick={setOuts} />
          ))}
        </div>
      </div>

      {/* Inning */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Inning</p>
        <div className="flex gap-2 flex-wrap">
          {Array.from({length: 9}, (_, i) => i + 1).map(n => (
            <CountButton key={n} value={n} selected={inning === n} onClick={setInning} />
          ))}
        </div>
      </div>

      {/* Runners */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Runners on Base</p>
        <div className="grid grid-cols-4 gap-1.5">
          {RUNNER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRunners(opt.value)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-xs font-medium transition-all",
                runners === opt.value
                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
              )}
            >
              <span className="text-[10px] font-mono tracking-widest">{opt.icon}</span>
              <span className="text-[9px]">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Hitter side */}
      <PillGroup
        label="Batter Handedness"
        options={[{ value: 'right', label: 'Right-Handed' }, { value: 'left', label: 'Left-Handed' }]}
        value={hitterSide}
        onChange={setHitterSide}
      />

      {/* Pitcher side (hitting mode only) */}
      {mode === 'hitting' && (
        <PillGroup
          label="Pitcher Handedness"
          options={[{ value: 'right', label: 'Right-Handed' }, { value: 'left', label: 'Left-Handed' }]}
          value={pitcherSide}
          onChange={setPitcherSide}
        />
      )}

      <Button onClick={handleSubmit} className="w-full">
        Generate Scenario
      </Button>
    </div>
  );
}