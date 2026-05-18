import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from 'lucide-react';
import ScoutingReport from './ScoutingReport';

const PITCH_TYPE_META = [
  { id: '4seam',        label: '4-Seam FB',    color: '#ef4444' },
  { id: '2seam',        label: '2-Seam FB',    color: '#f97316' },
  { id: 'fastball',     label: 'Fastball',     color: '#ef4444' },
  { id: 'sinker',       label: 'Sinker',       color: '#f59e0b' },
  { id: 'cutter',       label: 'Cutter',       color: '#84cc16' },
  { id: 'slider',       label: 'Slider',       color: '#a855f7' },
  { id: 'sweeper',      label: 'Sweeper',      color: '#7c3aed' },
  { id: 'slurve',       label: 'Slurve',       color: '#8b5cf6' },
  { id: 'curveball',    label: 'Curveball',    color: '#3b82f6' },
  { id: 'knuckle_curve',label: 'Knuckle Curve',color: '#60a5fa' },
  { id: 'changeup',     label: 'Changeup',     color: '#22c55e' },
  { id: 'splitter',     label: 'Splitter',     color: '#10b981' },
  { id: 'screwball',    label: 'Screwball',    color: '#14b8a6' },
  { id: 'forkball',     label: 'Forkball',     color: '#06b6d4' },
  { id: 'knuckleball',  label: 'Knuckleball',  color: '#64748b' },
  { id: 'eephus',       label: 'Eephus',       color: '#ec4899' },
];

const OUT_RESULTS = ['strikeout_swinging','strikeout_looking','groundout','flyout','lineout','popout','rbi_groundout','fielders_choice','error','sac_fly','sac_bunt','bunt_out','in_play_out'];
const HIT_RESULTS = ['single','double','triple','home_run','bunt_single'];
const GB_RESULTS  = ['groundout','rbi_groundout','double_play','bunt_out','fielders_choice'];
const FB_RESULTS  = ['flyout','sac_fly','popout'];
const LD_RESULTS  = ['lineout'];
const STRIKE_RESULTS = ['called_strike','swinging_strike','foul','foul_tip','in_play_out','in_play_hit'];
const SWING_RESULTS  = ['swinging_strike','foul','in_play_out','in_play_hit'];

function pct(n, d) { return (!d) ? '—' : Math.round((n / d) * 100) + '%'; }
function ZoneCell({ zone, count, max, isChase = false }) {
  const intensity = count / max;
  const bg = isChase
    ? `rgba(148,163,184,${intensity * 0.85})`   // silver for chase
    : `rgba(220,38,38,${intensity * 0.85})`;    // red for strike zone
  return (
    <div
      className="w-10 h-10 rounded flex flex-col items-center justify-center border border-muted-foreground/20 shrink-0"
      style={{ backgroundColor: bg }}
    >
      <span className="text-xs font-bold leading-none">{count || ''}</span>
      <span className="text-[8px] text-muted-foreground leading-none mt-0.5">{zone}</span>
    </div>
  );
}
function fmt(n, dec = 2) { return (n == null || isNaN(n) || !isFinite(n)) ? '—' : Number(n).toFixed(dec); }
function ipFmt(outs) {
  const full = Math.floor(outs / 3), rem = outs % 3;
  return rem === 0 ? `${full}.0` : `${full}.${rem}`;
}
function ptMeta(id) { return PITCH_TYPE_META.find(p => p.id === id) || { label: id, color: '#94a3b8' }; }

