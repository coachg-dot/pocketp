import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, AlertCircle, Target } from 'lucide-react';

import BestBetReport from '@/components/BestBetReport';
import TeamPlayerPicker from '@/components/TeamPlayerPicker';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

const HIT_RESULTS = ['single','double','triple','home_run','bunt_single'];
const STRIKE_P    = ['called_strike','swinging_strike','foul','in_play_out','in_play_hit'];
const SWING_P     = ['swinging_strike','foul','in_play_out','in_play_hit'];
const GB_RESULTS  = ['groundout','rbi_groundout','double_play','triple_play','bunt_out','fielders_choice'];
const FB_RESULTS  = ['flyout','sac_fly','popout'];
const PITCH_LABEL = {
  '4seam':'4-Seam FB','2seam':'2-Seam FB','fastball':'Fastball','sinker':'Sinker',
  'cutter':'Cutter','slider':'Slider','sweeper':'Sweeper','slurve':'Slurve',
  'curveball':'Curveball','knuckle_curve':'Knuckle Curve','changeup':'Changeup',
  'splitter':'Splitter','knuckleball':'Knuckleball','eephus':'Eephus',
};

function fmt(n, dec = 2) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—';
  return Number(n).toFixed(dec);
}
function pct(n, d) { return (!d) ? null : Math.round((n / d) * 100); }

function calcPitcherProfile(pitches, atBats) {
  const total = pitches.length;
  if (!total) return null;
  const strikes = pitches.filter(p => STRIKE_P.includes(p.result)).length;
  const swings  = pitches.filter(p => SWING_P.includes(p.result)).length;
  const whiffs  = pitches.filter(p => p.result === 'swinging_strike').length;
  const bf      = atBats.length;
  const ks      = atBats.filter(ab => ab.result === 'strikeout_swinging' || ab.result === 'strikeout_looking').length;
  const bbs     = atBats.filter(ab => ab.result === 'walk').length;
  const hbp     = atBats.filter(ab => ab.result === 'hbp').length;
  const hits    = atBats.filter(ab => HIT_RESULTS.includes(ab.result)).length;
  const hrs     = atBats.filter(ab => ab.result === 'home_run').length;

  // pitch mix
  const pitchCounts = {};
  pitches.forEach(p => { if (p.pitch_type) pitchCounts[p.pitch_type] = (pitchCounts[p.pitch_type] || 0) + 1; });
  const pitchMix = Object.entries(pitchCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, cnt]) => `${PITCH_LABEL[type] || type} ${Math.round(cnt/total*100)}%`)
    .join(', ');

  const totalOuts = atBats.reduce((acc, ab) => {
    if (ab.result === 'double_play') return acc + 2;
    if (ab.result === 'triple_play') return acc + 3;
    if (['strikeout_swinging','strikeout_looking','groundout','flyout','lineout','popout',
         'rbi_groundout','fielders_choice','error','sac_fly','sac_bunt','bunt_out','in_play_out'].includes(ab.result)) return acc + 1;
    return acc;
  }, 0);
  const ipDec = Math.floor(totalOuts / 3) + (totalOuts % 3) / 3;

  return {
    name: pitches[0]?.pitcher_name || 'Unknown',
    totalPitches: total,
    bf,
    strikePct: pct(strikes, total),
    whiffPct: pct(whiffs, swings),
    kPct: pct(ks, bf),
    bbPct: pct(bbs, bf),
    whip: ipDec > 0 ? ((bbs + hbp + hits) / ipDec).toFixed(2) : '—',
    pitchMix,
    games: new Set(pitches.map(p => p.game_id).filter(Boolean)).size,
  };
}

