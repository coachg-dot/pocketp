import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Users } from 'lucide-react';
import { createPageUrl } from '@/utils';
import StatSortBar from '../components/stats/StatSortBar';
import PlayerStatCard from '../components/stats/PlayerStatCard';
import SprayChart from '../components/stats/SprayChart';
import PullToRefresh from '../components/PullToRefresh';
import ScreenshotButton from '../components/ScreenshotButton';

const HIT_RESULTS = ['single', 'double', 'triple', 'home_run', 'bunt_single'];
const AT_BAT_RESULTS = ['single', 'double', 'triple', 'home_run', 'bunt_single', 'groundout', 'flyout', 'lineout', 'popout', 'strikeout_swinging', 'strikeout_looking', 'fielders_choice', 'double_play', 'triple_play', 'error', 'rbi_groundout', 'bunt_out'];
const ON_BASE_RESULTS = ['single', 'double', 'triple', 'home_run', 'walk', 'hbp'];
const RISP_SITUATIONS = ['second', 'third', 'first_second', 'first_third', 'second_third', 'bases_loaded'];
const GROUNDBALL_RESULTS = ['groundout', 'double_play', 'rbi_groundout', 'fielders_choice'];
const FLYBALL_RESULTS = ['flyout', 'sac_fly', 'home_run'];
const HARD_CONTACT = ['double', 'triple', 'home_run', 'lineout'];
const BIP_RESULTS = ['single', 'double', 'triple', 'home_run', 'groundout', 'flyout', 'lineout', 'popout', 'double_play', 'rbi_groundout', 'fielders_choice', 'error', 'sac_fly', 'sac_bunt'];

// League average OPS for OPS+ calculation (approximation)
const LEAGUE_AVG_OPS = 0.730;

function calcPlayerStats(player, atBats) {
  const pAB = atBats;
  const officialAB = pAB.filter(ab => AT_BAT_RESULTS.includes(ab.result));
  const hits = pAB.filter(ab => HIT_RESULTS.includes(ab.result));
  const singles = pAB.filter(ab => ab.result === 'single');
  const doubles = pAB.filter(ab => ab.result === 'double');
  const triples = pAB.filter(ab => ab.result === 'triple');
  const homeRuns = pAB.filter(ab => ab.result === 'home_run');
  const walks = pAB.filter(ab => ab.result === 'walk');
  const hbp = pAB.filter(ab => ab.result === 'hbp');
  const sacFly = pAB.filter(ab => ab.result === 'sac_fly');
  const strikeouts = pAB.filter(ab => ab.result?.includes('strikeout'));
  const onBase = pAB.filter(ab => ON_BASE_RESULTS.includes(ab.result));
  const bip = pAB.filter(ab => BIP_RESULTS.includes(ab.result));
  const homers_on_bip = homeRuns.length;
  const groundballs = pAB.filter(ab => GROUNDBALL_RESULTS.includes(ab.result));
  const flyballs = pAB.filter(ab => FLYBALL_RESULTS.includes(ab.result));
  const hardContact = pAB.filter(ab => HARD_CONTACT.includes(ab.result));
  const rbis = pAB.reduce((sum, ab) => sum + (ab.rbis || 0), 0);

  // RISP at-bats
  const rispAB = pAB.filter(ab => RISP_SITUATIONS.includes(ab.runners_on_base));
  const rispHits = rispAB.filter(ab => HIT_RESULTS.includes(ab.result));

  const pa = pAB.length; // plate appearances
  const ab = officialAB.length;
  const totalBases = singles.length * 1 + doubles.length * 2 + triples.length * 3 + homeRuns.length * 4;

  const avg = ab > 0 ? hits.length / ab : null;
  const obp = (ab + walks.length + hbp.length + sacFly.length) > 0
    ? onBase.length / (ab + walks.length + hbp.length + sacFly.length)
    : null;
  const slg = ab > 0 ? totalBases / ab : null;
  const ops = obp != null && slg != null ? obp + slg : null;
  const iso = slg != null && avg != null ? slg - avg : null;
  const risp = rispAB.filter(ab2 => AT_BAT_RESULTS.includes(ab2.result)).length > 0
    ? rispHits.length / rispAB.filter(ab2 => AT_BAT_RESULTS.includes(ab2.result)).length
    : null;
  // BABIP = (H - HR) / (AB - K - HR + SF)
  const babipDenom = ab - strikeouts.length - homeRuns.length + sacFly.length;
  const babip = babipDenom > 0 ? (hits.length - homeRuns.length) / babipDenom : null;
  const ops_plus = ops != null ? (ops / LEAGUE_AVG_OPS) * 100 : null;
  const bb_pct = pa > 0 ? walks.length / pa : null;
  const k_pct = pa > 0 ? strikeouts.length / pa : null;
  const bb_k = strikeouts.length > 0 ? walks.length / strikeouts.length : null;
  const hard_contact = bip.length > 0 ? hardContact.length / bip.length : null;
  const gb_pct = bip.length > 0 ? groundballs.length / bip.length : null;
  const fb_pct = bip.length > 0 ? flyballs.length / bip.length : null;

  return {
    ...player,
    pa,
    atBats: ab,
    hits: hits.length,
    singles: singles.length,
    doubles: doubles.length,
    triples: triples.length,
    homeRuns: homeRuns.length,
    totalBases,
    rbis,
    walks: walks.length,
    strikeouts: strikeouts.length,
    avg,
    obp,
    slg,
    ops,
    iso,
    risp,
    babip,
    ops_plus,
    bb_pct,
    k_pct,
    bb_k,
    hard_contact,
    gb_pct,
    fb_pct,
  };
}

