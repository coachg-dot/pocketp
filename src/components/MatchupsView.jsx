import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Swords, Sparkles, Target } from 'lucide-react';
import FieldSVG from '@/components/FieldSVG';
import FantasyMatchup from '@/components/FantasyMatchup';
import BestBetReport from '@/components/BestBetReport';
import TeamPlayerPicker from '@/components/TeamPlayerPicker';

const HIT_RESULTS  = ['single','double','triple','home_run','bunt_single'];
const OUT_RESULTS  = ['strikeout_swinging','strikeout_looking','groundout','flyout','lineout',
                      'popout','rbi_groundout','fielders_choice','error','sac_fly','sac_bunt',
                      'bunt_out','double_play','triple_play'];

const RESULT_LABEL = {
  single: '1B', double: '2B', triple: '3B', home_run: 'HR', bunt_single: '1B',
  walk: 'BB', hbp: 'HBP',
  strikeout_swinging: 'K', strikeout_looking: 'Kl',
  groundout: 'GO', flyout: 'FO', lineout: 'LO', popout: 'PO',
  rbi_groundout: 'GO', fielders_choice: 'FC', error: 'E',
  sac_fly: 'SF', sac_bunt: 'SB', bunt_out: 'BO', double_play: 'DP', triple_play: 'TP',
};

const HIT_COLORS = {
  single:   'hsl(145 63% 42%)',
  double:   'hsl(200 70% 50%)',
  triple:   'hsl(280 60% 55%)',
  home_run: 'hsl(0 84% 60%)',
  bunt_single: 'hsl(145 63% 42%)',
  out:      'hsl(35 80% 55%)',
};