function calcHitterProfile(atBats) {
  const pa = atBats.length;
  if (!pa) return null;
  const ab   = atBats.filter(a => !['walk','hbp','sac_fly','sac_bunt'].includes(a.result)).length;
  const hits = atBats.filter(a => HIT_RESULTS.includes(a.result)).length;
  const ks   = atBats.filter(a => a.result === 'strikeout_swinging' || a.result === 'strikeout_looking').length;
  const bbs  = atBats.filter(a => a.result === 'walk').length;
  const hbp  = atBats.filter(a => a.result === 'hbp').length;
  const hrs  = atBats.filter(a => a.result === 'home_run').length;
  const gbs  = atBats.filter(a => GB_RESULTS.includes(a.result)).length;
  const fbs  = atBats.filter(a => FB_RESULTS.includes(a.result)).length;
  const avg  = ab > 0 ? (hits / ab) : null;
  const obp  = pa > 0 ? ((hits + bbs + hbp) / pa) : null;

  return {
    pa, ab, hits, ks, bbs, hrs,
    avg: avg != null ? '.' + String(Math.round(avg * 1000)).padStart(3, '0') : '.---',
    obp: obp != null ? '.' + String(Math.round(obp * 1000)).padStart(3, '0') : '.---',
    kPct: pct(ks, pa),
    bbPct: pct(bbs, pa),
    gbPct: pct(gbs, pa),
    fbPct: pct(fbs, pa),
    hrPer10: pa > 0 ? fmt(hrs / pa * 10, 1) : '—',
    hand: atBats[0]?.batter_hand || '?',
  };
}