const SORT_HIGHER_BETTER = new Set(['avg','obp','slg','ops','ops_plus','iso','babip','bb_pct','bb_k','hard_contact','hits','homeRuns','rbis','walks','singles','doubles','triples','totalBases','risp','atBats','pa']);

export default function Stats() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState('avg');
  const [sortDir, setSortDir] = useState('desc');
  const teamRef = useRef(null);
  const sprayRef = useRef(null);
  const playerRef = useRef(null);

  const { data: atBats = [], isLoading, refetch: refetchAtBats } = useQuery({
    queryKey: ['allAtBats'],
    queryFn: () => base44.entities.AtBat.list('-created_date', 5000)
  });

  const { data: players = [], refetch: refetchPlayers } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('name')
  });

  const handleRefresh = async () => {
    await Promise.all([refetchAtBats(), refetchPlayers()]);
  };

  const handleSort = (key, dir) => {
    setSortKey(key);
    setSortDir(dir);
  };

  const playerStats = players
    .map(p => calcPlayerStats(p, atBats.filter(ab =>
      ab.player_id !== 'ADVANCEMENT' && ab.player_name !== 'ADVANCEMENT' &&
      (ab.player_id === p.id || ab.player_name === p.name)
    )))
    .filter(p => p.atBats > 0)
    .sort((a, b) => {
      const aVal = a[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity);
      const bVal = b[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity);
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

  const battingAtBats = atBats.filter(ab => ab.player_id !== 'ADVANCEMENT' && ab.player_name !== 'ADVANCEMENT');
  const teamHits = battingAtBats.filter(ab => HIT_RESULTS.includes(ab.result)).length;
  const teamHR = battingAtBats.filter(ab => ab.result === 'home_run').length;
  const teamBB = battingAtBats.filter(ab => ab.result === 'walk' || ab.result === 'hbp').length;
  const teamK = battingAtBats.filter(ab => ab.result?.includes('strikeout')).length;
  const teamRBI = battingAtBats.reduce((s, ab) => s + (ab.rbis || 0), 0);
  const teamABs = battingAtBats.filter(ab => AT_BAT_RESULTS.includes(ab.result)).length;
  const teamAVG = teamABs > 0 ? teamHits / teamABs : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-4 pt-safe">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/10"
            onClick={() => navigate(createPageUrl('Home'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Statistics</h1>
        </div>
      </div>

      <PullToRefresh onRefresh={handleRefresh}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Team Overview */}
        <div ref={teamRef}>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Team Overview</span>
              <span className="ml-auto text-xs text-muted-foreground">
                .{(teamAVG * 1000).toFixed(0).padStart(3, '0')} team AVG
              </span>
              <ScreenshotButton targetRef={teamRef} filename="team-overview" />
            </div>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[
                { val: teamHits, label: 'H', color: 'text-primary' },
                { val: teamHR, label: 'HR', color: 'text-accent' },
                { val: teamRBI, label: 'RBI', color: 'text-foreground' },
                { val: teamBB, label: 'BB', color: 'text-blue-500' },
                { val: teamK, label: 'K', color: 'text-destructive' },
              ].map(({ val, label, color }) => (
                <div key={label} className="bg-muted/50 rounded-lg py-2">
                  <p className={`text-xl font-bold ${color}`}>{val}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Spray Chart */}
        <div ref={sprayRef} className="relative">
          <div className="absolute top-2 right-2 z-10">
            <ScreenshotButton targetRef={sprayRef} filename="spray-chart" />
          </div>
          <SprayChart atBats={atBats} players={players} />
        </div>

        {/* Sort controls */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm">
              Player Stats
              {playerStats.length > 0 && (
                <span className="text-muted-foreground font-normal ml-1">({playerStats.length} players)</span>
              )}
            </span>
            <ScreenshotButton targetRef={playerRef} filename="player-stats" className="ml-auto" />
          </div>
          <StatSortBar sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        </div>

        {/* Player Cards */}
        <div ref={playerRef}>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : playerStats.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground">No at-bats recorded yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Record some games to see stats here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 pb-8">
            {playerStats.map((player, index) => (
              <PlayerStatCard
                key={player.id}
                player={player}
                rank={index + 1}
                sortKey={sortKey}
              />
            ))}
          </div>
        )}
        </div>
      </div>
      </PullToRefresh>
    </div>
  );

}