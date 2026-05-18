import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const HIT_RESULTS   = ['single','double','triple','home_run','bunt_single'];
const OUT_RESULTS   = ['strikeout_swinging','strikeout_looking','groundout','flyout','lineout','popout','rbi_groundout','fielders_choice','error','sac_fly','sac_bunt','bunt_out','in_play_out','double_play','triple_play'];
const STRIKE_P      = ['called_strike','swinging_strike','foul','in_play_out','in_play_hit'];
const SWING_P       = ['swinging_strike','foul','in_play_out','in_play_hit'];
const GB_RESULTS    = ['groundout','rbi_groundout','double_play','triple_play','bunt_out','fielders_choice'];
const FB_RESULTS    = ['flyout','sac_fly','popout'];
const LD_RESULTS    = ['lineout'];

const PITCH_META = {
  '4seam': '#ef4444','2seam': '#f97316','fastball': '#ef4444','sinker': '#f59e0b',
  'cutter': '#84cc16','slider': '#a855f7','sweeper': '#7c3aed','slurve': '#8b5cf6',
  'curveball': '#3b82f6','knuckle_curve': '#60a5fa','changeup': '#22c55e',
  'splitter': '#10b981','screwball': '#14b8a6','forkball': '#06b6d4',
  'knuckleball': '#64748b','eephus': '#ec4899',
};
const PITCH_LABEL = {
  '4seam':'4-Seam FB','2seam':'2-Seam FB','fastball':'Fastball','sinker':'Sinker',
  'cutter':'Cutter','slider':'Slider','sweeper':'Sweeper','slurve':'Slurve',
  'curveball':'Curveball','knuckle_curve':'Knuckle Curve','changeup':'Changeup',
  'splitter':'Splitter','screwball':'Screwball','forkball':'Forkball',
  'knuckleball':'Knuckleball','eephus':'Eephus',
};

function fmt(n, dec = 2) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—';
  return Number(n).toFixed(dec);
}
function pct(n, d) { return (!d) ? '—' : Math.round((n / d) * 100) + '%'; }
function ipFmt(outs) {
  const full = Math.floor(outs / 3), rem = outs % 3;
  return `${full}.${rem}`;
}

function ZoneBox({ zone, count, max, chase = false }) {
  const intensity = count / max;
  const bg = chase
    ? `rgba(251,146,60,${intensity * 0.85})`
    : `rgba(34,197,94,${intensity * 0.85})`;
  return (
    <div className="w-10 h-10 rounded flex flex-col items-center justify-center border border-muted-foreground/20 shrink-0"
      style={{ backgroundColor: bg }}>
      <span className="text-xs font-bold leading-none">{count || ''}</span>
      <span className="text-[8px] text-muted-foreground leading-none mt-0.5">{zone}</span>
    </div>
  );
}

// Bill James Game Score: 50 + outs + 2K - 2BB - 2H - 3ER  (capped 0–99+)
function calcGameScore(pitches, atBats) {
  const ks = atBats.filter(ab => ab.result === 'strikeout_swinging' || ab.result === 'strikeout_looking').length;
  const bbs = atBats.filter(ab => ab.result === 'walk').length;
  const hbp = atBats.filter(ab => ab.result === 'hbp').length;
  const hits = atBats.filter(ab => HIT_RESULTS.includes(ab.result)).length;
  // Use AtBat.earned_runs as single source of truth (consistent with all stat views)
  const erFromABs = atBats.reduce((s, ab) => s + (ab.earned_runs || 0), 0);
  const erFromPitches = pitches.reduce((s, p) => s + (p.earned_runs || 0), 0);
  const er = atBats.some(ab => ab.earned_runs != null) ? erFromABs : erFromPitches;
  const outs = atBats.reduce((acc, ab) => {
    if (ab.result === 'double_play') return acc + 2;
    if (ab.result === 'triple_play') return acc + 3;
    return OUT_RESULTS.includes(ab.result) ? acc + 1 : acc;
  }, 0);
  return Math.max(0, 50 + outs + 2 * ks - 2 * bbs - 2 * hbp - 2 * hits - 3 * er);
}

