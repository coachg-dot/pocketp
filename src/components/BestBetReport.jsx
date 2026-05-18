import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, Loader2, Sparkles, ChevronLeft, Trophy, UserX } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BestBetChart from './BestBetChart';
import { getSavedRepertoire } from '@/lib/pitcherRepertoireStore';

const PITCH_LABEL_FULL = {
  '4seam':'4-Seam FB','2seam':'2-Seam FB','fastball':'Fastball','sinker':'Sinker',
  'cutter':'Cutter','slider':'Slider','sweeper':'Sweeper','slurve':'Slurve',
  'curveball':'Curveball','knuckle_curve':'Knuckle Curve','changeup':'Changeup',
  'splitter':'Splitter','screwball':'Screwball','forkball':'Forkball',
  'knuckleball':'Knuckleball','eephus':'Eephus',
};

function getStoredRepertoire(pitcherName, teamPitchersList) {
  // 1. TeamPitcher entity (DB-persisted — most reliable, survives all sessions)
  if (teamPitchersList?.length) {
    const tp = teamPitchersList.find(p => p.name?.toUpperCase() === pitcherName?.toUpperCase());
    if (tp?.pitch_repertoire?.length) return tp.pitch_repertoire;
  }
  // 2. User-scoped localStorage store (session-persisted cache)
  const fromStore = getSavedRepertoire(pitcherName);
  if (fromStore.length > 0) return fromStore;
  // 3. Legacy unscoped localStorage fallback
  try {
    const stored = JSON.parse(localStorage.getItem('pitcher-repertoires') || '{}');
    return stored[pitcherName?.toUpperCase()] || [];
  } catch { return []; }
}

const HIT_RESULTS = ['single','double','triple','home_run','bunt_single'];
const STRIKE_P    = ['called_strike','swinging_strike','foul','in_play_out','in_play_hit'];
const SWING_P     = ['swinging_strike','foul','in_play_out','in_play_hit'];
const PITCH_LABEL = {
  '4seam':'4-Seam FB','2seam':'2-Seam FB','fastball':'Fastball','sinker':'Sinker',
  'cutter':'Cutter','slider':'Slider','sweeper':'Sweeper','slurve':'Slurve',
  'curveball':'Curveball','knuckle_curve':'Knuckle Curve','changeup':'Changeup',
  'splitter':'Splitter','knuckleball':'Knuckleball','eephus':'Eephus',
};

