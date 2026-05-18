import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, ChevronRight, ChevronDown, Shield, AlertTriangle, User } from 'lucide-react';
import { createPageUrl } from '@/utils';
import BatterWeaknessFlags, { computeWeaknessFlags } from '@/components/scouting/BatterWeaknessFlags';
import BatterPitchSplits from '@/components/scouting/BatterPitchSplits';
import BatterSprayMini from '@/components/scouting/BatterSprayMini';

const HIT_RESULTS = ['single', 'double', 'triple', 'home_run', 'bunt_single'];
const AT_BAT_RESULTS = ['single','double','triple','home_run','bunt_single','groundout','flyout','lineout',
  'popout','strikeout_swinging','strikeout_looking','fielders_choice','double_play','triple_play',
  'error','rbi_groundout','bunt_out'];

function fmt3(n) {
  if (n == null || isNaN(n)) return '.---';
  return '.' + String(Math.round(n * 1000)).padStart(3, '0');
}

function calcQuickStats(atBats) {
  const official = atBats.filter(ab => AT_BAT_RESULTS.includes(ab.result));
  const hits = atBats.filter(ab => HIT_RESULTS.includes(ab.result));
  const ks = atBats.filter(ab => ab.result?.includes('strikeout'));
  const walks = atBats.filter(ab => ab.result === 'walk' || ab.result === 'hbp');
  const ab = official.length;
  const avg = ab > 0 ? hits.length / ab : null;
  const kPct = atBats.length > 0 ? ks.length / atBats.length : null;
  return { ab, avg, ks: ks.length, walks: walks.length, kPct };
}

