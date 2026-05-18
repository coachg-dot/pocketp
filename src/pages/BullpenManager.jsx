import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Flame, TrendingDown, Ban, Minus, ArrowRightLeft, Target } from 'lucide-react';
import { getSavedRepertoire } from '@/lib/pitcherRepertoireStore';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const PITCH_ABBR = {
  '4seam': '4S',
  '2seam': '2S',
  'fastball': 'FB',
  'sinker': 'SI',
  'cutter': 'CT',
  'slider': 'SL',
  'sweeper': 'SW',
  'slurve': 'SLV',
  'curveball': 'CB',
  'knuckle_curve': 'KC',
  'changeup': 'CH',
  'splitter': 'SP',
  'screwball': 'SC',
  'forkball': 'FK',
  'knuckleball': 'KN',
  'eephus': 'EP',
};

const STATUS_CONFIG = {
  available: { label: 'Available', bg: 'bg-card border border-border', dot: 'bg-muted-foreground/40' },
  hot:       { label: 'Hot',       bg: 'bg-emerald-950/80 border border-emerald-500/60', dot: 'bg-emerald-400' },
  down:      { label: 'Down',      bg: 'bg-yellow-950/80 border border-yellow-500/60', dot: 'bg-yellow-400' },
  unavailable: { label: 'Unavail', bg: 'bg-red-950/80 border border-red-500/40', dot: 'bg-red-500' },
};