function StatBox({ label, value, sub, accent }) {
  return (
    <div className={`rounded-xl p-3 text-center ${accent ? 'bg-primary/10' : 'bg-muted/50'}`}>
      <p className={`text-lg font-bold ${accent ? 'text-primary' : ''}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
      {sub && <p className="text-[9px] text-muted-foreground/60">{sub}</p>}
    </div>
  );
}

export default function MatchupsView({ pitches, atBats }) {
  const [tab, setTab] = useState('historical');
  const [pitcher, setPitcher] = useState('');
  const [batter, setBatter] = useState('');
  const [bestBetBatter, setBestBetBatter] = useState(null);
  const [bestBetMode, setBestBetMode] = useState(null);

  const BEST_BET_KEY = '__best_bet__';

  // Reset bestBet state when tab changes
  const handleTabChange = (newTab) => {
    setTab(newTab);
    setBestBetBatter(null);
    setBestBetMode(null);
  };

  // All unique batters
  const batters = useMemo(() => {
    const s = new Set();
    atBats.forEach(ab => { if (ab.player_name) s.add(ab.player_name.trim()); });
    return [...s].sort();
  }, [atBats]);

  // At-bat IDs for each batter
  const batterAtBatIds = useMemo(() => {
    if (!batter) return new Set();
    return new Set(atBats.filter(ab => ab.player_name?.trim() === batter).map(ab => ab.id));
  }, [atBats, batter]);

  // Pitchers who faced the selected batter
  const pitchers = useMemo(() => {
    if (!batter) return [];
    const s = new Set();
    pitches.forEach(p => { if (p.at_bat_id && batterAtBatIds.has(p.at_bat_id) && p.pitcher_name) s.add(p.pitcher_name.trim()); });
    return [...s].sort();
  }, [pitches, batterAtBatIds]);

  // At-bat IDs thrown by the selected pitcher
  const pitcherAtBatIds = useMemo(() => {
    if (!pitcher || pitcher === BEST_BET_KEY) return new Set();
    return new Set(
      pitches.filter(p => p.pitcher_name?.trim() === pitcher && p.at_bat_id).map(p => p.at_bat_id)
    );
  }, [pitches, pitcher]);

  // Head-to-head at-bats
  const h2hAtBats = useMemo(() => {
    if (!pitcher || pitcher === BEST_BET_KEY || !batter) return [];
    return atBats.filter(ab => pitcherAtBatIds.has(ab.id) && ab.player_name?.trim() === batter);
  }, [atBats, pitcherAtBatIds, batter, pitcher]);

  // Stats
  const stats = useMemo(() => {
    const pa   = h2hAtBats.length;
    const ab   = h2hAtBats.filter(a => !['walk','hbp','sac_fly','sac_bunt'].includes(a.result)).length;
    const hits = h2hAtBats.filter(a => HIT_RESULTS.includes(a.result)).length;
    const ks   = h2hAtBats.filter(a => a.result === 'strikeout_swinging' || a.result === 'strikeout_looking').length;
    const bbs  = h2hAtBats.filter(a => a.result === 'walk').length;
    const hrs  = h2hAtBats.filter(a => a.result === 'home_run').length;
    const avg  = ab > 0 ? (hits / ab) : null;
    const obp  = pa > 0 ? ((hits + bbs + h2hAtBats.filter(a => a.result === 'hbp').length) / pa) : null;
    const kPct = pa > 0 ? (ks / pa) * 100 : null;
    const bbPct= pa > 0 ? (bbs / pa) * 100 : null;
    return { pa, ab, hits, ks, bbs, hrs, avg, obp, kPct, bbPct };
  }, [h2hAtBats]);

  // Spray chart points
  const sprayPoints = useMemo(() =>
    h2hAtBats.filter(ab => ab.hit_location_x != null && ab.hit_location_y != null),
  [h2hAtBats]);

  // Recent at-bat log
  const recentLog = useMemo(() => [...h2hAtBats].reverse().slice(0, 12), [h2hAtBats]);

  const fmtAvg = v => v == null ? '.---' : '.' + String(Math.round(v * 1000)).padStart(3, '0');
  const fmtPct = v => v == null ? '—' : Math.round(v) + '%';

  // Show BestBetReport overlay only for historical tab Best Bet (fantasy tab handles it internally)
  const showingBestBet = tab === 'historical' && ((bestBetBatter && bestBetMode) || (pitcher === BEST_BET_KEY && batter));
  if (showingBestBet) {
    return (
      <BestBetReport
        batter={bestBetBatter || batter}
        pitches={pitches}
        atBats={atBats}
        mode={bestBetMode || 'historical'}
        onBack={() => { setBestBetBatter(null); setBestBetMode(null); setPitcher(''); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
        <button
          onClick={() => handleTabChange('historical')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${tab === 'historical' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Swords className="w-3.5 h-3.5" /> Historical
        </button>
        <button
          onClick={() => handleTabChange('fantasy')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${tab === 'fantasy' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Pocket Predictor
        </button>
      </div>

      {tab === 'fantasy' && (
        <FantasyMatchup pitches={pitches} atBats={atBats} />
      )}

      {tab === 'historical' && (
      <div className="space-y-4">
      {/* Selectors — batter first, then pitcher */}
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Batter</p>
          <TeamPlayerPicker
            label="Batter"
            names={batters}
            value={batter}
            onChange={v => { setBatter(v); setPitcher(''); }}
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Pitcher</p>
          {/* Best Bet option */}
          {batter && (
            <button
              type="button"
              onClick={() => setPitcher(BEST_BET_KEY)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border mb-1.5 text-xs font-semibold transition-colors ${pitcher === BEST_BET_KEY ? 'bg-accent/20 border-accent text-accent' : 'bg-accent/5 border-accent/30 text-accent hover:bg-accent/15'}`}
            >
              <Target className="w-3.5 h-3.5" /> Best Bet
            </button>
          )}
          <TeamPlayerPicker
            label="Pitcher"
            names={pitchers}
            value={pitcher === BEST_BET_KEY ? '' : pitcher}
            onChange={v => setPitcher(v)}
            role="pitcher"
          />
        </div>
      </div>

      {/* Empty state */}
      {(!pitcher || !batter) && (
        <div className="text-center py-14 text-muted-foreground space-y-2">
          <Swords className="w-10 h-10 mx-auto opacity-20" />
          <p className="text-sm font-medium">Select a matchup</p>
          <p className="text-xs">Choose a pitcher and batter to see their head-to-head history.</p>
        </div>
      )}

      {/* H2H content */}
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

          {h2hAtBats.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs">
              No recorded at-bats for this matchup yet.
            </div>
          ) : (
            <>
              {/* Key stats */}
              <div className="grid grid-cols-4 gap-2">
                <StatBox label="PA" value={stats.pa} />
                <StatBox label="AVG" value={fmtAvg(stats.avg)} accent />
                <StatBox label="OBP" value={fmtAvg(stats.obp)} />
                <StatBox label="HR" value={stats.hrs} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <StatBox label="H" value={stats.hits} />
                <StatBox label="K" value={stats.ks} />
                <StatBox label="K%" value={fmtPct(stats.kPct)} />
                <StatBox label="BB%" value={fmtPct(stats.bbPct)} />
              </div>

              {/* Spray chart */}
              {sprayPoints.length > 0 && (
                <Card>
                  <CardHeader className="pb-1 pt-3">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Spray Chart ({sprayPoints.length} plotted)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative w-full max-w-xs mx-auto" style={{ aspectRatio: '100/110' }}>
                      <FieldSVG showFence showPositionLabels className="w-full h-full">
                        {sprayPoints.map((ab, i) => {
                          const isHit = HIT_RESULTS.includes(ab.result);
                          const color = isHit ? (HIT_COLORS[ab.result] || HIT_COLORS.single) : HIT_COLORS.out;
                          return (
                            <g key={i}>
                              <circle cx={ab.hit_location_x} cy={ab.hit_location_y} r="3"
                                fill={color} stroke="white" strokeWidth="0.8" opacity="0.9" />
                              {!isHit && (
                                <>
                                  <line x1={ab.hit_location_x - 2} y1={ab.hit_location_y - 2}
                                        x2={ab.hit_location_x + 2} y2={ab.hit_location_y + 2}
                                        stroke="white" strokeWidth="0.8" />
                                  <line x1={ab.hit_location_x + 2} y1={ab.hit_location_y - 2}
                                        x2={ab.hit_location_x - 2} y2={ab.hit_location_y + 2}
                                        stroke="white" strokeWidth="0.8" />
                                </>
                              )}
                            </g>
                          );
                        })}
                      </FieldSVG>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {[['single','1B'],['double','2B'],['triple','3B'],['home_run','HR']].map(([r, l]) => (
                        sprayPoints.some(ab => ab.result === r) && (
                          <div key={r} className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: HIT_COLORS[r] }} />
                            <span className="text-[10px] text-muted-foreground">{l}</span>
                          </div>
                        )
                      ))}
                      {sprayPoints.some(ab => OUT_RESULTS.includes(ab.result)) && (
                        <div className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: HIT_COLORS.out }} />
                          <span className="text-[10px] text-muted-foreground">Out</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* At-bat log */}
              <Card>
                <CardHeader className="pb-1 pt-3">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    At-Bat Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {recentLog.map((ab, i) => {
                      const isHit = HIT_RESULTS.includes(ab.result);
                      const isK   = ab.result === 'strikeout_swinging' || ab.result === 'strikeout_looking';
                      const isBB  = ab.result === 'walk' || ab.result === 'hbp';
                      return (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-muted/30 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold w-8 text-center rounded px-1 py-0.5 ${
                              isHit ? 'bg-primary/15 text-primary' :
                              isK   ? 'bg-destructive/15 text-destructive' :
                              isBB  ? 'bg-blue-500/15 text-blue-600' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {RESULT_LABEL[ab.result] || ab.result}
                            </span>
                            {ab.notes && <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{ab.notes}</span>}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            {ab.balls != null && <span>{ab.balls}-{ab.strikes}</span>}
                            {ab.inning && <span>Inn {ab.inning}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
      </div>)}
    </div>
  );
}