function ProfileCard({ title, items }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-3">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {items.map(([label, value]) => (
          <div key={label} className="bg-muted/40 rounded-lg px-2 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
            <span className="text-xs font-bold">{value ?? '—'}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Load saved repertoire from localStorage
function getStoredRepertoire(pitcherName) {
  try {
    const stored = JSON.parse(localStorage.getItem('pitcher-repertoires') || '{}');
    return stored[pitcherName?.toUpperCase()] || [];
  } catch { return []; }
}

const PITCH_LABEL_MAP = {
  '4seam':'4-Seam FB','2seam':'2-Seam FB','fastball':'Fastball','sinker':'Sinker',
  'cutter':'Cutter','slider':'Slider','sweeper':'Sweeper','slurve':'Slurve',
  'curveball':'Curveball','knuckle_curve':'Knuckle Curve','changeup':'Changeup',
  'splitter':'Splitter','knuckleball':'Knuckleball','eephus':'Eephus',
};

export default function FantasyMatchup({ pitches, atBats }) {
  const [pitcher, setPitcher] = useState('');
  const [batter, setBatter] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(false);

  // Load TeamPitcher repertoires for roster lookup
  const { data: teamPitchers = [] } = useQuery({
    queryKey: ['team-pitchers'],
    queryFn: () => base44.entities.TeamPitcher.list(),
  });

  // Load TeamPlayer records so we can use imported stats as batter profile fallback
  const { data: teamPlayers = [] } = useQuery({
    queryKey: ['teamPlayers-all'],
    queryFn: () => base44.entities.TeamPlayer.list('name'),
  });

  const BEST_BET_KEY = '__best_bet__';

  // All unique batters
  const batters = useMemo(() => {
    const s = new Set();
    atBats.forEach(ab => { if (ab.player_name) s.add(ab.player_name.trim()); });
    return [...s].sort();
  }, [atBats]);

  // All unique pitchers: from tracked pitches + TeamPitcher roster entries
  const pitchers = useMemo(() => {
    const s = new Set();
    pitches.forEach(p => { if (p.pitcher_name) s.add(p.pitcher_name.trim()); });
    teamPitchers.forEach(p => { if (p.name) s.add(p.name.trim()); });
    return [...s].sort();
  }, [pitches, teamPitchers]);

  // Pitcher profile
  const pitcherAtBatIds = useMemo(() => {
    if (!pitcher) return new Set();
    return new Set(pitches.filter(p => p.pitcher_name?.trim() === pitcher && p.at_bat_id).map(p => p.at_bat_id));
  }, [pitches, pitcher]);

  const pitcherProfile = useMemo(() => {
    if (!pitcher) return null;
    const pp = pitches.filter(p => p.pitcher_name?.trim() === pitcher);
    const pa = atBats.filter(ab => pitcherAtBatIds.has(ab.id));
    const fromHistory = calcPitcherProfile(pp, pa);
    if (fromHistory) return fromHistory;
    // No tracked pitch data — build a repertoire-only profile if the pitcher has a saved repertoire
    const savedRep = getStoredRepertoire(pitcher);
    const tp = teamPitchers.find(p => p.name?.toUpperCase() === pitcher.toUpperCase());
    const rep = (tp?.pitch_repertoire?.length ? tp.pitch_repertoire : savedRep);
    if (!rep.length) return null; // no history and no repertoire → truly unknown
    return {
      name: pitcher,
      totalPitches: 0,
      bf: 0,
      strikePct: null,
      whiffPct: null,
      kPct: null,
      bbPct: null,
      whip: '—',
      pitchMix: rep.map(r => PITCH_LABEL_MAP[r] || r).join(', '),
      games: 0,
      repertoireOnly: true,
      repertoire: rep,
    };
  }, [pitcher, pitches, atBats, pitcherAtBatIds, teamPitchers]);

  // Hitter profile
  const hitterAtBats = useMemo(() => {
    if (!batter) return [];
    return atBats.filter(ab => ab.player_name?.trim() === batter);
  }, [atBats, batter]);

  const hitterProfile = useMemo(() => {
    if (!batter) return null;
    // Prefer tracked at-bat data
    const fromAtBats = calcHitterProfile(hitterAtBats);
    if (fromAtBats) return fromAtBats;
    // Fallback: use imported stats from TeamPlayer entity
    const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const tp = teamPlayers.find(p => norm(p.name) === norm(batter));
    if (!tp) return null;
    // Return even if some stats are null — we have a player record
    if (tp.stats_avg == null && tp.stats_ab == null && tp.stats_h == null) return null;
    const avg = tp.stats_avg;
    const obp = tp.stats_obp;
    const pa  = tp.stats_ab ?? tp.stats_gp ?? 0;
    const ks  = tp.stats_so;
    const bbs = tp.stats_bb;
    const hrs = tp.stats_hr;
    return {
      pa:     pa,
      ab:     tp.stats_ab ?? pa,
      hits:   tp.stats_h ?? null,
      ks:     ks ?? null,
      bbs:    bbs ?? null,
      hrs:    hrs ?? null,
      avg:    avg != null ? '.' + String(Math.round(avg * 1000)).padStart(3, '0') : '.---',
      obp:    obp != null ? '.' + String(Math.round(obp * 1000)).padStart(3, '0') : '.---',
      kPct:   pa && ks != null ? Math.round((ks / pa) * 100) : null,
      bbPct:  pa && bbs != null ? Math.round((bbs / pa) * 100) : null,
      gbPct:  null,
      fbPct:  null,
      hrPer10: pa && hrs != null ? (hrs / pa * 10).toFixed(1) : '—',
      hand:   tp.bats || '?',
      fromImportedStats: true,
    };
  }, [batter, hitterAtBats, teamPlayers]);

  // Actual h2h data
  const h2hAtBats = useMemo(() => {
    if (!pitcher || !batter) return [];
    return atBats.filter(ab => pitcherAtBatIds.has(ab.id) && ab.player_name?.trim() === batter);
  }, [atBats, pitcherAtBatIds, batter]);

  const hasRealData = h2hAtBats.length > 0;

  const handleGenerateAnalysis = useCallback(async () => {
    if (!pitcher || !batter) return;

    // Resolve pitcher's repertoire
    let pitcherRepertoire = pitcherProfile?.repertoire || [];
    if (!pitcherRepertoire.length) pitcherRepertoire = getStoredRepertoire(pitcher);
    if (!pitcherRepertoire.length) {
      const tp = teamPitchers.find(p => p.name?.toUpperCase() === pitcher.toUpperCase());
      if (tp?.pitch_repertoire?.length) pitcherRepertoire = tp.pitch_repertoire;
    }
    const repertoireStr = pitcherRepertoire.length
      ? pitcherRepertoire.map(r => PITCH_LABEL_MAP[r] || r).join(', ')
      : null;

    // Block only if pitcher has zero history AND zero repertoire
    if (!pitcherProfile && !repertoireStr) {
      setAnalysis({ error: `No pitch data or repertoire found for ${pitcher}. Please add a pitch repertoire for this pitcher first.` });
      return;
    }

    if (!hitterProfile) {
      setAnalysis({ error: `No at-bat data or stats found for ${batter}. This batter needs tracked at-bats or imported stats first.` });
      return;
    }

    try {
      setLoading(true);
      setAnalysis(null);

      const repertoireConstraint = repertoireStr
        ? `\nPITCHER REPERTOIRE: ${repertoireStr}\nCRITICAL: The pitch sequence recommendation MUST use ONLY pitches from this repertoire: ${repertoireStr}. Do NOT suggest any pitch not in this list.`
        : '';

      const isRepertoireOnly = pitcherProfile?.repertoireOnly;

      const prompt = `You are a baseball analytics expert. Based on the following stats, analyze a fantasy matchup between a pitcher and a batter. Be concise but insightful.

  PITCHER: ${pitcher}${isRepertoireOnly ? ' (no tracked historical data — analyze from repertoire only)' : ''}
  ${isRepertoireOnly
    ? `- No historical pitch data available.`
    : `- Games: ${pitcherProfile.games}, Total Pitches: ${pitcherProfile.totalPitches}, BF: ${pitcherProfile.bf}
  - Strike%: ${pitcherProfile.strikePct != null ? pitcherProfile.strikePct + '%' : '—'}, Whiff%: ${pitcherProfile.whiffPct != null ? pitcherProfile.whiffPct + '%' : '—'}, K%: ${pitcherProfile.kPct != null ? pitcherProfile.kPct + '%' : '—'}, BB%: ${pitcherProfile.bbPct != null ? pitcherProfile.bbPct + '%' : '—'}
  - WHIP: ${pitcherProfile.whip}
  - Pitch Mix: ${pitcherProfile.pitchMix || 'Unknown'}`}
  - Repertoire: ${repertoireStr || 'Unknown'}${repertoireConstraint}

  BATTER: ${batter}${hitterProfile.fromImportedStats ? ' (stats from imported season data)' : ''}
  - PA/AB: ${hitterProfile.pa}, AVG: ${hitterProfile.avg}, OBP: ${hitterProfile.obp}
  - HR: ${hitterProfile.hrs ?? '—'}, K%: ${hitterProfile.kPct != null ? hitterProfile.kPct + '%' : '—'}, BB%: ${hitterProfile.bbPct != null ? hitterProfile.bbPct + '%' : '—'}
  - GB%: ${hitterProfile.gbPct != null ? hitterProfile.gbPct + '%' : '—'}, FB%: ${hitterProfile.fbPct != null ? hitterProfile.fbPct + '%' : '—'}
  - HR/10PA: ${hitterProfile.hrPer10}, Hand: ${hitterProfile.hand}

  ${hasRealData ? `ACTUAL H2H: ${h2hAtBats.length} PA on record.` : 'NO ACTUAL H2H DATA - base prediction on tendencies only.'}
  ${isRepertoireOnly ? 'NOTE: No historical pitch data exists for this pitcher. Base your entire analysis on the saved repertoire and batter tendencies.' : ''}

  Provide:
  1. A brief matchup edge assessment (2-3 sentences, who has the advantage and why)
  2. Predicted outcome probabilities for this at-bat: Hit%, Walk%, Strikeout%, Other Out%
  3. One key factor that will decide this matchup
  4. A pitch sequence recommendation for the pitcher (2-3 pitches)${repertoireStr ? ` using ONLY pitches from the repertoire: ${repertoireStr}` : ''}

  Format your response as JSON matching this schema exactly.`;

       const result = await base44.integrations.Core.InvokeLLM({
         prompt,
         response_json_schema: {
           type: 'object',
           properties: {
             edge_assessment: { type: 'string' },
             predicted_hit_pct: { type: 'number' },
             predicted_walk_pct: { type: 'number' },
             predicted_strikeout_pct: { type: 'number' },
             predicted_other_out_pct: { type: 'number' },
             key_factor: { type: 'string' },
             pitch_sequence: { type: 'string' },
           },
         },
       });

       setAnalysis(result);
       setLoading(false);
     } catch (error) {
       setAnalysis({ error: 'Error generating analysis: ' + (error.message || 'Unknown error') });
       setLoading(false);
     }
   }, [pitcher, pitcherProfile, hitterProfile, h2hAtBats, teamPitchers, hasRealData, batter]);

  // Auto-generate when coming from Best Bet picker — runs once after profiles load
  useEffect(() => {
    if (autoGenerate && pitcherProfile && hitterProfile) {
      setAutoGenerate(false);
      handleGenerateAnalysis();
    }
  }, [autoGenerate, pitcherProfile, hitterProfile, handleGenerateAnalysis]);

  const resetAnalysis = () => setAnalysis(null);

  const handleSelectFromBestBet = (pitcherName) => {
    setPitcher(pitcherName);
    setAnalysis(null);
    setAutoGenerate(true);
  };

  if (pitcher === BEST_BET_KEY && batter) {
    return (
      <BestBetReport
        batter={batter}
        pitches={pitches}
        atBats={atBats}
        mode="fantasy"
        onBack={() => setPitcher('')}
        onSelectPitcher={handleSelectFromBestBet}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode badge */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent" />
        <p className="text-xs text-muted-foreground">Select any pitcher and batter — AI will analyze their tendencies for the Pocket Predictor report.</p>
      </div>

      {/* Selectors — batter first, then pitcher */}
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Batter</p>
          <TeamPlayerPicker
            label="Batter"
            names={batters}
            value={batter}
            onChange={v => { setBatter(v); setPitcher(''); resetAnalysis(); }}
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Pitcher</p>
          {batter && (
            <button
              type="button"
              onClick={() => {
                setPitcher(BEST_BET_KEY);
                resetAnalysis();
              }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border mb-1.5 text-xs font-semibold transition-colors ${pitcher === BEST_BET_KEY ? 'bg-accent/20 border-accent text-accent' : 'bg-accent/5 border-accent/30 text-accent hover:bg-accent/15'}`}
            >
              <Target className="w-3.5 h-3.5" /> Best Bet
            </button>
          )}
          <TeamPlayerPicker
            label="Pitcher"
            names={pitchers}
            value={pitcher === BEST_BET_KEY ? '' : pitcher}
            onChange={v => { setPitcher(v); resetAnalysis(); }}
            role="pitcher"
          />
        </div>
      </div>

      {/* Empty state */}
      {(!pitcher || !batter) && (
        <div className="text-center py-12 text-muted-foreground space-y-2">
          <Sparkles className="w-10 h-10 mx-auto opacity-20" />
          <p className="text-sm font-medium">Pocket Predictor</p>
          <p className="text-xs">Select any pitcher and batter to generate an AI-powered matchup analysis.</p>
        </div>
      )}

      {pitcher && batter && (
        <>
          {/* Matchup header */}
          <div className="flex items-center justify-center gap-3 py-1">
            <div className="text-right flex-1">
              <p className="font-bold text-sm truncate">{pitcher.toUpperCase()}</p>
              <p className="text-[10px] text-muted-foreground">Pitcher</p>
            </div>
            <Badge variant="outline" className="text-xs px-2 flex-shrink-0">vs</Badge>
            <div className="flex-1">
              <p className="font-bold text-sm truncate">{batter.toUpperCase()}</p>
              <p className="text-[10px] text-muted-foreground">Batter</p>
            </div>
          </div>

          {/* H2H notice */}
          {hasRealData ? (
            <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <p className="text-xs text-primary font-medium">{h2hAtBats.length} actual PA on record — analysis includes real data.</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2">
              <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0" />
              <p className="text-xs text-muted-foreground">No real matchup data — prediction based on tendencies only.</p>
            </div>
          )}

          {/* Stat profiles */}
          {pitcherProfile && (
            <>
              {pitcherProfile.repertoireOnly && (
                <div className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-2">
                  <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <p className="text-xs text-accent font-medium">No tracked history — report will be generated from saved repertoire: {pitcherProfile.pitchMix}</p>
                </div>
              )}
              {!pitcherProfile.repertoireOnly && (
                <ProfileCard title={`${pitcher.toUpperCase()} — Pitcher Profile`} items={[
                  ['Games', pitcherProfile.games],
                  ['BF', pitcherProfile.bf],
                  ['Strike%', pitcherProfile.strikePct != null ? pitcherProfile.strikePct + '%' : '—'],
                  ['Whiff%', pitcherProfile.whiffPct != null ? pitcherProfile.whiffPct + '%' : '—'],
                  ['K%', pitcherProfile.kPct != null ? pitcherProfile.kPct + '%' : '—'],
                  ['BB%', pitcherProfile.bbPct != null ? pitcherProfile.bbPct + '%' : '—'],
                  ['WHIP', pitcherProfile.whip],
                  ['Pitches', pitcherProfile.totalPitches],
                ]} />
              )}
            </>
          )}

          {hitterProfile && (
            <>
              {hitterProfile.fromImportedStats && (
                <div className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-2">
                  <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <p className="text-xs text-accent font-medium">Using imported season stats</p>
                </div>
              )}
              <ProfileCard title={`${batter.toUpperCase()} — Batter Profile`} items={[
                ['PA/AB', hitterProfile.pa],
                ['AVG', hitterProfile.avg],
                ['OBP', hitterProfile.obp],
                ['HR', hitterProfile.hrs ?? '—'],
                ['K%', hitterProfile.kPct != null ? hitterProfile.kPct + '%' : '—'],
                ['BB%', hitterProfile.bbPct != null ? hitterProfile.bbPct + '%' : '—'],
                ...(!hitterProfile.fromImportedStats ? [
                  ['GB%', hitterProfile.gbPct != null ? hitterProfile.gbPct + '%' : '—'],
                  ['FB%', hitterProfile.fbPct != null ? hitterProfile.fbPct + '%' : '—'],
                ] : [
                  ['RBI', hitterProfile.hits ?? '—'],
                  ['Hand', hitterProfile.hand],
                ]),
                ['HR/10PA', hitterProfile.hrPer10],
              ]} />
            </>
          )}

          {/* Generate button */}
          {!analysis && (
            <div className="space-y-1.5">
              {/* Error state — shown inline instead of alert */}
              {pitcher && !pitcherProfile && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive space-y-1">
                  <p className="font-semibold">⚠ No repertoire saved for {pitcher}</p>
                  <p className="text-xs">Please add a pitch repertoire for this pitcher before generating a Pocket Predictor report.</p>
                </div>
              )}
              {batter && !hitterProfile && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive space-y-1">
                  <p className="font-semibold">⚠ No data for {batter}</p>
                  <p className="text-xs">This batter needs tracked at-bats or imported stats first.</p>
                </div>
              )}
              <Button
                type="button"
                className="w-full gap-2"
                onClick={handleGenerateAnalysis}
                disabled={loading || !batter || !pitcher || !hitterProfile}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing matchup…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate Pocket Predictor Report</>
                )}
              </Button>
            </div>
          )}

          {/* Error from generation */}
          {analysis?.error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 space-y-2">
              <p className="text-sm text-destructive font-semibold">⚠ {analysis.error}</p>
              <Button type="button" variant="outline" size="sm" className="w-full text-xs border-destructive/40 text-destructive"
                onClick={() => setAnalysis(null)}>
                Try Again
              </Button>
            </div>
          )}

          {/* AI Analysis results */}
          {analysis && !analysis.error && (
            <div className="space-y-3">
              {/* Edge assessment */}
              <Card>
                <CardHeader className="pb-1 pt-3">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-accent" /> Matchup Edge
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{analysis.edge_assessment}</p>
                </CardContent>
              </Card>

              {/* Predicted outcome probabilities */}
              <Card>
                <CardHeader className="pb-1 pt-3">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Predicted Outcome</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  {[
                    ['Hit', analysis.predicted_hit_pct, 'text-primary'],
                    ['Walk', analysis.predicted_walk_pct, 'text-blue-500'],
                    ['Strikeout', analysis.predicted_strikeout_pct, 'text-destructive'],
                    ['Other Out', analysis.predicted_other_out_pct, ''],
                  ].map(([label, val, color]) => (
                    <div key={label} className="bg-muted/40 rounded-xl p-3">
                      <p className={`text-lg font-bold ${color}`}>{val != null ? Math.round(val) + '%' : '—'}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      {val != null && (
                        <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-current rounded-full opacity-50" style={{ width: `${Math.min(val, 100)}%` }} />
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Key factor + pitch sequence */}
              <div className="grid grid-cols-1 gap-3">
                <Card>
                  <CardHeader className="pb-1 pt-3">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Factor</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{analysis.key_factor}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pitch Sequence Recommendation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{analysis.pitch_sequence}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Re-generate */}
              <Button type="button" variant="outline" className="w-full gap-2 text-xs" onClick={handleGenerateAnalysis}>
                <Sparkles className="w-3.5 h-3.5" /> Re-generate Pocket Predictor
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}