export default function BullpenManager() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get('id');

  // Load statuses from localStorage per game
  const storageKey = `bullpen-status-${gameId || 'global'}`;
  const [statuses, setStatuses] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(statuses));
  }, [statuses, storageKey]);

  // Load all teams + all team pitchers
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list('name', 200),
  });

  const { data: allTeamPitchers = [] } = useQuery({
    queryKey: ['allTeamPitchers'],
    queryFn: () => base44.entities.TeamPitcher.list('name', 500),
  });

  const { data: pitches = [] } = useQuery({
    queryKey: ['pitches', gameId],
    queryFn: () => gameId
      ? base44.entities.Pitch.filter({ game_id: gameId })
      : base44.entities.Pitch.list('-created_date', 200),
    enabled: true,
    refetchInterval: 5000,
  });

  const { data: game } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => base44.entities.Game.filter({ id: gameId }).then(r => r[0]),
    enabled: !!gameId,
  });

  // Get the active pitcher from localStorage — re-read every 5s so substitutions made in TrackGame are picked up
  const [activePitcher, setActivePitcher] = useState(() => {
    if (!gameId) return null;
    try { return JSON.parse(localStorage.getItem(`pitcher-${gameId}`) || 'null')?.name?.toUpperCase() || null; } catch { return null; }
  });
  useEffect(() => {
    if (!gameId) return;
    const interval = setInterval(() => {
      try {
        const p = JSON.parse(localStorage.getItem(`pitcher-${gameId}`) || 'null');
        setActivePitcher(p?.name?.toUpperCase() || null);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [gameId]);

  // Filter by selected team; default to the team of the active pitcher if known
  const activePitcherTeamId = useMemo(() => {
    if (!activePitcher || !allTeamPitchers.length) return null;
    const match = allTeamPitchers.find(p => p.name?.toUpperCase() === activePitcher);
    return match?.team_id || null;
  }, [activePitcher, allTeamPitchers]);

  const [selectedTeamId, setSelectedTeamId] = useState(null); // null = show ALL teams

  // Do NOT auto-filter to the active pitcher's team — show ALL by default

  // Pitchers who have actually thrown pitches in this game
  const pitchersInGame = useMemo(() => {
    return [...new Set(pitches.map(p => p.pitcher_name).filter(Boolean).map(n => n.toUpperCase()))];
  }, [pitches]);

  // Local pitch counts from TrackGame's localStorage (instant, no DB lag) — poll every 2s
  const [localPitchCounts, setLocalPitchCounts] = useState(() => {
    if (!gameId) return {};
    try {
      const raw = JSON.parse(localStorage.getItem(`localPitchCounts-${gameId}`) || '{}');
      const uppercased = {};
      Object.entries(raw).forEach(([k, v]) => { uppercased[k.toUpperCase()] = v; });
      return uppercased;
    } catch { return {}; }
  });
  useEffect(() => {
    if (!gameId) return;
    const read = () => {
      try {
        const raw = JSON.parse(localStorage.getItem(`localPitchCounts-${gameId}`) || '{}');
        const uppercased = {};
        Object.entries(raw).forEach(([k, v]) => { uppercased[k.toUpperCase()] = v; });
        setLocalPitchCounts(uppercased);
      } catch { /* ignore */ }
    };
    read();
    const interval = setInterval(read, 2000);
    return () => clearInterval(interval);
  }, [gameId]);

  // Pitch count per pitcher — use whichever is higher: localPitchCounts (instant) or DB count
  const pitchCountMap = useMemo(() => {
    const dbMap = {};
    pitches.forEach(p => {
      if (!p.pitcher_name) return;
      const name = p.pitcher_name.toUpperCase();
      dbMap[name] = (dbMap[name] || 0) + 1;
    });
    // Merge: take max of local and DB for each pitcher
    const merged = { ...dbMap };
    Object.entries(localPitchCounts).forEach(([name, count]) => {
      merged[name] = Math.max(merged[name] || 0, count);
    });
    return merged;
  }, [pitches, localPitchCounts]);

  // Filtered team pitchers based on selected team
  const teamPitchers = useMemo(() => {
    if (!selectedTeamId) return allTeamPitchers;
    return allTeamPitchers.filter(p => p.team_id === selectedTeamId);
  }, [allTeamPitchers, selectedTeamId]);

  // All pitchers = selected team pitchers + any who've thrown in this game
  const allPitcherNames = useMemo(() => {
    const names = new Set([...teamPitchers.map(p => p.name.toUpperCase()), ...pitchersInGame]);
    return [...names].sort();
  }, [teamPitchers, pitchersInGame]);

  // Auto-mark pitchers who have thrown (i.e. started or subbed in) as unavailable
  useEffect(() => {
    if (pitchersInGame.length === 0 && !activePitcher) return;
    setStatuses(prev => {
      const next = { ...prev };
      pitchersInGame.forEach(name => {
        if (!next[name] || next[name] === 'available') next[name] = 'unavailable';
      });
      if (activePitcher && (!next[activePitcher] || next[activePitcher] === 'available')) {
        next[activePitcher] = 'unavailable';
      }
      return next;
    });
  }, [pitchersInGame.join(','), activePitcher]);

  const setStatus = (name, status) => {
    const hasPitched = pitchersInGame.includes(name) || name === activePitcher;
    if (hasPitched) return;
    setStatuses(prev => ({ ...prev, [name]: status }));
  };

  const getRepertoire = (name) => {
    // 1. TeamPitcher entity (DB-persisted — most reliable)
    const player = allTeamPitchers.find(p => p.name?.toUpperCase() === name);
    if (player?.pitch_repertoire?.length) {
      return player.pitch_repertoire.map(pt => PITCH_ABBR[pt] || pt.toUpperCase()).join(' · ');
    }
    // 2. localStorage store (session-persisted cache)
    const stored = getSavedRepertoire(name);
    if (stored.length) return stored.map(pt => PITCH_ABBR[pt] || pt.toUpperCase()).join(' · ');
    // 3. Infer from live pitch data (last resort)
    const types = [...new Set(pitches.filter(p => p.pitcher_name?.toUpperCase() === name).map(p => p.pitch_type).filter(Boolean))];
    if (types.length) return types.map(t => PITCH_ABBR[t] || t.toUpperCase()).join(' · ');
    return null;
  };

  // Pitch budget (max pitches) per pitcher — stored in localStorage
  const budgetKey = `bullpen-budget-${gameId || 'global'}`;
  const [budgets, setBudgets] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(budgetKey) || '{}');
      const uppercased = {};
      Object.entries(raw).forEach(([k, v]) => { uppercased[k.toUpperCase()] = v; });
      return uppercased;
    } catch { return {}; }
  });
  useEffect(() => {
    const uppercased = {};
    Object.entries(budgets).forEach(([k, v]) => { uppercased[k.toUpperCase()] = v; });
    localStorage.setItem(budgetKey, JSON.stringify(uppercased));
  }, [budgets, budgetKey]);

  const [editingBudget, setEditingBudget] = useState(null); // pitcher name being edited
  const [budgetInput, setBudgetInput] = useState('');

  // Sub dialog state
  const [subDialogPitcher, setSubDialogPitcher] = useState(null); // pitcher name to sub in

  const handleSubIn = (pitcherName) => {
    if (!gameId) return;
    // Find this pitcher's full data from roster
    const rosterEntry = allTeamPitchers.find(p => p.name?.toUpperCase() === pitcherName);
    const hand = rosterEntry?.throws || 'R';
    const repertoire = rosterEntry?.pitch_repertoire || [];
    // Save as the active pitcher in localStorage (same key TrackGame uses)
    localStorage.setItem(`pitcher-${gameId}`, JSON.stringify({ name: pitcherName, hand, pitch_repertoire: repertoire }));
    // Mark them as active / unavailable
    setStatuses(prev => ({ ...prev, [pitcherName]: 'unavailable' }));
    setSubDialogPitcher(null);
    // Navigate back to game
    navigate(`/TrackGame?id=${gameId}`);
  };

  // Track dismissed budget warnings
  const [dismissedWarnings, setDismissedWarnings] = useState({});

  // Pitchers within 5 pitches of their budget (and not dismissed)
  const budgetWarnings = useMemo(() => {
    return allPitcherNames.filter(name => {
      const budget = budgets[name];
      if (!budget) return false;
      const count = pitchCountMap[name] || 0;
      const remaining = budget - count;
      return remaining >= 0 && remaining <= 5 && !dismissedWarnings[`${name}-${budget}-${count}`];
    });
  }, [allPitcherNames, budgets, pitchCountMap, dismissedWarnings]);

  // Sort: hot first, then available, then down, then unavailable
  const ORDER = { hot: 0, available: 1, down: 2, unavailable: 3 };
  const sortedPitchers = [...allPitcherNames].sort((a, b) => {
    const sa = ORDER[statuses[a] || 'available'];
    const sb = ORDER[statuses[b] || 'available'];
    return sa - sb;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => gameId ? navigate(`/TrackGame?id=${gameId}`) : navigate(createPageUrl('Home'))}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Bullpen Manager</p>
          {game && <p className="text-xs text-muted-foreground uppercase">vs {game.opponent} · {game.date}</p>}
          {!gameId && <p className="text-xs text-muted-foreground">No game selected</p>}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 pt-3 pb-1 flex gap-3 flex-wrap">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </div>
        ))}
        <p className="text-xs text-muted-foreground/60 ml-auto italic">Tap buttons to set status</p>
      </div>

      {/* Team filter */}
      {teams.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedTeamId(null)}
            className={cn(
              "px-3 py-1 rounded-full border text-xs font-medium transition-colors",
              selectedTeamId === null
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:border-primary/50 text-muted-foreground"
            )}
          >All</button>
          {teams.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTeamId(prev => prev === t.id ? null : t.id)}
              className={cn(
                "px-3 py-1 rounded-full border text-xs font-medium transition-colors",
                selectedTeamId === t.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:border-primary/50 text-muted-foreground"
              )}
            >{t.name.toUpperCase()}</button>
          ))}
        </div>
      )}

      {/* Sub confirmation dialog */}
      <Dialog open={!!subDialogPitcher} onOpenChange={() => setSubDialogPitcher(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Sub In Pitcher?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Sub in <span className="font-bold text-foreground">{subDialogPitcher}</span> as the active pitcher?
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setSubDialogPitcher(null)}>Cancel</Button>
            <Button className="flex-1" onClick={() => handleSubIn(subDialogPitcher)}>
              <ArrowRightLeft className="w-4 h-4 mr-1" /> Sub In
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget edit dialog */}
      <Dialog open={!!editingBudget} onOpenChange={() => setEditingBudget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Set Pitch Budget — {editingBudget}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">Max pitches allowed for this pitcher. A progress bar will show how close they are to the limit.</p>
          <Input
            type="number"
            value={budgetInput}
            onChange={e => setBudgetInput(e.target.value)}
            placeholder="e.g. 85"
            className="mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => {
              setBudgets(prev => { const n = { ...prev }; delete n[editingBudget]; return n; });
              setEditingBudget(null);
            }}>Clear</Button>
            <Button className="flex-1" onClick={() => {
              const val = parseInt(budgetInput);
              if (val > 0) setBudgets(prev => ({ ...prev, [editingBudget.toUpperCase()]: val }));
              setEditingBudget(null);
            }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget warnings */}
      {budgetWarnings.length > 0 && (
        <div className="px-4 pt-2 space-y-2">
          {budgetWarnings.map(name => {
            const budget = budgets[name];
            const count = pitchCountMap[name] || 0;
            const remaining = budget - count;
            const key = `${name}-${budget}-${count}`;
            return (
              <button
                key={key}
                onClick={() => setDismissedWarnings(prev => ({ ...prev, [key]: true }))}
                className="w-full text-left rounded-xl bg-yellow-500/20 border border-yellow-500/60 px-4 py-3 flex items-start gap-3 hover:bg-yellow-500/30 transition-colors"
              >
                <span className="text-yellow-400 text-lg leading-none mt-0.5">⚠️</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-yellow-200 uppercase">{name}</p>
                  <p className="text-xs text-yellow-300/80 mt-0.5">
                    {remaining === 0
                      ? `At pitch limit (${budget})`
                      : `${remaining} pitch${remaining !== 1 ? 'es' : ''} from limit (${count}/${budget})`}
                  </p>
                </div>
                <span className="text-yellow-400/60 text-xs mt-0.5 shrink-0">Tap to dismiss</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Pitcher Grid */}
      <div className="px-4 pt-2 pb-6 grid grid-cols-1 gap-3">
        {sortedPitchers.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No pitchers found. Add pitchers to your roster or start a game.
          </div>
        )}
        {sortedPitchers.map(name => {
          const status = statuses[name] || 'available';
          const cfg = STATUS_CONFIG[status];
          const count = pitchCountMap[name] || 0;
          const repertoire = getRepertoire(name);
          const hasPitched = pitchersInGame.includes(name) || name === activePitcher;
          const isActive = name === activePitcher;

          return (
            <div
              key={name}
              className={`w-full rounded-xl p-4 transition-all ${cfg.bg}`}
            >
              <div className="flex items-center gap-3">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm uppercase truncate">{name}</p>
                    {isActive && (
                      <span className="text-[10px] font-semibold bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  {repertoire && (
                    <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">{repertoire}</p>
                  )}
                </div>

                {/* Pitch count */}
                <div className="shrink-0 text-right">
                  {count > 0 ? (
                    <>
                      <p className="text-xl font-bold leading-none">{count}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">pitches</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">0 P</p>
                  )}
                </div>

                {/* Status buttons */}
                {!hasPitched && (
                  <div className="shrink-0 flex gap-1.5">
                    <button
                      onClick={() => setStatus(name, 'hot')}
                      className={cn(
                        "w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center",
                        status === 'hot'
                          ? "bg-emerald-500 border-emerald-400 shadow-lg shadow-emerald-500/40"
                          : "bg-emerald-950/40 border-emerald-700/40 hover:border-emerald-500"
                      )}
                    >
                      <Flame className="w-4 h-4 text-emerald-300" />
                    </button>
                    <button
                      onClick={() => setStatus(name, 'down')}
                      className={cn(
                        "w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center",
                        status === 'down'
                          ? "bg-yellow-500 border-yellow-400 shadow-lg shadow-yellow-500/40"
                          : "bg-yellow-950/40 border-yellow-700/40 hover:border-yellow-500"
                      )}
                    >
                      <TrendingDown className="w-4 h-4 text-yellow-300" />
                    </button>
                    <button
                      onClick={() => setStatus(name, 'unavailable')}
                      className={cn(
                        "w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center",
                        status === 'unavailable'
                          ? "bg-red-500 border-red-400 shadow-lg shadow-red-500/40"
                          : "bg-red-950/40 border-red-700/40 hover:border-red-500"
                      )}
                    >
                      <Ban className="w-4 h-4 text-red-300" />
                    </button>
                  </div>
                )}
                {hasPitched && (
                  <div className="shrink-0 ml-1">
                    <Ban className="w-5 h-5 text-red-400" />
                  </div>
                )}
              </div>

              {/* Pitch budget bar */}
              {(() => {
                const budget = budgets[name];
                if (!budget) return null;
                const pct = Math.min((count / budget) * 100, 100);
                const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-400' : 'bg-emerald-400';
                return (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Pitch Budget</span>
                      <span className={pct >= 90 ? 'text-red-400 font-bold' : ''}>{count}/{budget}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}

              {/* Sub In / Set Budget row */}
              {gameId && (
                <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
                  {!isActive && !hasPitched && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => setSubDialogPitcher(name)}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Sub In
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs gap-1.5"
                    onClick={() => { setEditingBudget(name); setBudgetInput(String(budgets[name] || '')); }}
                  >
                    <Target className="w-3.5 h-3.5" />
                    {budgets[name] ? `Budget: ${budgets[name]}` : 'Set Budget'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}