function pct(n, d) { return d ? Math.round((n / d) * 100) : null; }

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Returns minimum BF threshold: median BF * 0.4 (must have faced at least 40% of median pitcher's volume)
function calcMinBFThreshold(profiles) {
  if (!profiles.length) return 0;
  const bfs = profiles.map(p => p.bf).filter(n => n > 0);
  if (!bfs.length) return 0;
  return median(bfs) * 0.4;
}

function buildPitcherStats(pitcherName, allPitches, allAtBats) {
  const pp = allPitches.filter(p => p.pitcher_name?.trim() === pitcherName);
  const pitcherAtBatIds = new Set(pp.filter(p => p.at_bat_id).map(p => p.at_bat_id));
  // Include at-bats linked via pitch records OR directly stamped with pitcher_name
  const seenPaIds = new Set();
  const pa = allAtBats.filter(ab => {
    const match = pitcherAtBatIds.has(ab.id) || ab.pitcher_name?.trim() === pitcherName;
    if (!match || seenPaIds.has(ab.id)) return false;
    seenPaIds.add(ab.id);
    return true;
  });
  const total = pp.length;
  if (!total) return null;

  const strikes = pp.filter(p => STRIKE_P.includes(p.result)).length;
  const swings  = pp.filter(p => SWING_P.includes(p.result)).length;
  const whiffs  = pp.filter(p => p.result === 'swinging_strike').length;
  const bf      = pa.length;
  const ks      = pa.filter(ab => ab.result === 'strikeout_swinging' || ab.result === 'strikeout_looking').length;
  const bbs     = pa.filter(ab => ab.result === 'walk').length;
  const hbp     = pa.filter(ab => ab.result === 'hbp').length;
  const hits    = pa.filter(ab => HIT_RESULTS.includes(ab.result)).length;

  const totalOuts = pa.reduce((acc, ab) => {
    if (ab.result === 'double_play') return acc + 2;
    if (ab.result === 'triple_play') return acc + 3;
    if (['strikeout_swinging','strikeout_looking','groundout','flyout','lineout','popout',
         'rbi_groundout','fielders_choice','error','sac_fly','sac_bunt','bunt_out'].includes(ab.result)) return acc + 1;
    return acc;
  }, 0);
  const ipDec = Math.floor(totalOuts / 3) + (totalOuts % 3) / 3;

  const pitchCounts = {};
  pp.forEach(p => { if (p.pitch_type) pitchCounts[p.pitch_type] = (pitchCounts[p.pitch_type] || 0) + 1; });
  const pitchMix = Object.entries(pitchCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, cnt]) => `${PITCH_LABEL[type] || type} ${Math.round(cnt/total*100)}%`)
    .join(', ');

  return {
    name: pitcherName,
    bf,
    strikePct: pct(strikes, total),
    whiffPct: pct(whiffs, swings),
    kPct: pct(ks, bf),
    bbPct: pct(bbs, bf),
    whip: ipDec > 0 ? ((bbs + hbp + hits) / ipDec).toFixed(2) : '—',
    pitchMix,
    games: new Set(pp.map(p => p.game_id).filter(Boolean)).size,
    totalPitches: total,
  };
}

function buildHitterStats(hitterName, allAtBats) {
  const ha = allAtBats.filter(ab => ab.player_name?.trim() === hitterName);
  const pa = ha.length;
  if (!pa) return null;
  const ab   = ha.filter(a => !['walk','hbp','sac_fly','sac_bunt'].includes(a.result)).length;
  const hits = ha.filter(a => HIT_RESULTS.includes(a.result)).length;
  const ks   = ha.filter(a => a.result === 'strikeout_swinging' || a.result === 'strikeout_looking').length;
  const bbs  = ha.filter(a => a.result === 'walk').length;
  const hrs  = ha.filter(a => a.result === 'home_run').length;
  return {
    pa, ab, hits, ks, bbs, hrs,
    avg: ab > 0 ? (hits / ab) : null,
    kPct: pct(ks, pa),
    bbPct: pct(bbs, pa),
    hrPer10: pa > 0 ? (hrs / pa * 10).toFixed(1) : '—',
    hand: ha[0]?.batter_hand || '?',
  };
}