export default function PitcherGameLog({ pitches = [], atBats = [], pitcherName = '', gameDate = '', gameOpponent = '', extraPitches = 0 }) {
  const [scoutingPlayer, setScoutingPlayer] = useState(null);
  // Exclude synthetic runner-advancement records from batting-facing stats (BF, K, BB, H, IP, log)
  const battingABs = atBats.filter(ab => ab.player_id !== 'ADVANCEMENT' && ab.player_name !== 'ADVANCEMENT');
  const s = useMemo(() => {
    const totalPitches = pitches.length + extraPitches;
    const strikes   = pitches.filter(p => STRIKE_RESULTS.includes(p.result)).length;
    const swings    = pitches.filter(p => SWING_RESULTS.includes(p.result)).length;
    const whiffs    = pitches.filter(p => p.result === 'swinging_strike').length;
    const firstPitches = pitches.filter(p => p.pitch_number === 1);
    const fps       = firstPitches.filter(p => STRIKE_RESULTS.includes(p.result)).length;

    const bf  = battingABs.length;
    const ks  = battingABs.filter(ab => ab.result === 'strikeout_swinging' || ab.result === 'strikeout_looking').length;
    const bbs = battingABs.filter(ab => ab.result === 'walk').length;
    const hbp = battingABs.filter(ab => ab.result === 'hbp').length;
    const hitsAllowed = battingABs.filter(ab => HIT_RESULTS.includes(ab.result)).length;
    const hrs = battingABs.filter(ab => ab.result === 'home_run').length;

    const totalOuts = battingABs.reduce((acc, ab) => {
      if (ab.result === 'double_play') return acc + 2;
      if (ab.result === 'triple_play') return acc + 3;
      if (OUT_RESULTS.includes(ab.result)) return acc + 1;
      return acc;
    }, 0);
    const ipDecimal = Math.floor(totalOuts / 3) + (totalOuts % 3) / 3;
    const ipDisplay = ipFmt(totalOuts);

    const gbOuts = battingABs.filter(ab => GB_RESULTS.includes(ab.result)).length;
    const fbOuts = battingABs.filter(ab => FB_RESULTS.includes(ab.result)).length;
    const ldOuts = battingABs.filter(ab => LD_RESULTS.includes(ab.result)).length;
    const bip    = gbOuts + fbOuts + ldOuts;

    // Earned runs: AtBat.earned_runs is the single source of truth.
    // Include ALL atBats (batting + advancement) for run totals and ER.
    const erFromABs = atBats.reduce((sum, ab) => sum + (ab.earned_runs || 0), 0);
    const erFromPitches = pitches.reduce((sum, p) => sum + (p.earned_runs || 0), 0);
    const hasABLevelER = atBats.some(ab => ab.earned_runs != null); // includes 0 (unearned)
    const earnedRuns = hasABLevelER ? erFromABs : erFromPitches;
    const runsAllowed = atBats.reduce((sum, ab) => sum + (ab.rbis || 0), 0);
    const unearnedRuns = Math.max(0, runsAllowed - earnedRuns);
    const era = ipDecimal > 0 ? (earnedRuns * 9) / ipDecimal : null;

    const whip = ipDecimal > 0 ? (bbs + hbp + hitsAllowed) / ipDecimal : null;
    const fip  = ipDecimal > 0 ? ((13 * hrs) + (3 * (bbs + hbp)) - (2 * ks)) / ipDecimal + 3.2 : null;
    const kbb  = bbs > 0 ? ks / bbs : null;

    // 9 new advanced stats — all derived from pitch/atBat data already collected
    // K-BB%: strikeout rate minus walk rate (command metric)
    const kMinusBBPct = bf > 0 ? ((ks - bbs) / bf) : null;
    // SwStr%: swinging strikes / total pitches (pure stuff metric)
    const swStrPct = totalPitches > 0 ? whiffs / totalPitches : null;
    // CSW%: called strikes + whiffs / total pitches ("Called Strike + Whiff" — best stuff metric)
    const calledStrikes = pitches.filter(p => p.result === 'called_strike').length;
    const cswPct = totalPitches > 0 ? (calledStrikes + whiffs) / totalPitches : null;
    // Zone%: pitches in strike zone (zones 1-9) / total pitches
    const inZone = pitches.filter(p => p.zone >= 1 && p.zone <= 9).length;
    const outZone = pitches.filter(p => p.zone >= 11 && p.zone <= 14).length;
    const zonePct = totalPitches > 0 ? inZone / totalPitches : null;
    // Chase%: out-of-zone pitches swung at / out-of-zone pitches (batter discipline metric)
    const chaseSwings = pitches.filter(p => p.zone >= 11 && p.zone <= 14 && SWING_RESULTS.includes(p.result)).length;
    const chasePct = outZone > 0 ? chaseSwings / outZone : null;
    // Z-Contact%: in-zone contact (foul + in play) / in-zone swings
    const inZoneSwings = pitches.filter(p => p.zone >= 1 && p.zone <= 9 && SWING_RESULTS.includes(p.result)).length;
    const inZoneContact = pitches.filter(p => p.zone >= 1 && p.zone <= 9 && ['foul','in_play_out','in_play_hit'].includes(p.result)).length;
    const zContactPct = inZoneSwings > 0 ? inZoneContact / inZoneSwings : null;
    // BABIP: (H - HR) / (BF - BB - HBP - K - HR)  [pitcher formula, equivalent to AB-K-HR+SF]
    const sacFlies = battingABs.filter(ab => ab.result === 'sac_fly').length;
    const babipDenom = bf - bbs - hbp - ks - hrs;
    const babip = babipDenom > 0 ? (hitsAllowed - hrs) / babipDenom : null;
    // BAA: hits allowed / at-bats faced (excluding BB and HBP)
    const abOpp = bf - bbs - hbp;
    const baa = abOpp > 0 ? hitsAllowed / abOpp : null;
    // Str/BF: total strikes per batter faced (efficiency of the strike-throwing)
    const strPerBF = bf > 0 ? strikes / bf : null;
    // 1st-Pitch Swing%: batters who swung at pitch 1 / total BF (aggressiveness metric)
    const fp1Swings = pitches.filter(p => p.pitch_number === 1 && SWING_RESULTS.includes(p.result)).length;
    const fp1SwingPct = bf > 0 ? fp1Swings / bf : null;

    // Pitch type breakdown
    const ptMap = {};
    pitches.forEach(p => {
      if (!p.pitch_type) return;
      if (!ptMap[p.pitch_type]) ptMap[p.pitch_type] = { total: 0, strikes: 0, whiffs: 0, swings: 0 };
      ptMap[p.pitch_type].total++;
      if (STRIKE_RESULTS.includes(p.result)) ptMap[p.pitch_type].strikes++;
      if (p.result === 'swinging_strike') ptMap[p.pitch_type].whiffs++;
      if (SWING_RESULTS.includes(p.result)) ptMap[p.pitch_type].swings++;
    });
    const pitchTypeData = Object.entries(ptMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([type, d]) => ({
        type, meta: ptMeta(type),
        total: d.total,
        usagePct: totalPitches ? Math.round((d.total / totalPitches) * 100) : 0,
        strikePct: d.total ? Math.round((d.strikes / d.total) * 100) : 0,
        whiffPct: d.swings ? Math.round((d.whiffs / d.swings) * 100) : 0,
      }));

    // Per-inning
    const innMap = {};
    pitches.forEach(p => {
      const inn = p.inning || 1;
      if (!innMap[inn]) innMap[inn] = { pitches: 0, ks: 0, bbs: 0, hits: 0 };
      innMap[inn].pitches++;
    });
    battingABs.forEach(ab => {
      const inn = ab.inning || 1;
      if (!innMap[inn]) innMap[inn] = { pitches: 0, ks: 0, bbs: 0, hits: 0 };
      if (ab.result === 'strikeout_swinging' || ab.result === 'strikeout_looking') innMap[inn].ks++;
      if (ab.result === 'walk' || ab.result === 'hbp') innMap[inn].bbs++;
      if (HIT_RESULTS.includes(ab.result)) innMap[inn].hits++;
    });
    const inningData = Object.entries(innMap)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([inn, d]) => ({ inn: Number(inn), ...d }));

    // Zone map
    const zoneMap = {};
    pitches.filter(p => p.zone != null).forEach(p => {
      zoneMap[p.zone] = (zoneMap[p.zone] || 0) + 1;
    });

    // Hit locations from pitches with in-play results
    const hitLocations = pitches.filter(p =>
      (p.result === 'in_play_out' || p.result === 'in_play_hit') && p.hit_location_x != null
    );

    return {
      totalPitches, strikes, swings, whiffs, fps, fpsBF: firstPitches.length,
      bf, ks, bbs, hbp, hitsAllowed, hrs,
      totalOuts, ipDisplay, ipDecimal,
      gbOuts, fbOuts, ldOuts, bip,
      earnedRuns, unearnedRuns, runsAllowed, era, whip, fip, kbb,
      // new advanced stats
      kMinusBBPct, swStrPct, cswPct, zonePct, chasePct, zContactPct, babip, baa, strPerBF, fp1SwingPct,
      pitchTypeData, inningData, zoneMap, hitLocations,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitches, atBats, battingABs, extraPitches]);

  if (!pitches.length && !atBats.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No game data recorded yet.</p>;
  }

  const maxZone = Math.max(...Object.values(s.zoneMap), 1);
  const zoneLayout = [[1,2,3],[4,5,6],[7,8,9]];
  // Chase zones: 11=up-and-in, 12=up-and-away, 13=down-and-in, 14=down-and-away
  // Display them surrounding the strike zone grid

  return (
    <div className="space-y-4">
      {/* Core Stats */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold">
            {(pitcherName || 'Pitcher').toUpperCase()} — Game Stats
          </CardTitle>
          {(gameDate || gameOpponent) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {gameDate && new Date(gameDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {gameDate && gameOpponent && ' · '}
              {gameOpponent && `vs ${gameOpponent.toUpperCase()}`}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'IP',  val: s.ipDisplay,   color: 'text-primary' },
              { label: 'R',   val: s.runsAllowed, color: 'text-destructive' },
              { label: 'ER',  val: s.earnedRuns,  color: 'text-destructive' },
              { label: 'K',   val: s.ks,          color: 'text-primary' },
              { label: 'BB',  val: s.bbs,         color: '' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-muted/50 rounded-xl p-3 text-center">
                <p className={`text-lg font-bold ${color}`}>{val}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          {s.unearnedRuns > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
              <span className="text-amber-500 text-base">⚠</span>
              <p className="text-xs text-amber-600">
                <span className="font-semibold">{s.unearnedRuns} unearned run{s.unearnedRuns !== 1 ? 's' : ''}</span> allowed — scored due to error. Excluded from ERA.
              </p>
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'ERA', val: s.era != null ? fmt(s.era, 2) : '—', color: 'text-destructive' },
              { label: 'UER', val: s.unearnedRuns > 0 ? s.unearnedRuns : '—', color: s.unearnedRuns > 0 ? 'text-amber-600' : 'text-muted-foreground' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-muted/30 rounded-xl p-2.5 text-center">
                <p className={`text-lg font-bold ${color}`}>{val}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Strikes', val: s.strikes,       color: 'text-primary' },
              { label: 'Balls',   val: s.totalPitches - s.strikes, color: '' },
              { label: 'H',       val: s.hitsAllowed,   color: 'text-destructive' },
              { label: 'BF',      val: s.bf,            color: '' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-muted/30 rounded-xl p-2.5 text-center">
                <p className={`text-lg font-bold ${color}`}>{val}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rate Stats */}
      {s.totalPitches > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Rate Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Strike%', val: pct(s.strikes, s.totalPitches) },
                { label: 'K%',      val: pct(s.ks, s.bf) },
                { label: 'BB%',     val: pct(s.bbs, s.bf) },
              ].map(({ label, val }) => (
                <div key={label} className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-base font-bold">{val}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Whiff%', val: pct(s.whiffs, s.swings) },
                { label: 'FPS%',   val: pct(s.fps, s.fpsBF) },
                { label: 'GB%',    val: s.bip > 0 ? pct(s.gbOuts, s.bip) : '—' },
              ].map(({ label, val }) => (
                <div key={label} className="bg-muted/30 rounded-xl p-2.5 text-center">
                  <p className="text-base font-bold">{val}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced Sabermetrics */}
      {s.ipDecimal > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Advanced Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Row 1: core advanced */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'WHIP', val: fmt(s.whip) },
                { label: 'FIP',  val: fmt(s.fip) },
                { label: 'BAA',  val: s.baa != null ? fmt(s.baa, 3) : '—' },
                { label: 'K/BB', val: s.kbb != null ? fmt(s.kbb, 1) : '—' },
              ].map(({ label, val }) => (
                <div key={label} className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-base font-bold">{val}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            {/* Row 2: BIP / efficiency */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'P/IP', val: s.ipDecimal > 0 ? fmt(s.totalPitches / s.ipDecimal, 1) : '—' },
                { label: 'FB%',  val: s.bip > 0 ? pct(s.fbOuts, s.bip) : '—' },
                { label: 'LD%',  val: s.bip > 0 ? pct(s.ldOuts, s.bip) : '—' },
              ].map(({ label, val }) => (
                <div key={label} className="bg-muted/30 rounded-xl p-2.5 text-center">
                  <p className="text-base font-bold">{val}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            {/* Row 3: Stuff metrics */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'SwStr%', val: s.swStrPct != null ? Math.round(s.swStrPct * 100) + '%' : '—', title: 'Swinging Strike % — pure stuff' },
                { label: 'CSW%',   val: s.cswPct   != null ? Math.round(s.cswPct   * 100) + '%' : '—', title: 'Called Strike + Whiff % — best stuff metric' },
                { label: 'K-BB%',  val: s.kMinusBBPct != null ? (s.kMinusBBPct >= 0 ? '+' : '') + Math.round(s.kMinusBBPct * 100) + '%' : '—', title: 'K% minus BB% — command quality' },
              ].map(({ label, val, title }) => (
                <div key={label} className="bg-muted/50 rounded-xl p-3 text-center" title={title}>
                  <p className="text-base font-bold">{val}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            {/* Row 4: Zone control */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Zone%',   val: s.zonePct     != null ? Math.round(s.zonePct     * 100) + '%' : '—', title: 'Pitches thrown in strike zone' },
                { label: 'Chase%',  val: s.chasePct    != null ? Math.round(s.chasePct    * 100) + '%' : '—', title: 'Out-of-zone pitches swung at (higher = better for pitcher)' },
                { label: 'Z-Con%',  val: s.zContactPct != null ? Math.round(s.zContactPct * 100) + '%' : '—', title: 'In-zone contact rate (lower = better for pitcher)' },
              ].map(({ label, val, title }) => (
                <div key={label} className="bg-muted/30 rounded-xl p-2.5 text-center" title={title}>
                  <p className="text-base font-bold">{val}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            {/* Row 5: Outcome depth */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'BABIP',    val: s.babip        != null ? fmt(s.babip, 3)                              : '—', title: 'Batting avg on balls in play against (luck indicator)' },
                { label: 'Str/BF',   val: s.strPerBF     != null ? fmt(s.strPerBF, 1)                          : '—', title: 'Strikes per batter faced (efficiency)' },
                { label: 'FP-Sw%',   val: s.fp1SwingPct  != null ? Math.round(s.fp1SwingPct * 100) + '%'       : '—', title: '1st-pitch swing rate against (batter aggression)' },
              ].map(({ label, val, title }) => (
                <div key={label} className="bg-muted/50 rounded-xl p-3 text-center" title={title}>
                  <p className="text-base font-bold">{val}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/60 text-center">FIP cFIP=3.20 · Zone% requires zone data · Chase%/Z-Con% require zone 11–14 data</p>
          </CardContent>
        </Card>
      )}

      {/* Pitch Arsenal */}
      {s.pitchTypeData.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Pitch Arsenal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {s.pitchTypeData.map(pt => (
                <div key={pt.type} className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{ backgroundColor: pt.meta.color }}
                  >
                    {pt.meta.label.split(' ').map(w => w[0]).join('').slice(0,3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{pt.meta.label}</span>
                      <span className="text-xs text-muted-foreground">{pt.total} ({pt.usagePct}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-1">
                      <div className="h-full rounded-full" style={{ width: `${pt.usagePct}%`, backgroundColor: pt.meta.color }} />
                    </div>
                    <div className="flex gap-3">
                      <span className="text-[10px] text-muted-foreground">Strike {pt.strikePct}%</span>
                      <span className="text-[10px] text-muted-foreground">Whiff {pt.whiffPct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-inning table */}
      {s.inningData.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground">By Inning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left pb-2 pr-3">Inn</th>
                    <th className="text-center pb-2 px-2">PC</th>
                    <th className="text-center pb-2 px-2">K</th>
                    <th className="text-center pb-2 px-2">BB</th>
                    <th className="text-center pb-2 px-2">H</th>
                  </tr>
                </thead>
                <tbody>
                  {s.inningData.map(row => (
                    <tr key={row.inn} className="border-b border-muted/40 last:border-0">
                      <td className="py-1.5 pr-3 font-semibold">Inning {row.inn}</td>
                      <td className="py-1.5 px-2 text-center">{row.pitches}</td>
                      <td className="py-1.5 px-2 text-center font-semibold text-primary">{row.ks}</td>
                      <td className="py-1.5 px-2 text-center">{row.bbs}</td>
                      <td className="py-1.5 px-2 text-center text-destructive">{row.hits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zone Heatmap */}
      {Object.keys(s.zoneMap).length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Zone Heatmap</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div>

              <div className="flex flex-col gap-1">
                {/* Top chase row */}
                <div className="flex gap-1">
                  <ZoneCell zone={11} count={s.zoneMap[11]||0} max={maxZone} isChase />
                  <ZoneCell zone={1}  count={s.zoneMap[1] ||0} max={maxZone} />
                  <ZoneCell zone={2}  count={s.zoneMap[2] ||0} max={maxZone} />
                  <ZoneCell zone={3}  count={s.zoneMap[3] ||0} max={maxZone} />
                  <ZoneCell zone={12} count={s.zoneMap[12]||0} max={maxZone} isChase />
                </div>
                <div className="flex gap-1">
                  <div className="w-10 h-10" />
                  <ZoneCell zone={4} count={s.zoneMap[4]||0} max={maxZone} />
                  <ZoneCell zone={5} count={s.zoneMap[5]||0} max={maxZone} />
                  <ZoneCell zone={6} count={s.zoneMap[6]||0} max={maxZone} />
                  <div className="w-10 h-10" />
                </div>
                <div className="flex gap-1">
                  <div className="w-10 h-10" />
                  <ZoneCell zone={7} count={s.zoneMap[7]||0} max={maxZone} />
                  <ZoneCell zone={8} count={s.zoneMap[8]||0} max={maxZone} />
                  <ZoneCell zone={9} count={s.zoneMap[9]||0} max={maxZone} />
                  <div className="w-10 h-10" />
                </div>
                {/* Bottom chase row */}
                <div className="flex gap-1">
                  <ZoneCell zone={13} count={s.zoneMap[13]||0} max={maxZone} isChase />
                  <div className="w-10 h-10" />
                  <div className="w-10 h-10" />
                  <div className="w-10 h-10" />
                  <ZoneCell zone={14} count={s.zoneMap[14]||0} max={maxZone} isChase />
                </div>
              </div>
              <div className="flex gap-4 justify-center mt-2">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-600 opacity-70"/><span className="text-[10px] text-muted-foreground">Strike Zone</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-slate-400 opacity-70"/><span className="text-[10px] text-muted-foreground">Chase Zone</span></div>
              </div>
              <p className="text-[10px] text-center text-muted-foreground mt-1">Pitcher's view · darker = more pitches</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spray Chart */}
      {s.hitLocations.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Balls in Play ({s.hitLocations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative w-full max-w-[260px] mx-auto aspect-square">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Outfield grass */}
                <path d="M 100 192 L 8 100 Q 100 -10 192 100 Z" fill="#2d6a2d" stroke="#fff" strokeWidth="0.5" opacity="0.6" />
                {/* Infield dirt */}
                <path d="M 100 175 L 28 103 Q 100 20 172 103 Z" fill="#8B6914" opacity="0.7" />
                {/* Infield grass */}
                <path d="M 100 162 L 42 106 Q 100 38 158 106 Z" fill="#3a7a3a" opacity="0.8" />
                {/* Baselines */}
                <line x1="100" y1="175" x2="35" y2="105" stroke="white" strokeWidth="0.8" opacity="0.5" />
                <line x1="100" y1="175" x2="165" y2="105" stroke="white" strokeWidth="0.8" opacity="0.5" />
                {/* Bases */}
                {[[100,162],[130,106],[100,56],[70,106]].map(([x,y],i) => (
                  <rect key={i} x={x-4} y={y-4} width="8" height="8" fill="white" transform={`rotate(45 ${x} ${y})`} />
                ))}
                {/* Home plate */}
                <polygon points="100,178 94,184 94,192 106,192 106,184" fill="white" />
                {/* Pitch hit locations */}
                {s.hitLocations.map((p, i) => {
                  const x = (p.hit_location_x / 100) * 200;
                  const y = (p.hit_location_y / 110) * 200;
                  return (
                    <circle
                      key={i}
                      cx={x} cy={y} r="5"
                      fill={p.result === 'in_play_hit' ? '#22c55e' : '#ef4444'}
                      stroke="white" strokeWidth="1.5" opacity="0.85"
                    />
                  );
                })}
              </svg>
              <div className="flex gap-4 justify-center mt-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-500 border border-white" />
                  <span className="text-[10px] text-muted-foreground">Hit</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500 border border-white" />
                  <span className="text-[10px] text-muted-foreground">Out</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {scoutingPlayer && (
        <ScoutingReport
          player={scoutingPlayer}
          open={!!scoutingPlayer}
          onClose={() => setScoutingPlayer(null)}
        />
      )}

      {/* At-Bat Results (hitter view — bottom) */}
      {atBats.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground">At-Bat Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {[...battingABs].reverse().map((ab, i) => (
                <div key={ab.id || i} className="flex items-center justify-between text-xs py-1.5 border-b border-muted/40 last:border-0">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-muted-foreground w-10 shrink-0">Inn {ab.inning || '?'}</span>
                    <span className="font-medium truncate max-w-[90px]">{(ab.player_name || 'Unknown').toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-muted-foreground">{ab.balls ?? 0}-{ab.strikes ?? 0}</span>
                    <Badge
                      className={`text-[10px] px-1.5 py-0 capitalize ${
                        HIT_RESULTS.includes(ab.result) ? 'bg-green-100 text-green-700' :
                        ab.result?.includes('strikeout') ? 'bg-primary/15 text-primary' :
                        ab.result === 'walk' || ab.result === 'hbp' ? 'bg-blue-100 text-blue-700' :
                        'bg-muted text-muted-foreground'
                      }`}
                    >
                      {(ab.result || '?').replace(/_/g, ' ')}
                    </Badge>
                    {ab.player_id && (
                      <button
                        onClick={() => setScoutingPlayer({ id: ab.player_id, name: ab.player_name || 'Unknown', bats: ab.batter_hand })}
                        className="ml-0.5 p-0.5 text-muted-foreground hover:text-primary transition-colors"
                        title="Scouting Report"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}