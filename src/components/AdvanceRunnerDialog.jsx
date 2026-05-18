import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ADVANCE_REASONS = [
  { key: 'wild_pitch', label: 'Wild Pitch', emoji: '⚡' },
  { key: 'passed_ball', label: 'Passed Ball', emoji: '🥎' },
  { key: 'balk', label: 'Balk', emoji: '🚫' },
  { key: 'stolen_base', label: 'Stolen Base', emoji: '💨' },
  { key: 'throwing_error', label: 'Throwing Error', emoji: '🎯' },
  { key: 'defensive_indifference', label: 'Def. Indifference', emoji: '🛡️' },
];

function BasesPicker({ bases, onChange, earnedMap, onEarnedChange }) {
  const BASE_KEYS = ['first', 'second', 'third'];
  const BASE_LABELS = { first: '1B', second: '2B', third: '3B', home: 'HOME' };

  const toggle = (base) => {
    onChange({ ...bases, [base]: !bases[base] });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-48 h-48">
        {/* Second base — top center */}
        <button
          onClick={() => toggle('second')}
          className={`absolute left-1/2 -translate-x-1/2 top-2 w-12 h-12 rotate-45 border-2 transition-colors ${
            bases.second ? 'bg-accent border-accent' : 'bg-card border-border hover:border-primary'
          }`}
        />
        <span className="absolute left-1/2 -translate-x-1/2 top-2 w-12 h-12 flex items-center justify-center text-xs font-bold pointer-events-none z-10 text-white drop-shadow">2B</span>

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

        {/* Home plate — bottom center */}
        <button
          onClick={() => toggle('home')}
          className={`absolute left-1/2 -translate-x-1/2 bottom-2 w-12 h-12 rotate-45 border-2 transition-colors ${
            bases.home ? 'bg-green-500 border-green-500' : 'bg-card border-border hover:border-green-500'
          }`}
        />
        <span className="absolute left-1/2 -translate-x-1/2 bottom-2 w-12 h-12 flex items-center justify-center text-[10px] font-bold pointer-events-none z-10 text-white drop-shadow">HOME</span>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Tap base to toggle runner. <span className="text-green-600 font-semibold">HOME</span> = run scored.
      </p>
    </div>
  );
}

export default function AdvanceRunnerDialog({ open, onClose, basesState, runnerPitchers, runnerEarned, onConfirm }) {
  const [step, setStep] = useState('reason'); // 'reason' | 'bases'
  const [reason, setReason] = useState(null);
  const [bases, setBases] = useState({ ...basesState, home: false });

  // Reset state when dialog opens so stale bases from a previous call don't persist
  useEffect(() => {
    if (open) {
      setStep('reason');
      setReason(null);
      setBases({ ...basesState, home: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hasRunners = basesState.first || basesState.second || basesState.third;

  const handleReasonSelect = (r) => {
    setReason(r);
    setBases({ ...basesState, home: false });
    setStep('bases');
  };

  const handleConfirm = () => {
    // Figure out which runners scored (were on base, now removed, or toggled home)
    const prevBases = { first: basesState.first, second: basesState.second, third: basesState.third };
    const newBases = { first: bases.first || false, second: bases.second || false, third: bases.third || false };

    // Runner count change = runs scored. HOME toggle is a hint — remove runner from highest
    // occupied base so countRunsFromMovement (prevCount - newCount) correctly counts them.
    if (bases.home) {
      if (prevBases.third && newBases.third) newBases.third = false;
      else if (prevBases.second && newBases.second) newBases.second = false;
      else if (prevBases.first && newBases.first) newBases.first = false;
    }
    const prevCount = (prevBases.first ? 1 : 0) + (prevBases.second ? 1 : 0) + (prevBases.third ? 1 : 0);
    const newCount = (newBases.first ? 1 : 0) + (newBases.second ? 1 : 0) + (newBases.third ? 1 : 0);
    const totalRuns = Math.max(0, prevCount - newCount);

    // Runners who scored = those on base before but not on any base after
    const scoredFromBases = ['first', 'second', 'third'].filter(b => prevBases[b] && !newBases[b]);

    // Build new runnerPitchers and runnerEarned maps
    const newRunnerPitchers = {};
    const newRunnerEarned = {};

    // For runners still on base, carry over their attribution
    for (const b of ['first', 'second', 'third']) {
      if (newBases[b]) {
        // Find where this runner came from — if they were on the same base before, keep their info
        // This is a manual advancement so we do best-effort: if runner is still on same base, keep
        if (basesState[b] && newBases[b]) {
          newRunnerPitchers[b] = runnerPitchers[b];
          newRunnerEarned[b] = runnerEarned[b] ?? true;
        } else {
          // Runner moved to a new base — figure out source
          // We'll assign attribution from the previous base they came from
          // Heuristic: runner on 2nd likely came from 1st, runner on 3rd from 2nd
          const sourceBase = b === 'third' ? 'second' : b === 'second' ? 'first' : null;
          if (sourceBase && basesState[sourceBase] && !newBases[sourceBase]) {
            newRunnerPitchers[b] = runnerPitchers[sourceBase];
            newRunnerEarned[b] = runnerEarned[sourceBase] ?? true;
          } else {
            newRunnerPitchers[b] = runnerPitchers[b];
            newRunnerEarned[b] = runnerEarned[b] ?? true;
          }
        }
      }
    }

    // Build earned runs per pitcher
    const earnedRunsByPitcher = {}; // pitcherName -> count
    const unearnedRuns = { count: 0 };

    for (const base of scoredFromBases) {
      const pitcher = runnerPitchers[base];
      const earned = runnerEarned[base] ?? true;
      if (earned && pitcher) {
        earnedRunsByPitcher[pitcher] = (earnedRunsByPitcher[pitcher] || 0) + 1;
      } else {
        unearnedRuns.count += 1;
      }
    }

    onConfirm({
      newBases,
      totalRuns,
      earnedRunsByPitcher,
      unearnedRuns: unearnedRuns.count,
      reason,
      newRunnerPitchers,
      newRunnerEarned,
    });

    // Reset
    setStep('reason');
    setReason(null);
  };

  const handleClose = () => {
    setStep('reason');
    setReason(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-xs" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {step === 'reason' ? 'Advance Runner — How?' : `${ADVANCE_REASONS.find(r => r.key === reason)?.label} — Place Runners`}
          </DialogTitle>
        </DialogHeader>

        {step === 'reason' && (
          <div className="space-y-2">
            {!hasRunners && (
              <p className="text-sm text-muted-foreground text-center py-2">No runners currently on base.</p>
            )}
            {ADVANCE_REASONS.map(r => (
              <Button
                key={r.key}
                variant="outline"
                className="w-full h-12 text-sm font-semibold justify-start gap-3"
                onClick={() => handleReasonSelect(r.key)}
                disabled={!hasRunners}
              >
                <span className="text-lg">{r.emoji}</span>
                {r.label}
              </Button>
            ))}
            <Button variant="ghost" className="w-full text-xs" onClick={handleClose}>Cancel</Button>
          </div>
        )}

        {step === 'bases' && (
          <div className="space-y-3">
            <BasesPicker bases={bases} onChange={setBases} />
            <Button className="w-full" onClick={handleConfirm}>Confirm</Button>
            <Button variant="ghost" className="w-full text-xs" onClick={() => setStep('reason')}>← Back</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}