// ── Main component ─────────────────────────────────────────────────────────────
// mode: 'historical' = only pitchers who faced the batter | 'fantasy' = all pitchers
export default function BestBetReport({ batter, pitches, atBats, mode, onBack, onSelectPitcher }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(new Set());
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: teamPitchers = [] } = useQuery({
    queryKey: ['team-pitchers'],
    queryFn: () => base44.entities.TeamPitcher.list(),
  });

  const hitterStats = useMemo(() => buildHitterStats(batter, atBats), [batter, atBats]);

  // Roster names for the selected team (used to filter in fantasy mode)
  const rosterNames = useMemo(() => {
    if (!selectedTeamId) return null; // null = no filter applied
    return new Set(
      teamPitchers.filter(p => p.team_id === selectedTeamId).map(p => p.name?.trim()).filter(Boolean)
    );
  }, [teamPitchers, selectedTeamId]);

  // Pitchers eligible for this mode
  const eligiblePitchers = useMemo(() => {
    const allPitchers = [...new Set(pitches.map(p => p.pitcher_name?.trim()).filter(Boolean))];
    if (mode === 'historical') {
      // Try strict cross-reference via at_bat_id first
      const strict = allPitchers.filter(pName => {
        const ids = new Set(pitches.filter(p => p.pitcher_name?.trim() === pName && p.at_bat_id).map(p => p.at_bat_id));
        return atBats.some(ab => ids.has(ab.id) && ab.player_name?.trim() === batter);
      });
      if (strict.length > 0) return strict;
      // Fallback: include any pitcher who has at least 1 pitch recorded (allows report to still run)
      return allPitchers;
    }
    // fantasy mode: filter by selected team roster if a team is chosen
    if (rosterNames) return allPitchers.filter(n => rosterNames.has(n));
    return allPitchers;
  }, [pitches, atBats, batter, mode, rosterNames]);

  const pitcherProfiles = useMemo(() => {
    const all = eligiblePitchers
      .filter(name => !unavailable.has(name))
      .map(name => buildPitcherStats(name, pitches, atBats)).filter(Boolean);
    if (mode !== 'fantasy') return all;
    const minBF = calcMinBFThreshold(all);
    return all.filter(p => p.bf >= minBF);
  }, [eligiblePitchers, pitches, atBats, mode, unavailable]);

  const hasGeneratedRef = useRef(false);

  const markUnavailable = (pitcherName) => {
    setUnavailable(prev => new Set([...prev, pitcherName]));
    hasGeneratedRef.current = true;
  };

  // Auto-regenerate when unavailable changes and we previously had a result
  useEffect(() => {
    if (!hasGeneratedRef.current) return;
    if (pitcherProfiles.length === 0) { setResult(null); setLoading(false); return; }
    handleGenerate(pitcherProfiles);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unavailable]);

  const handleGenerate = async (profilesOverride) => {
    const profiles = profilesOverride !== undefined ? profilesOverride : pitcherProfiles;
    if (profiles.length === 0) {
      setResult({ error: 'No pitcher data available. Make sure pitchers have been tracked in games.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {

    const hAvg = hitterStats?.avg != null
      ? '.' + String(Math.round(hitterStats.avg * 1000)).padStart(3, '0')
      : '.---';

    const pitcherSummaries = profiles.map(p => {
      const h2hIds = new Set(pitches.filter(px => px.pitcher_name?.trim() === p.name && px.at_bat_id).map(px => px.at_bat_id));
      const h2h = atBats.filter(ab => h2hIds.has(ab.id) && ab.player_name?.trim() === batter);
      const h2hHits = h2h.filter(ab => HIT_RESULTS.includes(ab.result)).length;
      const h2hKs   = h2h.filter(ab => ab.result === 'strikeout_swinging' || ab.result === 'strikeout_looking').length;
      // Resolve repertoire: DB-first (TeamPitcher entity), then localStorage cache
      let rep = getStoredRepertoire(p.name, teamPitchers);
      const repStr = rep.length ? rep.map(r => PITCH_LABEL_FULL[r] || r).join(', ') : null;
      return `${p.name}: BF=${p.bf} K%=${p.kPct}% BB%=${p.bbPct}% Strike%=${p.strikePct}% Whiff%=${p.whiffPct}% WHIP=${p.whip} PitchMix=[${p.pitchMix}]${repStr ? ` Repertoire=[${repStr}]` : ''}${h2h.length > 0 ? ` H2H=${h2h.length}PA H2H-Hits=${h2hHits} H2H-Ks=${h2hKs}` : ' (no prior H2H)'}`;
    }).join('\n');

    const prompt = `You are an expert baseball analyst. A coach needs to know the TOP THREE pitchers to face a specific batter. Base your analysis ONLY on the statistical data provided below.

BATTER: ${batter}
Batter Stats: ${hitterStats ? `PA=${hitterStats.pa} AVG=${hAvg} K%=${hitterStats.kPct}% BB%=${hitterStats.bbPct}% HR/10PA=${hitterStats.hrPer10} Hand=${hitterStats.hand}` : 'No tracked at-bat data available — analyze based on pitcher profiles only.'}

MODE: ${mode === 'historical' ? 'HISTORICAL — these pitchers have all faced this batter before. Use actual H2H data heavily.' : 'FANTASY — any pitcher in the system, may or may not have faced this batter before. Analyze statistical profiles.'}

AVAILABLE PITCHERS (${profiles.length} total):
${pitcherSummaries}

IMPORTANT: Where a pitcher's Repertoire is listed, your reasoning for that pitcher MUST reference only pitches from their Repertoire. Do not suggest any pitch a pitcher does not throw.

Rank the top 3 pitchers most likely to get this batter out. For each, write a 2-3 sentence explanation grounded in the specific numbers and repertoire above. Be direct and specific — mention actual stats and pitch types they actually throw.

Return exactly 3 items in order (rank 1 = best choice).`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          picks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rank: { type: 'number' },
                pitcher_name: { type: 'string' },
                reasoning: { type: 'string' },
              },
            },
          },
        },
      },
    });

    setResult(res);
    setLoading(false);
    } catch (err) {
      console.error('BestBetReport error:', err);
      setLoading(false);
      setResult({ error: err?.message || 'Failed to generate report. Please try again.' });
    }
  };

  const rankColors = ['text-accent', 'text-primary', 'text-muted-foreground'];
  const rankLabels = ['#1 Best Bet', '#2 Second Choice', '#3 Third Option'];
  const rankBg = ['bg-accent/10 border-accent/30', 'bg-primary/10 border-primary/30', 'bg-muted/50 border-border'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <Target className="w-4 h-4 text-accent" />
          <div>
            <p className="text-sm font-bold leading-tight">Best Bet Report</p>
            <p className="text-[10px] text-muted-foreground">
              {mode === 'historical' ? 'Based on actual H2H matchups' : 'Based on full pitcher roster'}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {mode === 'historical' ? 'Historical' : 'Pocket Predictor'}
        </Badge>
      </div>

      {/* Batter info */}
      <div className="bg-muted/50 rounded-xl px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Getting out</p>
          <p className="font-bold text-base">{batter.toUpperCase()}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground space-y-0.5">
          {hitterStats ? (
            <>
              <div>AVG {hitterStats.avg != null ? '.' + String(Math.round(hitterStats.avg * 1000)).padStart(3,'0') : '.---'}</div>
              <div>K% {hitterStats.kPct ?? '—'}% · BB% {hitterStats.bbPct ?? '—'}%</div>
            </>
          ) : (
            <div className="text-[10px] italic">No tracked at-bats</div>
          )}
        </div>
      </div>

      {/* Eligibility notice */}
      {eligiblePitchers.length === 0 && (
        <div className="text-center py-10 text-muted-foreground space-y-2">
          <Target className="w-8 h-8 mx-auto opacity-20" />
          {mode === 'historical' ? (
            <>
              <p className="text-sm font-medium">No historical matchup data</p>
              <p className="text-xs">No pitchers have faced {batter} yet. Try Fantasy mode instead.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">No pitchers found</p>
              <p className="text-xs">{selectedTeamId ? 'No pitchers from this team have recorded data yet.' : 'No pitch data in the system yet.'}</p>
            </>
          )}
        </div>
      )}

      {/* Team selector (fantasy mode only) */}
      {mode === 'fantasy' && teams.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Pitching Staff (Team)</p>
          <Select
            value={selectedTeamId || '__all__'}
            onValueChange={v => {
              const val = v === '__all__' ? '' : v;
              setSelectedTeamId(val);
              setResult(null);
              hasGeneratedRef.current = false;
              setUnavailable(new Set());
            }}
          >
            <SelectTrigger className="w-full text-sm h-10">
              <SelectValue placeholder="All pitchers in system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All pitchers in system</SelectItem>
              {teams.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}{t.location ? ` (${t.location})` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTeamId && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {rosterNames?.size ?? 0} pitcher{rosterNames?.size !== 1 ? 's' : ''} on this team's roster with recorded data.
            </p>
          )}
        </div>
      )}

      {/* Error state — always visible */}
      {result?.error && (
        <div className="flex flex-col gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive">
          <div><span className="font-semibold">Error:</span> {result.error}</div>
          <Button type="button" variant="outline" size="sm" className="w-full gap-2 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => { setResult(null); }}>
            Try Again
          </Button>
        </div>
      )}

      {eligiblePitchers.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
            Analyzing <strong>{pitcherProfiles.length}</strong> pitcher{pitcherProfiles.length !== 1 ? 's' : ''}{selectedTeamId ? ` from ${teams.find(t=>t.id===selectedTeamId)?.name || 'selected team'}` : ' from the system'}.
            {mode === 'fantasy' && eligiblePitchers.length > pitcherProfiles.length && (
              <span className="block mt-0.5 text-[10px] opacity-70">
                {eligiblePitchers.length - pitcherProfiles.length} low-sample pitcher{eligiblePitchers.length - pitcherProfiles.length !== 1 ? 's' : ''} excluded via median filter.
              </span>
            )}
            {pitcherProfiles.length === 0 && eligiblePitchers.length > 0 && (
              <span className="block mt-0.5 text-[10px] text-destructive">
                All pitchers filtered out — try resetting unavailable pitchers or selecting a different team.
              </span>
            )}
          </div>

          {/* Generate button */}
          {!result && !loading && (
            <Button
              type="button"
              className="w-full gap-2"
              disabled={loading || pitcherProfiles.length === 0}
              onClick={() => {
                hasGeneratedRef.current = true;
                handleGenerate();
              }}
            >
              <Target className="w-4 h-4" /> Generate Best Bet Report
            </Button>
          )}

          {loading && (
            <Button className="w-full gap-2" disabled>
              <Loader2 className="w-4 h-4 animate-spin" /> Analyzing pitchers…
            </Button>
          )}

          {/* Unavailable pitchers notice */}
          {unavailable.size > 0 && (
            <div className="text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 flex items-center gap-2">
              <UserX className="w-3 h-3 flex-shrink-0" />
              <span>Excluded: {[...unavailable].map(n => n.toUpperCase()).join(', ')}</span>
              <button type="button" className="ml-auto text-primary underline" onClick={() => { setUnavailable(new Set()); setResult(null); hasGeneratedRef.current = false; }}>
                Reset
              </button>
            </div>
          )}

          {/* Results */}
          {result?.picks && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Top 3 Pitchers to Face {batter.toUpperCase()}
              </p>

              <BestBetChart picks={result.picks} pitcherProfiles={pitcherProfiles} />
              {result.picks.slice(0, 3).map((pick, i) => (
                <Card key={i} className={`border ${rankBg[i]}`}>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-xs flex items-center gap-2">
                          <span className={`text-base font-black ${rankColors[i]}`}>{rankLabels[i]}</span>
                        </CardTitle>
                        {onSelectPitcher ? (
                          <button
                            type="button"
                            className="font-bold text-sm text-left underline decoration-dotted underline-offset-2 hover:text-primary transition-colors"
                            onClick={() => onSelectPitcher(pick.pitcher_name)}
                          >
                            {pick.pitcher_name?.toUpperCase()}
                          </button>
                        ) : (
                          <p className="font-bold text-sm">{pick.pitcher_name?.toUpperCase()}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 flex-shrink-0 mt-0.5"
                        onClick={() => markUnavailable(pick.pitcher_name)}
                      >
                        <UserX className="w-3 h-3" /> Unavailable
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">{pick.reasoning}</p>
                  </CardContent>
                </Card>
              ))}

              <Button type="button" variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => handleGenerate()}>
                <Sparkles className="w-3.5 h-3.5" /> Re-generate
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}