function gameScoreLabel(score) {
  if (score >= 70) return { label: 'Elite', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/40' };
  if (score >= 55) return { label: 'Strong', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' };
  if (score >= 40) return { label: 'Average', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/40' };
  return { label: 'Rough', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/40' };
}

function calcStats(pitches, atBats) {
  const totalPitches = pitches.length;
  const strikes   = pitches.filter(p => STRIKE_P.includes(p.result)).length;
  const swings    = pitches.filter(p => SWING_P.includes(p.result)).length;
  const whiffs    = pitches.filter(p => p.result === 'swinging_strike').length;
  const fps       = pitches.filter(p => p.pitch_number === 1 && STRIKE_P.includes(p.result)).length;
  const fpsBF     = pitches.filter(p => p.pitch_number === 1).length;
  const bf        = atBats.length;
  const ks        = atBats.filter(ab => ab.result === 'strikeout_swinging' || ab.result === 'strikeout_looking').length;
  const bbs       = atBats.filter(ab => ab.result === 'walk').length;
  const hbp       = atBats.filter(ab => ab.result === 'hbp').length;
  const hitsAllowed = atBats.filter(ab => HIT_RESULTS.includes(ab.result)).length;
  const hrs       = atBats.filter(ab => ab.result === 'home_run').length;
  const doubles   = atBats.filter(ab => ab.result === 'double').length;
  const triples   = atBats.filter(ab => ab.result === 'triple').length;
  const singles   = atBats.filter(ab => ab.result === 'single').length;
  const totalOuts = atBats.reduce((acc, ab) => {
    if (ab.result === 'double_play') return acc + 2;
    if (ab.result === 'triple_play') return acc + 3;
    if (OUT_RESULTS.includes(ab.result)) return acc + 1;
    return acc;
  }, 0);
  const gbOuts = atBats.filter(ab => GB_RESULTS.includes(ab.result)).length;
  const fbOuts = atBats.filter(ab => FB_RESULTS.includes(ab.result)).length;
  const ldOuts = atBats.filter(ab => LD_RESULTS.includes(ab.result)).length;
  const bip    = gbOuts + fbOuts + ldOuts;
  const ipDec  = Math.floor(totalOuts / 3) + (totalOuts % 3) / 3;
  const ip     = ipFmt(totalOuts);
  // Use AtBat.earned_runs as single source of truth (same as all other stat subsystems).
  // Fall back to pitch-level ER only if no AB-level data exists (old games).
  const erFromABs = atBats.reduce((sum, ab) => sum + (ab.earned_runs || 0), 0);
  const erFromPitches = pitches.reduce((sum, p) => sum + (p.earned_runs || 0), 0);
  const hasABLevelER = atBats.some(ab => ab.earned_runs != null);
  const earnedRuns = hasABLevelER ? erFromABs : erFromPitches;
  const era    = ipDec > 0 ? (earnedRuns * 9) / ipDec : null;
  const whip   = ipDec > 0 ? (bbs + hbp + hitsAllowed) / ipDec : null;
  const fip    = ipDec > 0 ? ((13 * hrs) + (3 * (bbs + hbp)) - (2 * ks)) / ipDec + 3.2 : null;
  const kPer9  = ipDec > 0 ? (ks / ipDec) * 9 : null;
  const bbPer9 = ipDec > 0 ? (bbs / ipDec) * 9 : null;
  const hPer9  = ipDec > 0 ? (hitsAllowed / ipDec) * 9 : null;
  const kbb    = bbs > 0 ? ks / bbs : null;
  const pPerIP = ipDec > 0 ? totalPitches / ipDec : null;
  const obpAgainst = bf > 0 ? (hitsAllowed + bbs + hbp) / bf : null;
  const tbAllowed = singles + (2 * doubles) + (3 * triples) + (4 * hrs);
  const abOpp = atBats.filter(ab => ab.result !== 'walk' && ab.result !== 'hbp').length;
  const slgAgainst = abOpp > 0 ? tbAllowed / abOpp : null;
  const opsAgainst = (obpAgainst != null && slgAgainst != null) ? obpAgainst + slgAgainst : null;
  const babipDenom = bf - bbs - hbp - ks - hrs;
  const babip = babipDenom > 0 ? (hitsAllowed - hrs) / babipDenom : null;
  const kPct  = bf > 0 ? ks / bf : null;
  const bbPct = bf > 0 ? bbs / bf : null;
  const hrPer9 = ipDec > 0 ? (hrs / ipDec) * 9 : null;
  const lob = totalOuts > 0 ? totalOuts / (totalOuts + hitsAllowed + bbs - hrs) : null;
  const baa = abOpp > 0 ? hitsAllowed / abOpp : null;
  return {
    totalPitches, strikes, swings, whiffs, fps, fpsBF, bf, ks, bbs, hbp,
    hitsAllowed, hrs, totalOuts, gbOuts, fbOuts, ldOuts, bip, ip, ipDec,
    earnedRuns, era, whip, fip, kPer9, bbPer9, hPer9, kbb, pPerIP, obpAgainst, slgAgainst,
    opsAgainst, babip, baa, kPct, bbPct, hrPer9, lob,
  };
}

// Per-game row
function GameRow({ game, pitches, atBats, onClick, pitcherName }) {
  const s = calcStats(pitches, atBats);
  const gs = calcGameScore(pitches, atBats);
  const { label: gsLabel, color: gsColor, bg: gsBg } = gameScoreLabel(gs);
  return (
    <button
      onClick={onClick}
      className="w-full text-left border rounded-xl p-3 hover:border-primary/50 transition-colors bg-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm">vs {game?.opponent || 'Unknown'}</p>
          <p className="text-xs text-muted-foreground">{game?.date || ''}</p>
          {pitcherName && <p className="text-xs font-medium text-primary mt-0.5">P: {pitcherName}</p>}
        </div>
        <Badge className={game?.status === 'final' ? 'bg-green-100 text-green-700 text-xs' : 'bg-yellow-100 text-yellow-700 text-xs'}>
          {game?.status === 'final' ? 'Final' : 'In Progress'}
        </Badge>
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${gsBg} ${gsColor}`}>
          <span>⚡ Game Score: {gs}</span>
          <span className="opacity-70">·</span>
          <span>{gsLabel}</span>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2 mt-2">
         {[
           { label: 'IP', val: s.ip },
           { label: 'ER', val: s.earnedRuns },
           { label: 'ERA', val: s.era != null ? fmt(s.era, 2) : '—' },
           { label: 'K',  val: s.ks },
           { label: 'BB', val: s.bbs },
           { label: 'H',  val: s.hitsAllowed },
         ].map(({ label, val }) => (
           <div key={label} className="text-center">
             <p className="text-sm font-bold">{val}</p>
             <p className="text-[10px] text-muted-foreground">{label}</p>
           </div>
         ))}
       </div>
    </button>
  );
}

// Expanded single-game detail
function GameDetail({ game, pitches, atBats, onBack, pitcherName }) {
  const s = calcStats(pitches, atBats);
  const gs = calcGameScore(pitches, atBats);
  const { label: gsLabel, color: gsColor, bg: gsBg } = gameScoreLabel(gs);
  const allZones = [1,2,3,4,5,6,7,8,9,11,12,13,14];
  const zoneMap = {};
  allZones.forEach(z => { zoneMap[z] = pitches.filter(p => p.zone === z).length; });
  const maxZone = Math.max(...Object.values(zoneMap), 1);
  const pitchTypeData = useMemo(() => {
    const m = {};
    pitches.forEach(p => {
      if (!p.pitch_type) return;
      if (!m[p.pitch_type]) m[p.pitch_type] = { total: 0, strikes: 0, whiffs: 0, swings: 0 };
      m[p.pitch_type].total++;
      if (STRIKE_P.includes(p.result)) m[p.pitch_type].strikes++;
      if (p.result === 'swinging_strike') m[p.pitch_type].whiffs++;
      if (SWING_P.includes(p.result)) m[p.pitch_type].swings++;
    });
    return Object.entries(m).sort((a,b) => b[1].total - a[1].total).map(([type, d]) => ({
      type, color: PITCH_META[type] || '#94a3b8', label: PITCH_LABEL[type] || type,
      total: d.total,
      usagePct: s.totalPitches ? Math.round(d.total / s.totalPitches * 100) : 0,
      strikePct: d.total ? Math.round(d.strikes / d.total * 100) : 0,
      whiffPct: d.swings ? Math.round(d.whiffs / d.swings * 100) : 0,
    }));
  }, [pitches, s.totalPitches]);

  const hitLocations = pitches.filter(p => (p.result === 'in_play_out' || p.result === 'in_play_hit') && p.hit_location_x != null);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-1 -ml-1" onClick={onBack}>← Back to games</Button>
      <div>
        <p className="font-bold text-lg">vs {game?.opponent || 'Unknown'}</p>
        <p className="text-sm text-muted-foreground">{game?.date || ''}{game?.location ? ` • ${game.location}` : ''}</p>
        {pitcherName && <p className="text-sm font-semibold text-primary mt-0.5">Pitcher: {pitcherName}</p>}
      </div>

      {/* Game Score badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold ${gsBg} ${gsColor}`}>
        <span>⚡ Game Score: {gs}</span>
        <span className="opacity-60">·</span>
        <span>{gsLabel}</span>
        <span className="text-xs font-normal opacity-60 ml-1">50 + outs + 2K − 2BB − 2H − 3ER</span>
      </div>

      {/* Core stats */}
       <div className="grid grid-cols-5 gap-2">
         {[['IP', s.ip, 'text-primary'],['ER', s.earnedRuns, 'text-destructive'],['ERA', s.era != null ? fmt(s.era, 2) : '—', 'text-destructive'],['K', s.ks, 'text-primary'],['BB', s.bbs, '']].map(([l,v,c]) => (
           <div key={l} className="bg-muted/50 rounded-xl p-3 text-center">
             <p className={`text-xl font-bold ${c}`}>{v}</p>
             <p className="text-xs text-muted-foreground">{l}</p>
           </div>
         ))}
       </div>
      <div className="grid grid-cols-4 gap-2">
        {[['Strikes', s.strikes, 'text-primary'],['Balls', s.totalPitches - s.strikes, ''],['H', s.hitsAllowed, 'text-destructive'],['BF', s.bf, '']].map(([l,v,c]) => (
          <div key={l} className="bg-muted/30 rounded-xl p-2.5 text-center">
            <p className={`text-lg font-bold ${c}`}>{v}</p>
            <p className="text-xs text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>

      {/* Rate stats */}
      {s.totalPitches > 0 && (
        <Card>
          <CardHeader className="pb-1 pt-3"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate Stats</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            {[
              ['Strike%', pct(s.strikes, s.totalPitches)],
              ['Whiff%', pct(s.whiffs, s.swings)],
              ['FPS%', pct(s.fps, s.fpsBF)],
              ['K%', pct(s.ks, s.bf)],
              ['BB%', pct(s.bbs, s.bf)],
              ['GB%', s.bip > 0 ? pct(s.gbOuts, s.bip) : '—'],
            ].map(([l,v]) => (
              <div key={l} className="bg-muted/40 rounded-lg p-2 text-center">
                <p className="text-sm font-bold">{v}</p>
                <p className="text-[10px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Advanced */}
      {s.ipDec > 0 && (
        <Card>
          <CardHeader className="pb-1 pt-3"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Advanced</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            {[
              ['WHIP', fmt(s.whip)],
              ['FIP', fmt(s.fip)],
              ['K/BB', s.kbb != null ? fmt(s.kbb, 1) : '—'],
              ['K/9', fmt(s.kPer9, 1)],
              ['BB/9', fmt(s.bbPer9, 1)],
              ['H/9', fmt(s.hPer9, 1)],
              ['P/IP', fmt(s.pPerIP, 1)],
              ['BABIP', fmt(s.babip, 3)],
              ['HR/9', fmt(s.hrPer9, 1)],
            ].map(([l,v]) => (
              <div key={l} className="bg-muted/40 rounded-lg p-2 text-center">
                <p className="text-sm font-bold">{v}</p>
                <p className="text-[10px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pitch Arsenal */}
      {pitchTypeData.length > 0 && (
        <Card>
          <CardHeader className="pb-1 pt-3"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pitch Arsenal</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pitchTypeData.map(pt => (
              <div key={pt.type} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                  style={{ backgroundColor: pt.color }}>
                  {pt.label.split(' ').map(w => w[0]).join('').slice(0,3)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{pt.label}</span>
                    <span className="text-xs text-muted-foreground">{pt.total} ({pt.usagePct}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-0.5">
                    <div className="h-full rounded-full" style={{ width: `${pt.usagePct}%`, backgroundColor: pt.color }} />
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[10px] text-muted-foreground">Strike {pt.strikePct}%</span>
                    <span className="text-[10px] text-muted-foreground">Whiff {pt.whiffPct}%</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Zone heatmap */}
      {pitches.some(p => p.zone != null) && (
        <Card>
          <CardHeader className="pb-1 pt-3"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zone Heatmap</CardTitle></CardHeader>
          <CardContent className="flex justify-center">
            <div>
              <div className="flex flex-col gap-1">
                <div className="flex gap-1">
                  {[11,1,2,3,12].map(z => <ZoneBox key={z} zone={z} count={zoneMap[z]} max={maxZone} chase={z>10} />)}
                </div>
                {[[4,5,6],[7,8,9]].map((row, ri) => (
                  <div key={ri} className="flex gap-1">
                    <div className="w-10 h-10"/>
                    {row.map(z => <ZoneBox key={z} zone={z} count={zoneMap[z]} max={maxZone} />)}
                    <div className="w-10 h-10"/>
                  </div>
                ))}
                <div className="flex gap-1">
                  <ZoneBox zone={13} count={zoneMap[13]} max={maxZone} chase />
                  <div className="w-10 h-10"/><div className="w-10 h-10"/><div className="w-10 h-10"/>
                  <ZoneBox zone={14} count={zoneMap[14]} max={maxZone} chase />
                </div>
              </div>
              <div className="flex gap-4 justify-center mt-2">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500 opacity-70"/><span className="text-[10px] text-muted-foreground">Strike Zone</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-400 opacity-70"/><span className="text-[10px] text-muted-foreground">Chase Zone</span></div>
              </div>
              <p className="text-[10px] text-center text-muted-foreground mt-1">Pitcher's view</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spray chart */}
      {hitLocations.length > 0 && (
        <Card>
          <CardHeader className="pb-1 pt-3"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Balls in Play ({hitLocations.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="relative w-full max-w-[240px] mx-auto aspect-square">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <path d="M 100 192 L 8 100 Q 100 -10 192 100 Z" fill="#2d6a2d" stroke="#fff" strokeWidth="0.5" opacity="0.6" />
                <path d="M 100 175 L 28 103 Q 100 20 172 103 Z" fill="#8B6914" opacity="0.7" />
                <path d="M 100 162 L 42 106 Q 100 38 158 106 Z" fill="#3a7a3a" opacity="0.8" />
                <line x1="100" y1="175" x2="35" y2="105" stroke="white" strokeWidth="0.8" opacity="0.5" />
                <line x1="100" y1="175" x2="165" y2="105" stroke="white" strokeWidth="0.8" opacity="0.5" />
                {[[100,162],[130,106],[100,56],[70,106]].map(([x,y],i) => (
                  <rect key={i} x={x-3} y={y-3} width="6" height="6" fill="white" transform={`rotate(45 ${x} ${y})`} />
                ))}
                <polygon points="100,178 94,184 94,192 106,192 106,184" fill="white" />
                {hitLocations.map((p, i) => (
                  <circle key={i} cx={(p.hit_location_x / 100) * 200} cy={(p.hit_location_y / 110) * 200}
                    r="5" fill={p.result === 'in_play_hit' ? '#22c55e' : '#ef4444'}
                    stroke="white" strokeWidth="1.5" opacity="0.85" />
                ))}
              </svg>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Full career stats panel
function CareerStats({ pitcherName, allPitches, allAtBats }) {
  // Validate that stats belong to this pitcher only — pitches already pre-filtered by caller
  const s = calcStats(allPitches, allAtBats);
  const gamesPlayed = new Set(allPitches.map(p => p.game_id).filter(Boolean)).size;

  const pitchTypeData = useMemo(() => {
    const m = {};
    allPitches.forEach(p => {
      if (!p.pitch_type) return;
      if (!m[p.pitch_type]) m[p.pitch_type] = { total: 0, strikes: 0, whiffs: 0, swings: 0 };
      m[p.pitch_type].total++;
      if (STRIKE_P.includes(p.result)) m[p.pitch_type].strikes++;
      if (p.result === 'swinging_strike') m[p.pitch_type].whiffs++;
      if (SWING_P.includes(p.result)) m[p.pitch_type].swings++;
    });
    return Object.entries(m).sort((a,b) => b[1].total - a[1].total).map(([type, d]) => ({
      type, color: PITCH_META[type] || '#94a3b8', label: PITCH_LABEL[type] || type,
      total: d.total,
      usagePct: s.totalPitches ? Math.round(d.total / s.totalPitches * 100) : 0,
      strikePct: d.total ? Math.round(d.strikes / d.total * 100) : 0,
      whiffPct: d.swings ? Math.round(d.whiffs / d.swings * 100) : 0,
    }));
  }, [allPitches, s.totalPitches]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-bold">{pitcherName}</p>
        <p className="text-xs text-muted-foreground">Career Statistics</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-primary/10 text-primary">{gamesPlayed} game{gamesPlayed !== 1 ? 's' : ''}</Badge>
        <Badge variant="outline">{s.totalPitches} career pitches</Badge>
      </div>

      {/* Basic Stats */}
      <Card>
        <CardHeader className="pb-1 pt-3"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basic Pitching Stats</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-5 gap-2">
          {[
            ['IP', s.ip],['ER', s.earnedRuns],['ERA', s.era != null ? fmt(s.era, 2) : '—'],['K', s.ks],['BB', s.bbs],
            ['Strikes', s.strikes],['Balls', s.totalPitches - s.strikes],['H', s.hitsAllowed],['PC', s.totalPitches],['BF', s.bf],
          ].map(([l,v]) => (
            <div key={l} className="bg-muted/50 rounded-xl p-2.5 text-center">
              <p className="text-base font-bold">{v}</p>
              <p className="text-[10px] text-muted-foreground">{l}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 10 Common Sabermetrics */}
      <Card>
        <CardHeader className="pb-1 pt-3"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sabermetrics</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {[
            { label: 'ERA',    val: s.era != null ? fmt(s.era, 2) : '—', desc: 'Earned runs per 9 innings', lb: true },
            { label: 'BAA',    val: s.baa != null ? fmt(s.baa, 3) : '—', desc: 'Batting average against', lb: true },
            { label: 'K%',     val: pct(s.ks, s.bf),                  desc: 'Strikeout rate per BF' },
            { label: 'BB%',    val: pct(s.bbs, s.bf),                 desc: 'Walk rate per BF', lb: true },
            { label: 'K/BB',   val: s.kbb != null ? fmt(s.kbb, 2) : '—', desc: 'Strikeout-to-walk ratio' },
            { label: 'K/9',    val: fmt(s.kPer9, 2),                  desc: 'Ks per 9 innings' },
            { label: 'BB/9',   val: fmt(s.bbPer9, 2),                 desc: 'BBs per 9 innings', lb: true },
            { label: 'H/9',    val: fmt(s.hPer9, 2),                  desc: 'Hits per 9 innings', lb: true },
            { label: 'WHIP',   val: fmt(s.whip, 2),                   desc: '(BB+H) / IP', lb: true },
            { label: 'OPS Against',val: fmt(s.opsAgainst, 3),         desc: 'OBP+SLG vs pitcher', lb: true },
          ].map(({ label, val, desc, lb }) => (
            <div key={label} className={`rounded-xl p-3 ${lb ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-muted/40'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                <span className={`text-sm font-bold ${lb ? 'text-blue-600 dark:text-blue-400' : ''}`}>{val}</span>
              </div>
              <p className="text-[9px] text-muted-foreground/60 mt-0.5">{desc}{lb ? ' ↓' : ''}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 10 Advanced Sabermetrics */}
      <Card>
        <CardHeader className="pb-1 pt-3"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Advanced Metrics</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {[
            { label: 'FIP',    val: fmt(s.fip, 2),                    desc: 'Fielding Independent Pitching' },
            { label: 'BABIP',  val: fmt(s.babip, 3),                  desc: 'Batting avg on balls in play' },
            { label: 'Whiff%', val: pct(s.whiffs, s.swings),          desc: 'Swings and misses / swings' },
            { label: 'FPS%',   val: pct(s.fps, s.fpsBF),             desc: 'First-pitch strike rate' },
            { label: 'GB%',    val: s.bip > 0 ? pct(s.gbOuts, s.bip) : '—', desc: 'Ground balls / balls in play' },
            { label: 'FB%',    val: s.bip > 0 ? pct(s.fbOuts, s.bip) : '—', desc: 'Fly balls / balls in play' },
            { label: 'LD%',    val: s.bip > 0 ? pct(s.ldOuts, s.bip) : '—', desc: 'Line drives / balls in play' },
            { label: 'P/IP',   val: fmt(s.pPerIP, 1),                 desc: 'Pitch efficiency per inning' },
            { label: 'OBP Ag.',val: fmt(s.obpAgainst, 3),            desc: 'On-base % against' },
            { label: 'SLG Ag.',val: fmt(s.slgAgainst, 3),            desc: 'Slugging % against' },
          ].map(({ label, val, desc }) => (
            <div key={label} className="bg-muted/40 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                <span className="text-sm font-bold">{val}</span>
              </div>
              <p className="text-[9px] text-muted-foreground/60 mt-0.5">{desc}</p>
            </div>
          ))}
        </CardContent>

      </Card>

      {/* Career Arsenal */}
      {pitchTypeData.length > 0 && (
        <Card>
          <CardHeader className="pb-1 pt-3"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Career Arsenal</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pitchTypeData.map(pt => (
              <div key={pt.type} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                  style={{ backgroundColor: pt.color }}>
                  {pt.label.split(' ').map(w => w[0]).join('').slice(0,3)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{pt.label}</span>
                    <span className="text-xs text-muted-foreground">{pt.total} ({pt.usagePct}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-0.5">
                    <div className="h-full rounded-full" style={{ width: `${pt.usagePct}%`, backgroundColor: pt.color }} />
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[10px] text-muted-foreground">Strike {pt.strikePct}%</span>
                    <span className="text-[10px] text-muted-foreground">Whiff {pt.whiffPct}%</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PitcherCareerStats({ pitcherName, allPitches, allAtBats, games }) {
  const [view, setView] = useState('games'); // 'games' | 'career' | { gameId }

  // Group pitches and at-bats by game — include games from BOTH pitch records AND at-bat records
  // so games tracked at-bat-only (no pitch-by-pitch) still appear in the log
  const gameIds = useMemo(() => {
    const fromPitches = allPitches.map(p => p.game_id).filter(Boolean);
    const fromAtBats  = allAtBats.map(ab => ab.game_id).filter(Boolean);
    return [...new Set([...fromPitches, ...fromAtBats])];
  }, [allPitches, allAtBats]);

  const gameMap = useMemo(() => {
    const m = {};
    games.forEach(g => { m[g.id] = g; });
    return m;
  }, [games]);

  const gameData = useMemo(() => {
    return gameIds.map(gid => {
      const gamePitches = allPitches.filter(p => p.game_id === gid);
      const gameAtBatIds = new Set(gamePitches.map(p => p.at_bat_id).filter(Boolean));
      const pitcherNameUpper = (pitcherName || '').toUpperCase();
      const filteredAtBats = allAtBats.filter(ab => {
        // Always exclude synthetic runner-advancement records from pitching stat views
        if (ab.player_id === 'ADVANCEMENT' || ab.player_name === 'ADVANCEMENT') return false;
        if (ab.game_id !== gid) return false;
        // Primary: pitch→at_bat_id linkage (most accurate)
        if (gameAtBatIds.has(ab.id)) return true;
        // If there are NO pitches for this game, include at-bats by pitcher_name
        if (gamePitches.length === 0) return (ab.pitcher_name || '').toUpperCase() === pitcherNameUpper;
        // Otherwise only include if stamped with this pitcher's name
        return (ab.pitcher_name || '').toUpperCase() === pitcherNameUpper;
      });
      // Deduplicate by at-bat id (prevent double-counting if both linkage paths match)
      const seen = new Set();
      const uniqueAtBats = filteredAtBats.filter(ab => {
        if (seen.has(ab.id)) return false;
        seen.add(ab.id);
        return true;
      });
      return {
        gameId: gid,
        game: gameMap[gid],
        pitches: gamePitches,
        atBats: uniqueAtBats,
      };
    }).sort((a, b) => {
      const da = a.game?.date || '';
      const db = b.game?.date || '';
      return db.localeCompare(da);
    });
  }, [gameIds, allPitches, allAtBats, gameMap]);

  if (typeof view === 'object' && view.gameId) {
    const gd = gameData.find(g => g.gameId === view.gameId);
    return (
      <GameDetail
        game={gd?.game}
        pitches={gd?.pitches || []}
        atBats={gd?.atBats || []}
        pitcherName={pitcherName}
        onBack={() => setView('games')}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex gap-2">
        <Button size="sm" variant={view === 'games' ? 'default' : 'outline'} className="flex-1" onClick={() => setView('games')}>
          Game Log
        </Button>
        <Button size="sm" variant={view === 'career' ? 'default' : 'outline'} className="flex-1" onClick={() => setView('career')}>
          Career Stats
        </Button>
      </div>

      {view === 'games' && (
        <div className="space-y-2">
          {gameData.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No game data found.</p>
          )}
          {gameData.map(gd => (
            <GameRow
              key={gd.gameId}
              game={gd.game}
              pitches={gd.pitches}
              atBats={gd.atBats}
              pitcherName={pitcherName}
              onClick={() => setView({ gameId: gd.gameId })}
            />
          ))}
        </div>
      )}

      {view === 'career' && (
        <CareerStats
          pitcherName={pitcherName}
          allPitches={allPitches}
          allAtBats={allAtBats}
        />
      )}
    </div>
  );
}