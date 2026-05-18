import React, { useMemo } from 'react';

// Results that count as official At-Bats
const AB_RESULTS = new Set([
  'single', 'double', 'triple', 'home_run', 'bunt_single',
  'strikeout_swinging', 'strikeout_looking',
  'groundout', 'flyout', 'lineout', 'popout', 'bunt_out',
  'rbi_groundout', 'fielders_choice', 'error',
  'double_play', 'triple_play', 'in_play_out',
]);

// Results that do NOT count as ABs
const NON_AB = new Set(['walk', 'hbp', 'sac_fly', 'sac_bunt']);

const RESULT_LABEL = {
  single: '1B',
  bunt_single: '1B (bunt)',
  double: '2B',
  triple: '3B',
  home_run: 'HR',
  walk: 'BB',
  hbp: 'HBP',
  strikeout_swinging: 'K (swing)',
  strikeout_looking: 'K (look)',
  groundout: 'Ground out',
  flyout: 'Fly out',
  lineout: 'Line out',
  popout: 'Pop out',
  bunt_out: 'Bunt out',
  rbi_groundout: 'RBI ground out',
  sac_fly: 'Sac fly',
  sac_bunt: 'Sac bunt',
  fielders_choice: "Fielder's choice",
  error: 'Reached on error',
  double_play: 'Double play',
  triple_play: 'Triple play',
  in_play_out: 'Out in play',
};

// Short label for hit/AB line (e.g. "1-3, K")
const RESULT_SHORT = {
  single: '1B', bunt_single: '1B', double: '2B', triple: '3B', home_run: 'HR',
  walk: 'BB', hbp: 'HBP',
  strikeout_swinging: 'K', strikeout_looking: 'Kl',
  groundout: 'GO', flyout: 'FO', lineout: 'LO', popout: 'PO',
  bunt_out: 'BO', rbi_groundout: 'GO', sac_fly: 'SF', sac_bunt: 'SB',
  fielders_choice: 'FC', error: 'E', double_play: 'DP', triple_play: 'TP', in_play_out: 'GO',
};

/**
 * Shows a compact today-only summary for the current batter.
 * Props:
 *   atBats  — all AtBat records for the current game (already filtered to game_id)
 *   batterId — currentBatter.id or currentBatter.name
 *   batterName — currentBatter.name
 */
export default function CurrentGameBatterSummary({ atBats = [], batterId, batterName }) {
  const summary = useMemo(() => {
    if (!batterId && !batterName) return null;

    // Filter to this batter's completed plate appearances for today's game
    const pas = atBats
      .filter(ab =>
        ab.result && (
          ab.player_id === batterId ||
          ab.player_name?.toLowerCase() === batterName?.toLowerCase()
        )
      )
      // Sort chronologically by inning, then created_date
      .sort((a, b) => {
        if ((a.inning || 0) !== (b.inning || 0)) return (a.inning || 0) - (b.inning || 0);
        return new Date(a.created_date || 0) - new Date(b.created_date || 0);
      });

    if (pas.length === 0) return { line: 'Today: 0-0', log: null };

    let hits = 0;
    let abs = 0;
    let totalRbi = 0;
    const shortLabels = [];
    const detailLabels = []; // rich descriptions per PA

    for (const ab of pas) {
      const r = ab.result;
      const shortLabel = RESULT_SHORT[r] || r?.toUpperCase() || '?';
      shortLabels.push(shortLabel);

      // Build a rich description for this PA
      let detail = RESULT_LABEL[r] || r?.toUpperCase() || '?';
      // Append error fielder if applicable
      if (r === 'error' && ab.error_fielder) {
        detail = `Error (${ab.error_fielder})`;
      }
      // Append RBI info
      if (ab.rbis > 0) {
        detail += `, ${ab.rbis} RBI`;
      }
      detailLabels.push(detail);

      if (AB_RESULTS.has(r)) abs++;
      if (['single', 'double', 'triple', 'home_run', 'bunt_single'].includes(r)) hits++;
      if (ab.rbis) totalRbi += ab.rbis;
    }

    const hitStr = `${hits}-${abs}`;
    const extras = [];

    // Notable results to highlight in the summary line
    const hitShorts = shortLabels.filter(l => ['1B','2B','3B','HR'].includes(l));
    const bbCount = shortLabels.filter(l => l === 'BB').length;
    const kCount  = shortLabels.filter(l => l === 'K' || l === 'Kl').length;

    if (hitShorts.length) extras.push(...hitShorts);
    if (bbCount)          extras.push(bbCount > 1 ? `${bbCount}BB` : 'BB');
    if (kCount)           extras.push(kCount > 1  ? `${kCount}K`  : 'K');
    if (totalRbi > 0)     extras.push(`${totalRbi} RBI`);

    const line = extras.length
      ? `Today: ${hitStr}, ${extras.join(', ')}`
      : `Today: ${hitStr}`;

    // Detail log: each PA as a numbered entry with full description
    const log = detailLabels.length > 0
      ? detailLabels.map((d, i) => `PA${i + 1}: ${d}`).join('  ·  ')
      : null;

    return { line, log };
  }, [atBats, batterId, batterName]);

  if (!summary) return null;

  return (
    <div className="mt-0.5 space-y-0.5">
      <p className="text-[11px] text-muted-foreground leading-tight font-medium">
        {summary.line}
      </p>
      {summary.log && (
        <p className="text-[10px] text-muted-foreground/70 leading-tight">
          {summary.log}
        </p>
      )}
    </div>
  );
}