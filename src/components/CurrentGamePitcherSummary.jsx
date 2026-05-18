import React, { useMemo } from 'react';

const OUT_RESULTS = ['strikeout_swinging','strikeout_looking','groundout','flyout','lineout','popout',
  'bunt_out','rbi_groundout','sac_fly','sac_bunt','fielders_choice','in_play_out'];
const HIT_RESULTS = ['single','double','triple','home_run','bunt_single'];

/**
 * Shows a compact in-game pitching line for the current pitcher.
 * Props:
 *   atBats  — all AtBat records for the game
 *   pitches — all Pitch records for the game
 *   pitcherName — name of the pitcher to summarize
 */
/**
 * pitchCount — the authoritative live pitch count from TrackGame's localPitchCounts
 *              (already reconciled with DB via Math.max + manual offsets).
 *              Passed directly so this component always matches the header counter.
 */
export default function CurrentGamePitcherSummary({ atBats = [], pitches = [], pitcherName, pitchCount }) {
  const line = useMemo(() => {
    if (!pitcherName) return null;

    // At-bats attributed to this pitcher
    const pitchAtBatIds = new Set(
      pitches.filter(p => p.pitcher_name === pitcherName && p.at_bat_id).map(p => p.at_bat_id)
    );
    const pABs = atBats.filter(ab =>
      ab.pitcher_name === pitcherName || pitchAtBatIds.has(ab.id)
    );

    if (pABs.length === 0 && (pitchCount == null || pitchCount === 0) && pitches.filter(p => p.pitcher_name === pitcherName).length === 0) {
      return null; // no data yet
    }

    const totalOuts = pABs.reduce((acc, ab) => {
      if (ab.result === 'double_play') return acc + 2;
      if (ab.result === 'triple_play') return acc + 3;
      return OUT_RESULTS.includes(ab.result) ? acc + 1 : acc;
    }, 0);
    const fullInnings = Math.floor(totalOuts / 3);
    const remOuts = totalOuts % 3;
    const ip = `${fullInnings}.${remOuts}`;

    // Use the authoritative pitchCount prop if provided (matches the live header counter exactly).
    // Fall back to DB count only if prop is not passed (e.g. used outside TrackGame).
    const pc = pitchCount != null ? pitchCount : pitches.filter(p => p.pitcher_name === pitcherName).length;
    const ks = pABs.filter(ab => ab.result?.includes('strikeout')).length;
    const bbs = pABs.filter(ab => ab.result === 'walk').length;
    const hits = pABs.filter(ab => HIT_RESULTS.includes(ab.result)).length;
    const runs = pABs.reduce((s, ab) => s + (ab.rbis || 0), 0);
    // Use AtBat.earned_runs as sole source of truth — do NOT read pitch.earned_runs
    const er = pABs.reduce((s, ab) => s + (ab.earned_runs || 0), 0);

    return { ip, pc, ks, bbs, hits, runs, er };
  }, [atBats, pitches, pitcherName, pitchCount]);

  if (!line) return null;

  return (
    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
      {line.ip} IP · {line.pc}P · {line.hits}H · {line.runs}R/{line.er}ER · {line.bbs}BB · {line.ks}K
    </p>
  );
}