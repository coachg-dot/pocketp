import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const RESULT_LABELS = {
  single: 'Single', double: 'Double', triple: 'Triple', home_run: 'Home Run',
  walk: 'Walk', hbp: 'Hit By Pitch', bunt_single: 'Bunt Single',
  error: 'Error', fielders_choice: "Fielder's Choice",
  groundout: 'Groundout', flyout: 'Flyout', lineout: 'Lineout', popout: 'Popout',
  bunt_out: 'Bunt Out', rbi_groundout: 'RBI Groundout', sac_fly: 'Sac Fly', sac_bunt: 'Sac Bunt',
  in_play_out: 'Out in Play',
};

// Base-state picker — 1B, 2B, 3B only.
// Runs are counted by runner disappearance (runner was on base before, not on any base after).
// Do NOT include a HOME button here — using HOME + "Additional Runs" counter was causing double-counting.
function BasesPicker({ bases, onChange }) {
  const toggle = (base) => {
    onChange({ ...bases, [base]: !bases[base] });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Diamond layout — 3 bases only */}
      <div className="relative w-44 h-36">
        {/* Second base — top center */}
        <button
          onClick={() => toggle('second')}
          className={`absolute left-1/2 -translate-x-1/2 top-0 w-12 h-12 rotate-45 border-2 transition-colors ${
            bases.second ? 'bg-accent border-accent' : 'bg-card border-border hover:border-primary'
          }`}
        />
        <span className="absolute left-1/2 -translate-x-1/2 top-0 w-12 h-12 flex items-center justify-center text-xs font-bold pointer-events-none z-10 text-white drop-shadow">2B</span>

        {/* Third base — left */}
        <button
          onClick={() => toggle('third')}
          className={`absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 rotate-45 border-2 transition-colors ${
            bases.third ? 'bg-accent border-accent' : 'bg-card border-border hover:border-primary'
          }`}
        />
        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-xs font-bold pointer-events-none z-10 text-white drop-shadow">3B</span>

        {/* First base — right */}
        <button
          onClick={() => toggle('first')}
          className={`absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rotate-45 border-2 transition-colors ${
            bases.first ? 'bg-accent border-accent' : 'bg-card border-border hover:border-primary'
          }`}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-xs font-bold pointer-events-none z-10 text-white drop-shadow">1B</span>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Set where each runner ends up. Runners not placed on a base have scored.
      </p>
    </div>
  );
}

function calcInitialBases(prevBases, batterResult) {
  const b = { ...prevBases, home: false };

  if (batterResult === 'hbp') {
    if (b.first && b.second && b.third) {
      // Bases loaded — runner on third forced home
      return { first: true, second: true, third: true, home: true };
    } else if (b.first && b.second) {
      return { first: true, second: true, third: true, home: false };
    } else if (b.first) {
      return { first: true, second: true, third: b.third, home: false };
    } else {
      return { first: true, second: b.second, third: b.third, home: false };
    }
  }

  // Place batter: single/walk/HBP/error/FC → first; double → second; triple → third; HR → all score
  if (['single', 'walk', 'bunt_single', 'error', 'fielders_choice'].includes(batterResult)) b.first = true;
  if (batterResult === 'double') { b.second = true; } // keep existing runners — user will adjust
  if (batterResult === 'triple') { b.third = true; } // keep existing runners — user will adjust
  if (batterResult === 'home_run') return { first: false, second: false, third: false, home: true };
  // For outs (groundout, flyout, etc.): keep existing runners, batter is out — don't add to first
  return b;
}