// ── Per-batter card (collapsed/expanded) ────────────────────────────────────
function BatterCard({ batter, atBats, pitches }) {
  const [expanded, setExpanded] = useState(false);

  const stats = useMemo(() => calcQuickStats(atBats), [atBats]);
  const flags = useMemo(() => computeWeaknessFlags(pitches, atBats), [pitches, atBats]);

  const highFlags = flags.filter(f => f.severity === 'high').length;
  const medFlags = flags.filter(f => f.severity === 'medium').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header row — always visible */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{batter.toUpperCase()}</span>
            {highFlags > 0 && (
              <Badge className="bg-destructive text-destructive-foreground text-[9px] px-1.5 h-4">
                {highFlags} HIGH
              </Badge>
            )}
            {medFlags > 0 && (
              <Badge className="bg-amber-500 text-white text-[9px] px-1.5 h-4">
                {medFlags} MED
              </Badge>
            )}
            {flags.length === 0 && stats.ab >= 5 && (
              <Badge variant="outline" className="text-[9px] px-1.5 h-4 text-green-600 border-green-400">
                No flags
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-muted-foreground">{stats.ab} AB</span>
            <span className="text-xs font-medium">{fmt3(stats.avg)} AVG</span>
            <span className="text-xs text-muted-foreground">{stats.ks}K · {stats.walks}BB</span>
          </div>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t px-4 pb-4 space-y-4 bg-card">
          {/* Weakness flags */}
          <div className="pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Scouting Flags
            </p>
            <BatterWeaknessFlags flags={flags} />
          </div>

          {/* Spray chart */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Spray Chart
            </p>
            <BatterSprayMini atBats={atBats} />
          </div>

          {/* Pitch-type splits */}
          {pitches.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Pitch-Type Splits
              </p>
              <BatterPitchSplits pitches={pitches} atBats={atBats} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ScoutingDashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [flagFilter, setFlagFilter] = useState('all'); // 'all' | 'flagged' | 'clean'

  const { data: atBats = [], isLoading: loadingABs } = useQuery({
    queryKey: ['scouting-atBats'],
    queryFn: () => base44.entities.AtBat.list('-created_date', 3000),
  });

  const { data: pitches = [], isLoading: loadingPitches } = useQuery({
    queryKey: ['scouting-pitches'],
    queryFn: () => base44.entities.Pitch.list('-created_date', 3000),
  });

  const isLoading = loadingABs || loadingPitches;

  // Build unique batter list from atBat records (exclude ADVANCEMENT)
  const batterData = useMemo(() => {
    const batting = atBats.filter(ab =>
      ab.player_id !== 'ADVANCEMENT' && ab.player_name !== 'ADVANCEMENT' && ab.player_name
    );

    // Group by player_name (normalised uppercase)
    const map = {};
    batting.forEach(ab => {
      const key = (ab.player_name || '').trim().toUpperCase();
      if (!key) return;
      if (!map[key]) map[key] = { name: key, player_id: ab.player_id, atBats: [] };
      map[key].atBats.push(ab);
    });

    // For each batter, find pitches by cross-referencing at_bat_id linkage only
    // (player_name on Pitch records refers to the BATTER, so this is correct)
    return Object.values(map).map(b => {
      const abIds = new Set(b.atBats.map(ab => ab.id));
      const batterPitches = pitches.filter(p => abIds.has(p.at_bat_id));
      const flags = computeWeaknessFlags(batterPitches, b.atBats);
      return { ...b, pitches: batterPitches, flags, totalABs: b.atBats.filter(ab => AT_BAT_RESULTS.includes(ab.result)).length };
    }).filter(b => b.totalABs > 0)
      .sort((a, b) => b.totalABs - a.totalABs);
  }, [atBats, pitches]);

  const filtered = useMemo(() => {
    let list = batterData;
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      list = list.filter(b => b.name.includes(q));
    }
    if (flagFilter === 'flagged') list = list.filter(b => b.flags.length > 0);
    if (flagFilter === 'clean') list = list.filter(b => b.flags.length === 0);
    return list;
  }, [batterData, search, flagFilter]);

  const totalFlagged = batterData.filter(b => b.flags.some(f => f.severity === 'high')).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-4 pt-safe sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost" size="icon"
            className="text-primary-foreground hover:bg-white/10"
            onClick={() => navigate(createPageUrl('Home'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 opacity-80" />
              <h1 className="text-lg font-bold">Scouting Dashboard</h1>
            </div>
            <p className="text-xs opacity-75">Batter weaknesses &amp; spray charts</p>
          </div>
          {totalFlagged > 0 && (
            <Badge className="bg-destructive text-destructive-foreground text-xs">
              {totalFlagged} flagged
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Summary strip */}
        {!isLoading && batterData.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card rounded-xl border p-3 text-center">
              <p className="text-xl font-bold text-primary">{batterData.length}</p>
              <p className="text-xs text-muted-foreground">Batters Scouted</p>
            </div>
            <div className="bg-card rounded-xl border p-3 text-center">
              <p className="text-xl font-bold text-destructive">{batterData.filter(b => b.flags.some(f => f.severity === 'high')).length}</p>
              <p className="text-xs text-muted-foreground">High-Risk</p>
            </div>
            <div className="bg-card rounded-xl border p-3 text-center">
              <p className="text-xl font-bold text-amber-600">{batterData.reduce((s, b) => s + b.flags.length, 0)}</p>
              <p className="text-xs text-muted-foreground">Total Flags</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search batter..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {[['all','All'],['flagged','Flagged'],['clean','Clean']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFlagFilter(val)}
                className={`px-3 py-1.5 font-medium transition-colors ${flagFilter === val ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : batterData.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Shield className="w-12 h-12 mx-auto opacity-20" />
              <p className="font-medium text-muted-foreground">No batter data yet</p>
              <p className="text-sm text-muted-foreground/60">
                Record at-bats in a game to populate scouting reports.
              </p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-10">No batters match your filter.</p>
        ) : (
          <div className="space-y-2 pb-8">
            {filtered.map(b => (
              <BatterCard
                key={b.name}
                batter={b.name}
                atBats={b.atBats}
                pitches={b.pitches}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}