export default function RunnerAdvancementDialog({ open, onClose, prevBases = {}, batterResult, onConfirm }) {
  // Strip `home` out of initial bases — we no longer use a HOME toggle button
  const [bases, setBases] = useState(() => {
    const init = calcInitialBases(prevBases, batterResult);
    return { first: init.first, second: init.second, third: init.third };
  });
  const [manualRuns, setManualRuns] = useState(0);

  // Reset state every time the dialog opens with potentially new runners/result
  useEffect(() => {
    if (open) {
      const init = calcInitialBases(prevBases, batterResult);
      setBases({ first: init.first, second: init.second, third: init.third });
      setManualRuns(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const title = RESULT_LABELS[batterResult] || 'Advance Runners';

  // Max runs that could legally score = runners already on base + batter if they reach base or score
  const prevRunnerCount = (prevBases.first ? 1 : 0) + (prevBases.second ? 1 : 0) + (prevBases.third ? 1 : 0);
  const batterReaches = ['single','double','triple','home_run','walk','hbp','bunt_single','error','fielders_choice'].includes(batterResult);
  const maxPossibleRuns = prevRunnerCount + (batterReaches ? 1 : 0);

  const handleConfirm = () => {
    // Final base state = exactly what the user toggled (no HOME button — it was removed)
    const finalBases = { first: bases.first, second: bases.second, third: bases.third };

    // Runs scored = runners who were on base before but are no longer on any base after,
    // plus the batter if they hit a home run (they never appear on a base).
    // This is the ONLY run source — no secondary counter to avoid double-counting.
    const runsScored = countRunsFromMovement(prevBases, finalBases, batterResult);
    const totalRuns = Math.max(0, runsScored + manualRuns);
    onConfirm(finalBases, totalRuns);
  };

  const adjustManualRuns = (delta) => {
    // manualRuns is strictly additive on TOP of the base-disappearance count.
    // Cap at the remaining runners that COULD have scored beyond what base placement shows.
    const autoRuns = countRunsFromMovement(prevBases, bases, batterResult);
    const cap = Math.max(0, maxPossibleRuns - autoRuns);
    setManualRuns(prev => {
      const next = prev + delta;
      return Math.max(0, Math.min(next, cap));
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-xs" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title} — Place Runners</DialogTitle>
        </DialogHeader>
        <BasesPicker bases={bases} onChange={setBases} />

        {/* Extra runs scored control — for runners who scored but aren't accounted for
            by the base placement above (e.g. a runner scored but the user didn't toggle their base off) */}
        {maxPossibleRuns > 0 && (
          <div className="mt-2 bg-muted/40 rounded-xl px-4 py-3">
            <p className="text-xs text-muted-foreground mb-2 text-center">Extra Runs (if any)</p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => adjustManualRuns(-1)}
                disabled={manualRuns <= 0}
                className="w-9 h-9 rounded-full bg-muted border-2 border-border flex items-center justify-center text-lg font-bold text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >−</button>
              <div className="text-center min-w-[48px]">
                <span className="text-2xl font-bold text-foreground">{manualRuns}</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">extra runs</p>
              </div>
              <button
                onClick={() => adjustManualRuns(1)}
                disabled={manualRuns >= maxPossibleRuns}
                className="w-9 h-9 rounded-full bg-muted border-2 border-border flex items-center justify-center text-lg font-bold text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >+</button>
            </div>
            <p className="text-[10px] text-muted-foreground/70 text-center mt-1.5">Only use if runners scored beyond what base placement shows above</p>
          </div>
        )}

        <div className="mt-2 space-y-2">
          <Button className="w-full" onClick={handleConfirm}>
            Confirm
          </Button>
          <Button variant="ghost" className="w-full text-xs" onClick={() => {
            const newBases = { first: bases.first, second: bases.second, third: bases.third };
            onConfirm(newBases, 0);
          }}>
            Skip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function countRunsFromMovement(prev, next, batterResult) {
  const prevCount = (prev.first ? 1 : 0) + (prev.second ? 1 : 0) + (prev.third ? 1 : 0);
  const nextCount = (next.first ? 1 : 0) + (next.second ? 1 : 0) + (next.third ? 1 : 0);
  const batterAdded = ['single', 'double', 'triple', 'walk', 'hbp', 'bunt_single', 'error', 'fielders_choice'].includes(batterResult) ? 1 : 0;
  const batterHomered = batterResult === 'home_run' ? 1 : 0;
  return Math.max(0, prevCount + batterAdded + batterHomered - nextCount);
}