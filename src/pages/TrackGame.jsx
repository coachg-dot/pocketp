import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ChevronRight, ChevronLeft, UserCog, Trophy, ClipboardList, Plus, Flame } from 'lucide-react';
import { createPageUrl } from '@/utils';

import LineupManager from '../components/LineupManager';
import PitchTracker from '../components/PitchTracker';
import ResultSelector from '../components/ResultSelector';
import CountSelector from '../components/CountSelector';
import BasesTracker from '../components/BasesTracker';
import BasesRunnerMini from '../components/BasesRunnerMini';
import RunnerAdvancementDialog from '../components/RunnerAdvancementDialog';
import AdvanceRunnerDialog from '../components/AdvanceRunnerDialog';
import AtBatCard from '../components/AtBatCard';
import HitterStatsDialog from '../components/HitterStatsDialog';
import PitcherSubstitutionDialog from '../components/PitcherSubstitutionDialog';
import ScoutingReport from '../components/ScoutingReport';
import PitchAdvisor from '../components/PitchAdvisor';
import PitcherGameLog from '../components/PitcherGameLog';
import { shareStatsImage } from '../components/shareStats';
import { saveRepertoire } from '@/lib/pitcherRepertoireStore';
import { ApproachDot } from '../components/HitterApproachStep';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrentGameBatterSummary from '../components/CurrentGameBatterSummary';
import CurrentGamePitcherSummary from '../components/CurrentGamePitcherSummary';
import CaughtStealingDialog from '../components/CaughtStealingDialog';

const HIT_RESULTS = ['single', 'double', 'triple', 'home_run', 'bunt_single'];
const OUT_RESULTS = ['strikeout_swinging', 'strikeout_looking', 'groundout', 'flyout', 'lineout', 'popout', 'bunt_out', 'rbi_groundout', 'sac_fly', 'sac_bunt', 'fielders_choice', 'in_play_out'];
const DOUBLE_PLAY_RESULTS = ['double_play'];
const TRIPLE_PLAY_RESULTS = ['triple_play'];

export default function TrackGame() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Parse game ID from URL
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get('id');

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [gameId]);

  // ── Game data ──────────────────────────────────────────────
  const { data: game, isLoading: gameLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => base44.entities.Game.filter({ id: gameId }).then(r => r[0]),
    enabled: !!gameId,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('name'),
  });

  const { data: gameData = {}, refetch: refetchGameData } = useQuery({
    queryKey: ['gameData', gameId],
    queryFn: async () => {
      const [pitches, atBats] = await Promise.all([
        base44.entities.Pitch.filter({ game_id: gameId }),
        base44.entities.AtBat.filter({ game_id: gameId }),
      ]);
      return { pitches, atBats };
    },
    enabled: !!gameId,
  });
  const atBats = gameData.atBats || [];
  const pitches = gameData.pitches || [];
  const refetchAtBats = refetchGameData;
  const refetchPitches = refetchGameData;

  // All pitcher names ever used across all games (for the pitcher selector dropdown)
  const { data: allPitches = [] } = useQuery({
    queryKey: ['pitches-all-names'],
    queryFn: () => base44.entities.Pitch.list('-created_date', 2000),
  });

  // ── Local state ────────────────────────────────────────────
  const [lineup, setLineup] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`lineup-${new URLSearchParams(window.location.search).get('id')}`) || '[]'); } catch { return []; }
  });
  const [gameSubs, setGameSubs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`subs-${new URLSearchParams(window.location.search).get('id')}`) || '[]'); } catch { return []; }
  });
  const [currentBatterIndex, setCurrentBatterIndex] = useState(() => {
    try { return parseInt(localStorage.getItem(`batterIdx-${new URLSearchParams(window.location.search).get('id')}`) || '0'); } catch { return 0; }
  });
  const [inning, setInning] = useState(() => {
    try { return parseInt(localStorage.getItem(`inning-${new URLSearchParams(window.location.search).get('id')}`) || '1'); } catch { return 1; }
  });
  const [showPositions, setShowPositions] = useState(false);

  // At-bat form state
  const [selectedResult, setSelectedResult] = useState(null);
  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [hitLocation, setHitLocation] = useState(null);
  // Live base state: { first, second, third }
  const [basesState, setBasesState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`bases-${new URLSearchParams(window.location.search).get('id')}`) || 'null') || { first: false, second: false, third: false }; } catch { return { first: false, second: false, third: false }; }
  });
  // Track which pitcher is responsible for each runner on base: { first: pitcherName, second: pitcherName, third: pitcherName }
  const [runnerPitchers, setRunnerPitchers] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`runnerPitchers-${new URLSearchParams(window.location.search).get('id')}`) || 'null') || {}; } catch { return {}; }
  });
  // Track player label (jersey # or initials) per base
  const [runnerPlayers, setRunnerPlayers] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`runnerPlayers-${new URLSearchParams(window.location.search).get('id')}`) || 'null') || {}; } catch { return {}; }
  });
  // Track whether each runner is earned (false = unearned, e.g. reached via error)
  const [runnerEarned, setRunnerEarned] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`runnerEarned-${new URLSearchParams(window.location.search).get('id')}`) || 'null') || {}; } catch { return {}; }
  });
  const [advanceRunnerDialog, setAdvanceRunnerDialog] = useState(false);
  const [runnerAdvDialog, setRunnerAdvDialog] = useState(false);
  const [pendingPitchResult, setPendingPitchResult] = useState(null); // for pitch-triggered advancement
  const [atBatNotes, setAtBatNotes] = useState('');

  // Pitch tracking state (per at-bat)
  const [currentAtBatPitches, setCurrentAtBatPitches] = useState([]);
  const [atBatId, setAtBatId] = useState(() => `ab-${Date.now()}`);

  // Pitcher state (loaded from localStorage if set during game setup)
  const [pitcherName, setPitcherName] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem(`pitcher-${new URLSearchParams(window.location.search).get('id')}`) || 'null'); return p?.name || ''; } catch { return ''; }
  });
  const [pitcherHand, setPitcherHand] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem(`pitcher-${new URLSearchParams(window.location.search).get('id')}`) || 'null'); return p?.hand || 'R'; } catch { return 'R'; }
  });
  const [pitcherRepertoire, setPitcherRepertoire] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem(`pitcher-${new URLSearchParams(window.location.search).get('id')}`) || 'null'); return p?.pitch_repertoire || []; } catch { return []; }
  });
  const [showPitcherSub, setShowPitcherSub] = useState(false);
  const [showBullpenPrompt, setShowBullpenPrompt] = useState(false);

  // Manual pitch count adjustments per pitcher: { [pitcherName]: number }
  const [pitchOffsets, setPitchOffsets] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`pitchOffsets-${new URLSearchParams(window.location.search).get('id')}`) || '{}'); } catch { return {}; }
  });

  // Local committed pitch counts per pitcher — incremented immediately on each recorded pitch.
  // Loaded from localStorage so it survives page refreshes. Stays in sync with DB count.
  const [localPitchCounts, setLocalPitchCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`localPitchCounts-${new URLSearchParams(window.location.search).get('id')}`) || '{}'); } catch { return {}; }
  });

  // Hitter approach dots (loaded from localStorage, set during game setup)
  const [approaches] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`approaches-${new URLSearchParams(window.location.search).get('id')}`) || '{}'); } catch { return {}; }
  });

  // Switch hitter side prompt
  const [switchSideDialog, setSwitchSideDialog] = useState(false);
  const [pendingBatterIndex, setPendingBatterIndex] = useState(null);

  // Error fielder
  const [errorFielder, setErrorFielder] = useState('');

  // Dialog state
  const [statsPlayer, setStatsPlayer] = useState(null);
  const [scoutPlayer, setScoutPlayer] = useState(null);
  const [endGameConfirm, setEndGameConfirm] = useState(false);
  const [nextInningConfirm, setNextInningConfirm] = useState(false);
  const [caughtStealingDialog, setCaughtStealingDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('atbat');
  const [strikeoutDialog, setStrikeoutDialog] = useState(false); // triggered from pitch screen
  const [selectedLogPitcher, setSelectedLogPitcher] = useState(null);
  const [outs, setOuts] = useState(() => {
    try { return parseInt(localStorage.getItem(`outs-${new URLSearchParams(window.location.search).get('id')}`) || '0'); } catch { return 0; }
  });

  // ── Undo history refs ──────────────────────────────────────
  // pitchSnapshotHistory: [{pitchDbId, snap}] — one entry per pitch in current at-bat
  // atBatSnapshotHistory: [{atBatDbId, pitchDbIds[], snap}] — one entry per completed at-bat
  // currentAtBatPitchDbIds: DB IDs of pitches saved in the current at-bat (to delete on undo)
  // atBatStartSnap: snapshot taken at the START of the current at-bat (after previous at-bat settled)
  const pitchSnapshotHistory = useRef([]);
  const atBatSnapshotHistory = useRef([]);
  const currentAtBatPitchDbIds = useRef([]);
  const atBatStartSnap = useRef(null);
  const [undoLoading, setUndoLoading] = useState(false);

  // ── Mutations ──────────────────────────────────────────────
  const createAtBat = useMutation({
    mutationFn: (data) => base44.entities.AtBat.create(data),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['gameData', gameId] });
      const previous = queryClient.getQueryData(['gameData', gameId]);
      const optimisticId = `optimistic-ab-${Date.now()}`;
      queryClient.setQueryData(['gameData', gameId], (old) => {
        if (!old) return old;
        return { ...old, atBats: [...(old.atBats || []), { ...newData, id: optimisticId }] };
      });
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) queryClient.setQueryData(['gameData', gameId], context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameData', gameId] });
    },
  });

  const createPitch = useMutation({
    mutationFn: (data) => base44.entities.Pitch.create(data),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['gameData', gameId] });
      const previous = queryClient.getQueryData(['gameData', gameId]);
      const optimisticId = `optimistic-p-${Date.now()}`;
      queryClient.setQueryData(['gameData', gameId], (old) => {
        if (!old) return old;
        return { ...old, pitches: [...(old.pitches || []), { ...newData, id: optimisticId }] };
      });
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) queryClient.setQueryData(['gameData', gameId], context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameData', gameId] });
    },
  });

  const deleteAtBat = useMutation({
    mutationFn: (id) => base44.entities.AtBat.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gameData', gameId] }),
  });

  const updateGame = useMutation({
    mutationFn: (data) => base44.entities.Game.update(gameId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['games'] });
    },
  });

  const updatePitch = useMutation({
    mutationFn: ({ pitchId, data }) => base44.entities.Pitch.update(pitchId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameData', gameId] });
      queryClient.invalidateQueries({ queryKey: ['pitches-all-names'] });
    },
  });

  // Persist game state to localStorage
  useEffect(() => { if (gameId) localStorage.setItem(`lineup-${gameId}`, JSON.stringify(lineup)); }, [lineup, gameId]);
  useEffect(() => { if (gameId) localStorage.setItem(`inning-${gameId}`, String(inning)); }, [inning, gameId]);
  useEffect(() => { if (gameId) localStorage.setItem(`outs-${gameId}`, String(outs)); }, [outs, gameId]);
  useEffect(() => { if (gameId) localStorage.setItem(`batterIdx-${gameId}`, String(currentBatterIndex)); }, [currentBatterIndex, gameId]);
  useEffect(() => { if (gameId) localStorage.setItem(`bases-${gameId}`, JSON.stringify(basesState)); }, [basesState, gameId]);
  useEffect(() => { if (gameId) localStorage.setItem(`runnerPitchers-${gameId}`, JSON.stringify(runnerPitchers)); }, [runnerPitchers, gameId]);
  useEffect(() => { if (gameId) localStorage.setItem(`runnerPlayers-${gameId}`, JSON.stringify(runnerPlayers)); }, [runnerPlayers, gameId]);
  useEffect(() => { if (gameId) localStorage.setItem(`runnerEarned-${gameId}`, JSON.stringify(runnerEarned)); }, [runnerEarned, gameId]);
  useEffect(() => { if (gameId) localStorage.setItem(`pitchOffsets-${gameId}`, JSON.stringify(pitchOffsets)); }, [pitchOffsets, gameId]);
  useEffect(() => { if (gameId) localStorage.setItem(`localPitchCounts-${gameId}`, JSON.stringify(localPitchCounts)); }, [localPitchCounts, gameId]);
  // Persist pitcher info so it survives page refreshes
  useEffect(() => {
    if (gameId && pitcherName) {
      localStorage.setItem(`pitcher-${gameId}`, JSON.stringify({ name: pitcherName, hand: pitcherHand, pitch_repertoire: pitcherRepertoire }));
    }
  }, [pitcherName, pitcherHand, pitcherRepertoire, gameId]);

  // Track whether this is the initial DB load (used to reset stale localStorage counts)
  const initialSyncDone = useRef(false);

  // On initial data load, sync localPitchCounts from DB so they reflect the true baseline.
  // On the FIRST load, DB is always authoritative — this clears any stale localStorage values
  // that could corrupt pitch counts after a pitching change (e.g. Walsh inheriting Shah's count).
  // On subsequent re-fetches (live game), take Math.max so optimistic increments aren't lost.
  useEffect(() => {
    if (pitches.length === 0) return;
    const countsByPitcher = {};
    pitches.forEach(p => {
      if (p.pitcher_name) countsByPitcher[p.pitcher_name] = (countsByPitcher[p.pitcher_name] || 0) + 1;
    });
    if (!initialSyncDone.current) {
      // First load: DB is the ground truth — overwrite any stale localStorage values entirely
      initialSyncDone.current = true;
      console.log('[PitchCount] Initial DB sync — overwriting localPitchCounts with DB truth:', countsByPitcher);
      setLocalPitchCounts(countsByPitcher);
    } else {
      // Subsequent re-fetches: take the higher of local (optimistic) vs DB (confirmed)
      setLocalPitchCounts(prev => {
        const updated = { ...prev };
        Object.entries(countsByPitcher).forEach(([name, count]) => {
          if ((updated[name] || 0) < count) updated[name] = count;
        });
        return updated;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitches]);

  // ── Undo snapshot helpers ─────────────────────────────────
  // captureSnapshot: reads current closure state into a plain object
  // Called SYNCHRONOUSLY at the top of handlers — captures state BEFORE any mutation
  const captureSnapshot = () => ({
    currentAtBatPitches: [...currentAtBatPitches],
    balls, strikes,
    basesState: { ...basesState },
    runnerPitchers: { ...runnerPitchers },
    runnerEarned: { ...runnerEarned },
    runnerPlayers: { ...runnerPlayers },
    outs, inning,
    currentBatterIndex,
    localPitchCounts: { ...localPitchCounts },
    atBatNotes,
    errorFielder,
    hitLocation: hitLocation ? { ...hitLocation } : null,
    selectedResult,
    atBatId,
  });

  const restoreSnapshot = (snap) => {
    if (!snap) return;
    setCurrentAtBatPitches(snap.currentAtBatPitches ?? []);
    setBalls(snap.balls ?? 0);
    setStrikes(snap.strikes ?? 0);
    setBasesState(snap.basesState ?? { first: false, second: false, third: false });
    setRunnerPitchers(snap.runnerPitchers ?? {});
    setRunnerEarned(snap.runnerEarned ?? {});
    setRunnerPlayers(snap.runnerPlayers ?? {});
    setOuts(snap.outs ?? 0);
    setInning(snap.inning ?? 1);
    setCurrentBatterIndex(snap.currentBatterIndex ?? 0);
    setLocalPitchCounts(snap.localPitchCounts ?? {});
    setAtBatNotes(snap.atBatNotes ?? '');
    setErrorFielder(snap.errorFielder ?? '');
    setHitLocation(snap.hitLocation ?? null);
    setSelectedResult(snap.selectedResult ?? null);
    setAtBatId(snap.atBatId ?? `ab-${Date.now()}`);
    // Close any open dialogs so no ghost modal state remains
    setStrikeoutDialog(false);
    setRunnerAdvDialog(false);
    setPendingPitchResult(null);
    setAdvanceRunnerDialog(false);
    setNextInningConfirm(false);
  };

  // After resetAtBatForm fires (changing atBatId), capture the fresh at-bat start snapshot.
  // React 18 batches all setState calls from finalizeAtBat/resetAtBatForm, so by the time
  // this effect runs all state is settled to correct post-reset values.
  useEffect(() => {
    atBatStartSnap.current = {
      currentAtBatPitches: [],
      balls: 0, strikes: 0,
      basesState: { ...basesState },
      runnerPitchers: { ...runnerPitchers },
      runnerEarned: { ...runnerEarned },
      runnerPlayers: { ...runnerPlayers },
      outs, inning,
      currentBatterIndex,
      localPitchCounts: { ...localPitchCounts },
      atBatNotes: '',
      errorFielder: '',
      hitLocation: null,
      selectedResult: null,
      atBatId,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atBatId]);

  // ── Derived ────────────────────────────────────────────────
  const currentBatter = lineup[currentBatterIndex] || null;
  const batterAtBats = atBats.filter(ab => ab.player_id === currentBatter?.id || ab.player_name === currentBatter?.name);
  const currentAtBatPitchesForAdvisor = currentAtBatPitches;

  // Pitcher from roster if available
  const rosterPitchers = players.filter(p => p.position === 'P' || (p.pitch_repertoire && p.pitch_repertoire.length > 0));

  // Unique pitcher names from all historical pitch data
  const knownPitcherNames = useMemo(() => {
    const names = new Set(allPitches.map(p => p.pitcher_name).filter(Boolean));
    return [...names].sort();
  }, [allPitches]);

  // ── Handlers ──────────────────────────────────────────────
  const resetAtBatForm = (newBases) => {
    setSelectedResult(null);
    setBalls(0);
    setStrikes(0);
    setHitLocation(null);
    if (newBases !== undefined) setBasesState(newBases);
    setAtBatNotes('');
    setCurrentAtBatPitches([]);
    setAtBatId(`ab-${Date.now()}`);
    setErrorFielder('');
  };

  function advanceBatter() {
    if (lineup.length > 0) {
      const nextIndex = (currentBatterIndex + 1) % lineup.length;
      const nextBatter = lineup[nextIndex];
      if (nextBatter?.hand === 'S') {
        setPendingBatterIndex(nextIndex);
        setSwitchSideDialog(true);
      } else {
        setCurrentBatterIndex(nextIndex);
      }
    }
  }

  const finalizeAtBat = async (result, newBases, runsScored, extraData = {}, pitchesOverride = null) => {
    if (!currentBatter) return;
    const isHit = HIT_RESULTS.includes(result);
    // Calculate earned runs for this at-bat.
    // Rule: each run is either earned OR unearned — never both. Count each run exactly once.
    // Runners who scored = those who were on base before and are no longer on any base after.
    // The batter themselves counts only for home_run (they score) or if they were a runner
    // that was forced home. We use the same runner-disappearance logic as the run counter.
    let earnedRunsForThisAB = 0;
    if (runsScored > 0) {
      const batterIsEarned = result !== 'error';
      if (result === 'home_run') {
        // Batter scores — always earned
        earnedRunsForThisAB += 1;
        // Any base runners who also scored (cleared from bases by the HR)
        const scoredBaseRunners = ['first', 'second', 'third'].filter(
          base => basesState[base] && !newBases[base]
        );
        for (const base of scoredBaseRunners) {
          const earned = runnerEarned[base] ?? true;
          if (earned) earnedRunsForThisAB += 1;
        }
      } else {
        // Non-HR: runners who were on base and are now gone scored
        const scoredBases = ['first', 'second', 'third'].filter(
          base => basesState[base] && !newBases[base]
        );
        for (const base of scoredBases) {
          const earned = runnerEarned[base] ?? batterIsEarned;
          if (earned) earnedRunsForThisAB += 1;
        }
        // If batter reached on error and was immediately forced home (e.g. bases loaded walk scored)
        // that case is already handled via runnerEarned above — batter is not "on base" in prev state
      }
    }

    const atBatData = {
      game_id: gameId,
      player_id: currentBatter.id || currentBatter.name,
      player_name: currentBatter.name,
      jersey_number: currentBatter.jerseyNumber || '',
      pitcher_name: pitcherName || '',
      inning,
      lineup_position: currentBatterIndex + 1,
      result,
      balls,
      strikes,
      is_pinch_hitter: !!currentBatter.isPinchHitter,
      rbis: runsScored,
      earned_runs: earnedRunsForThisAB,
      runners_on_base: basesToString(basesState),
      notes: atBatNotes,
      ...((isHit || result === 'flyout' || result === 'popout') && hitLocation ? { hit_location_x: hitLocation.x, hit_location_y: hitLocation.y } : {}),
      ...(result === 'error' && errorFielder ? { error_fielder: errorFielder } : {}),
      ...extraData,
    };

    const newAtBat = await createAtBat.mutateAsync(atBatData);

    // Record completed at-bat in undo history (snapshot = state before this at-bat started)
    atBatSnapshotHistory.current.push({
      atBatDbId: newAtBat.id,
      pitchDbIds: [...currentAtBatPitchDbIds.current],
      snap: atBatStartSnap.current,
    });
    // Reset per-at-bat tracking (pitch undo history merges into atBat-level undo)
    currentAtBatPitchDbIds.current = [];
    pitchSnapshotHistory.current = [];

    // Pitches are already saved in handleAddPitch, so don't save them again
    // Just update the at_bat_id and at_bat_result for the pitches that were already created
    const savedPitchesToUpdate = (pitchesOverride ?? currentAtBatPitches);
    if (savedPitchesToUpdate.length > 0 && newAtBat?.id) {
      // Find and update the pitches created during this at-bat to link them to the final at_bat record
      const allGamePitches = pitches.filter(p => p.game_id === gameId);
      const recentPitches = allGamePitches.slice(-savedPitchesToUpdate.length);
      for (const p of recentPitches) {
        if (!p.at_bat_result) {
          updatePitch.mutate({ pitchId: p.id, data: { at_bat_id: newAtBat.id, at_bat_result: result } });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['gameData', gameId] });
    }

    // NOTE: Earned runs are stored ONLY on the AtBat record (earned_runs field above).
    // We do NOT write ER to pitch records — that caused double-counting when both sources
    // were read and summed. AtBat.earned_runs is the single source of truth for ER.

    // Update runnerPitchers + runnerEarned for new base state
    const newRunnerPitchers = {};
    const newRunnerEarned = {};
    const batterReachesBase = ['single', 'double', 'triple', 'walk', 'hbp', 'bunt_single', 'error', 'fielders_choice'].includes(result);
    const batterIsEarned = result !== 'error'; // batter reaching on error = unearned runner

    if (newBases.first) {
      if (batterReachesBase && !basesState.first) {
        newRunnerPitchers.first = pitcherName;
        newRunnerEarned.first = batterIsEarned;
      } else if (basesState.first && newBases.first) {
        newRunnerPitchers.first = runnerPitchers.first || pitcherName;
        newRunnerEarned.first = runnerEarned.first ?? true;
      } else {
        newRunnerPitchers.first = pitcherName;
        newRunnerEarned.first = batterIsEarned;
      }
    }
    if (newBases.second) {
      if (basesState.second && newBases.second) {
        newRunnerPitchers.second = runnerPitchers.second || pitcherName;
        newRunnerEarned.second = runnerEarned.second ?? true;
      } else if (basesState.first && newBases.second && !newBases.first) {
        newRunnerPitchers.second = runnerPitchers.first || pitcherName;
        newRunnerEarned.second = runnerEarned.first ?? true;
      } else {
        newRunnerPitchers.second = pitcherName;
        newRunnerEarned.second = batterIsEarned;
      }
    }
    if (newBases.third) {
      if (basesState.third && newBases.third) {
        newRunnerPitchers.third = runnerPitchers.third || pitcherName;
        newRunnerEarned.third = runnerEarned.third ?? true;
      } else if (basesState.second && newBases.third && !newBases.second) {
        newRunnerPitchers.third = runnerPitchers.second || pitcherName;
        newRunnerEarned.third = runnerEarned.second ?? true;
      } else {
        newRunnerPitchers.third = pitcherName;
        newRunnerEarned.third = batterIsEarned;
      }
    }
    setRunnerPitchers(newRunnerPitchers);
    setRunnerEarned(newRunnerEarned);

    // Update runner player labels (jersey # or initials)
    const batterLabel = currentBatter.jerseyNumber
      ? String(currentBatter.jerseyNumber)
      : (currentBatter.name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const newRunnerPlayers = {};
    if (newBases.first) {
      if (batterReachesBase && !basesState.first) {
        // Batter just reached first
        newRunnerPlayers.first = batterLabel;
      } else if (basesState.first && newBases.first) {
        // Runner stayed on first (e.g. strikeout)
        newRunnerPlayers.first = runnerPlayers.first || batterLabel;
      } else {
        // Runner advanced to first from somewhere else
        newRunnerPlayers.first = runnerPlayers.first || batterLabel;
      }
    }
    if (newBases.second) {
      if (basesState.second && newBases.second) {
        // Runner stayed on second (e.g. strikeout)
        newRunnerPlayers.second = runnerPlayers.second || batterLabel;
      } else if (basesState.first && newBases.second && !newBases.first) {
        // Runner advanced from first to second
        newRunnerPlayers.second = runnerPlayers.first || batterLabel;
      } else if (batterReachesBase) {
        newRunnerPlayers.second = batterLabel;
      } else {
        newRunnerPlayers.second = runnerPlayers.second || batterLabel;
      }
    }
    if (newBases.third) {
      if (basesState.third && newBases.third) {
        // Runner stayed on third (e.g. strikeout)
        newRunnerPlayers.third = runnerPlayers.third || batterLabel;
      } else if (basesState.second && newBases.third && !newBases.second) {
        // Runner advanced from second to third
        newRunnerPlayers.third = runnerPlayers.second || batterLabel;
      } else if (batterReachesBase) {
        newRunnerPlayers.third = batterLabel;
      } else {
        newRunnerPlayers.third = runnerPlayers.third || batterLabel;
      }
    }
    setRunnerPlayers(newRunnerPlayers);

    const outsRecorded = TRIPLE_PLAY_RESULTS.includes(result) ? 3
      : DOUBLE_PLAY_RESULTS.includes(result) ? 2
      : OUT_RESULTS.includes(result) ? 1 : 0;
    if (outsRecorded > 0) {
      const newOuts = outs + outsRecorded;
      if (newOuts >= 3) {
        setOuts(newOuts);
        resetAtBatForm(newBases);
        setNextInningConfirm(true);
      } else {
        setOuts(newOuts);
        resetAtBatForm(newBases);
      }
    } else {
      resetAtBatForm(newBases);
    }
    advanceBatter();
  };

  const handleSubmitAtBat = async () => {
    if (!selectedResult || !currentBatter) return;

    // When submitting from the at-bat tab with no pitch sequence tracked via PitchTracker
    // AND no balls/strikes were clicked (count stayed 0-0), add 1 for the final pitch.
    // If the user already clicked balls/strikes those incremented localPitchCounts individually.
    // Only add the "last pitch" when no pitches were tracked at all (count is 0-0).
    const noPitchesTracked = currentAtBatPitches.length === 0;
    const noCountClicked = balls === 0 && strikes === 0;
    if (noPitchesTracked && noCountClicked && pitcherName) {
      setLocalPitchCounts(prev => ({
        ...prev,
        [pitcherName]: (prev[pitcherName] || 0) + 1,
      }));
    }

    const isStrikeout = selectedResult === 'strikeout_swinging' || selectedResult === 'strikeout_looking';
    const isMultiOut = DOUBLE_PLAY_RESULTS.includes(selectedResult) || TRIPLE_PLAY_RESULTS.includes(selectedResult);
    const isRegularOut = OUT_RESULTS.includes(selectedResult);

    if (isStrikeout) {
      // Strikeouts: runners stay, no dialog needed
      await finalizeAtBat(selectedResult, { ...basesState }, 0);
    } else if (isMultiOut) {
      // Double/triple play: clear bases automatically
      await finalizeAtBat(selectedResult, { first: false, second: false, third: false }, 0);
    } else if (isRegularOut) {
      // Out with runners possibly on base — show dialog to place runners after the out
      const hasRunners = basesState.first || basesState.second || basesState.third;
      if (hasRunners) {
        setPendingPitchResult({ result: selectedResult, extraData: selectedResult === 'error' && errorFielder ? { error_fielder: errorFielder } : {} });
        setRunnerAdvDialog(true);
      } else {
        await finalizeAtBat(selectedResult, { first: false, second: false, third: false }, 0);
      }
    } else {
      // Hit, walk, error, etc. — show advancement dialog
      setPendingPitchResult({ result: selectedResult, extraData: selectedResult === 'error' && errorFielder ? { error_fielder: errorFielder } : {} });
      setRunnerAdvDialog(true);
    }
  };

  const recordAtBatFromPitches = async (result, extraData = {}, pitchesOverride = null) => {
    const isStrikeout = result === 'strikeout_swinging' || result === 'strikeout_looking';
    const isMultiOut = DOUBLE_PLAY_RESULTS.includes(result) || TRIPLE_PLAY_RESULTS.includes(result);
    const isRegularOut = OUT_RESULTS.includes(result);

    if (isStrikeout) {
      // Snapshot current runner state so it's not stale in the async call
      const frozenBases = { ...basesState };
      await finalizeAtBat(result, frozenBases, 0, extraData, pitchesOverride);
    } else if (isMultiOut) {
      await finalizeAtBat(result, { first: false, second: false, third: false }, 0, extraData, pitchesOverride);
    } else if (isRegularOut) {
      // Out in play — if runners on base, ask where they ended up
      const hasRunners = basesState.first || basesState.second || basesState.third;
      if (hasRunners) {
        setPendingPitchResult({ result, extraData, pitchesOverride });
        setRunnerAdvDialog(true);
      } else {
        await finalizeAtBat(result, { first: false, second: false, third: false }, 0, extraData, pitchesOverride);
      }
    } else {
      // Hit, walk, error, HBP, etc.
      setPendingPitchResult({ result, extraData, pitchesOverride });
      setRunnerAdvDialog(true);
    }
  };

  const handleAddPitch = async (pitch) => {
    // Capture full state snapshot BEFORE any mutation — this is the restore point for undo
    const snap = captureSnapshot();

    const updatedPitches = [...currentAtBatPitches, pitch];
    const pitchNumber = updatedPitches.length;
    setCurrentAtBatPitches(updatedPitches);

    // Immediately save pitch to DB so it persists in pitch count
    const pitchData = {
      game_id: gameId,
      at_bat_id: atBatId,
      pitcher_id: pitcherName,
      pitcher_name: pitcherName,
      player_id: currentBatter?.id || currentBatter?.name,
      player_name: currentBatter?.name,
      batter_hand: currentBatter?.hand || 'R',
      inning,
      pitch_number: pitchNumber,
      pitch_type: pitch.pitch_type,
      result: pitch.result,
      ...(pitch.zone != null ? { zone: pitch.zone } : {}),
      ...(pitch.hit_location_x != null ? { hit_location_x: pitch.hit_location_x, hit_location_y: pitch.hit_location_y } : {}),
    };
    const created = await createPitch.mutateAsync(pitchData);

    // Track pitch DB ID + snapshot for undo
    if (created?.id) {
      currentAtBatPitchDbIds.current.push(created.id);
      pitchSnapshotHistory.current.push({ pitchDbId: created.id, snap });
    }

    // Immediately increment local pitch count for this pitcher
    setLocalPitchCounts(prev => ({
      ...prev,
      [pitcherName]: (prev[pitcherName] || 0) + 1,
    }));

    // Count balls and strikes from the updated pitch list
    let b = 0, s = 0;
    for (const p of updatedPitches) {
      if (p.result === 'ball' || p.result === 'hit_by_pitch') {
        b++;
      } else if (p.result === 'called_strike' || p.result === 'swinging_strike') {
        s++;
      } else if ((p.result === 'foul' || p.result === 'foul_tip') && s < 2) {
        s++;
      }
      // foul_tip with 2 strikes: stays at 2 strikes (NOT a strikeout, NOT a foul)
    }
    setBalls(Math.min(b, 4));
    setStrikes(Math.min(s, 3));

    // in-play result → auto-record at-bat immediately
    if (pitch.result === 'in_play_out') {
      recordAtBatFromPitches('groundout', pitch.hit_location_x != null ? { hit_location_x: pitch.hit_location_x, hit_location_y: pitch.hit_location_y } : {}, updatedPitches);
      return;
    }
    if (pitch.result === 'in_play_hit') {
      const hitResult = pitch.hit_type || 'single';
      recordAtBatFromPitches(hitResult, pitch.hit_location_x != null ? { hit_location_x: pitch.hit_location_x, hit_location_y: pitch.hit_location_y } : {}, updatedPitches);
      return;
    }

    // hit by pitch → auto-record HBP
    if (pitch.result === 'hit_by_pitch') {
      recordAtBatFromPitches('hbp', {}, updatedPitches);
      return;
    }

    // error (reached on error) → show runner advancement dialog
    if (pitch.result === 'error') {
      recordAtBatFromPitches('error', {}, updatedPitches);
      return;
    }

    // 3rd strike → prompt strikeout dialog (stay on pitches tab)
    if (s >= 3) {
      setStrikeoutDialog(true);
      return;
    }
    // 4th ball → auto-record walk
    if (b >= 4) {
      recordAtBatFromPitches('walk', {}, updatedPitches);
    }
  };

  const handleRemovePitch = (index) => {
    setCurrentAtBatPitches(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Recalculate count from remaining pitches
      let b = 0, s = 0;
      for (const p of updated) {
        if (p.result === 'ball' || p.result === 'hit_by_pitch') b++;
        else if (p.result === 'called_strike' || p.result === 'swinging_strike') s++;
        else if ((p.result === 'foul' || p.result === 'foul_tip') && s < 2) s++;
      }
      setBalls(Math.min(b, 4));
      setStrikes(Math.min(s, 3));
      return updated;
    });
  };

  const handlePitcherSub = ({ name, hand, pitch_repertoire }) => {
    const upperName = name.toUpperCase();
    console.log('[PitcherSub] Changing pitcher from', pitcherName, '→', upperName);

    // When making a pitching change, reset the incoming pitcher's localPitchCount to
    // exactly what the DB says they've thrown so far in this game. This prevents stale
    // localStorage values from inflating the new pitcher's count (the Shah/Walsh bug).
    const incomingDbCount = pitches.filter(p => p.pitcher_name === upperName).length;
    console.log('[PitcherSub] Incoming pitcher DB pitch count for this game:', incomingDbCount);
    setLocalPitchCounts(prev => ({
      ...prev,
      [upperName]: incomingDbCount,
    }));

    setPitcherName(upperName);
    setPitcherHand(hand);
    setPitcherRepertoire(pitch_repertoire || []);
    if (pitch_repertoire?.length > 0) saveRepertoire(upperName, pitch_repertoire);
    setShowBullpenPrompt(true);
  };

  // ── Undo handlers ─────────────────────────────────────────
  // undoLastPitch: deletes the most recent pitch DB record and restores state to before it was added.
  // Only operates on pitches within the current at-bat. Closes any open auto-triggered dialogs.
  const undoLastPitch = async () => {
    const entry = pitchSnapshotHistory.current.pop();
    if (!entry) return;
    setUndoLoading(true);
    currentAtBatPitchDbIds.current = currentAtBatPitchDbIds.current.filter(id => id !== entry.pitchDbId);
    await base44.entities.Pitch.delete(entry.pitchDbId);
    restoreSnapshot(entry.snap);
    queryClient.invalidateQueries({ queryKey: ['gameData', gameId] });
    setUndoLoading(false);
  };

  // undoLastAtBat:
  // - If current at-bat has pitches in progress: deletes all its DB pitches, restores to at-bat start.
  // - If current at-bat is fresh (no pitches): deletes the last completed AtBat record + its pitches,
  //   restores state to before that at-bat started (reverting batter advance, runs, outs, bases, etc).
  const undoLastAtBat = async () => {
    setUndoLoading(true);
    if (pitchSnapshotHistory.current.length > 0 || currentAtBatPitchDbIds.current.length > 0) {
      // Current at-bat in progress — wipe its pitches and go back to at-bat start
      const ids = [...currentAtBatPitchDbIds.current];
      currentAtBatPitchDbIds.current = [];
      pitchSnapshotHistory.current = [];
      for (const id of ids) {
        await base44.entities.Pitch.delete(id);
      }
      if (atBatStartSnap.current) {
        restoreSnapshot(atBatStartSnap.current);
      }
    } else {
      // No in-progress at-bat — undo last completed at-bat
      const entry = atBatSnapshotHistory.current.pop();
      if (!entry) { setUndoLoading(false); return; }
      await base44.entities.AtBat.delete(entry.atBatDbId);
      for (const id of entry.pitchDbIds) {
        await base44.entities.Pitch.delete(id);
      }
      if (entry.snap) {
        restoreSnapshot(entry.snap);
        // Force a new atBatId so the atBatId useEffect fires and captures the restored state
        // as the new at-bat start snapshot
        setAtBatId(`ab-${Date.now()}`);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['gameData', gameId] });
    setUndoLoading(false);
  };

  const handleCaughtStealing = (base) => {
    setCaughtStealingDialog(false);
    // Remove the runner from the base they were caught stealing at
    const newBases = { ...basesState, [base]: false };
    setBasesState(newBases);
    const newRunnerPitchers = { ...runnerPitchers };
    const newRunnerEarned = { ...runnerEarned };
    const newRunnerPlayers = { ...runnerPlayers };
    delete newRunnerPitchers[base];
    delete newRunnerEarned[base];
    delete newRunnerPlayers[base];
    setRunnerPitchers(newRunnerPitchers);
    setRunnerEarned(newRunnerEarned);
    setRunnerPlayers(newRunnerPlayers);
    // Persist updated bases to localStorage immediately
    if (gameId) localStorage.setItem(`bases-${gameId}`, JSON.stringify(newBases));
    // Add 1 out
    const newOuts = outs + 1;
    if (newOuts >= 3) {
      setOuts(newOuts);
      // Clear bases on 3-out inning — all runners are stranded
      setBasesState({ first: false, second: false, third: false });
      setRunnerPitchers({});
      setRunnerEarned({});
      setRunnerPlayers({});
      setNextInningConfirm(true);
    } else {
      setOuts(newOuts);
    }
  };

  const handleAdvanceRunnerConfirm = ({ newBases, totalRuns, earnedRunsByPitcher, unearnedRuns, newRunnerPitchers, newRunnerEarned, reason }) => {
    setAdvanceRunnerDialog(false);
    // If runs scored on this advancement, create a synthetic AtBat record so they are
    // counted by the AtBat.earned_runs single source of truth (same as all other runs).
    // This prevents ER from wild pitches/balks/passed balls being silently lost or
    // double-counted via the stale Pitch.earned_runs fallback path.
    if (totalRuns > 0 && pitcherName) {
      const totalEarned = Object.values(earnedRunsByPitcher).reduce((s, n) => s + n, 0);
      createAtBat.mutate({
        game_id: gameId,
        player_id: 'ADVANCEMENT',
        player_name: 'ADVANCEMENT',
        pitcher_name: pitcherName,
        inning,
        lineup_position: 0,
        result: 'fielders_choice', // neutral result — won't skew batting stats
        balls: 0,
        strikes: 0,
        rbis: totalRuns,
        earned_runs: totalEarned,
        runners_on_base: 'none',
        notes: reason ? `Runner advancement: ${reason}` : 'Runner advancement',
      });
    }
    setBasesState(newBases);
    setRunnerPitchers(newRunnerPitchers);
    setRunnerEarned(newRunnerEarned);
  };

  const handleIntentionalWalk = async () => {
    if (!currentBatter || !pitcherName) return;
    // Force-advance runners: only runners forced by batter taking first
    const newBases = { ...basesState };
    let runsScored = 0;
    if (newBases.first && newBases.second && newBases.third) {
      // Bases loaded → third runner scores
      runsScored = 1;
    } else if (newBases.first && newBases.second) {
      newBases.third = true;
    } else if (newBases.first) {
      newBases.second = true;
    }
    newBases.first = true;
    // +1 pitch count for the IBB (4 pitches intentionally — use 1 as representative)
    setLocalPitchCounts(prev => ({
      ...prev,
      [pitcherName]: (prev[pitcherName] || 0) + 1,
    }));
    await finalizeAtBat('walk', newBases, runsScored, { notes: 'IBB' });
  };

  const handleMarkFinal = () => {
    setEndGameConfirm(false);
    updateGame.mutate({ status: 'final' }, {
      onSuccess: () => navigate(createPageUrl('Home')),
    });
  };

  // Convert basesState to legacy string for storage
  const basesToString = (b) => {
    if (b.first && b.second && b.third) return 'bases_loaded';
    if (b.first && b.second) return 'first_second';
    if (b.first && b.third) return 'first_third';
    if (b.second && b.third) return 'second_third';
    if (b.first) return 'first';
    if (b.second) return 'second';
    if (b.third) return 'third';
    return 'none';
  };

  const pitcherObject = pitcherName
    ? { name: pitcherName, throws: pitcherHand, pitch_repertoire: pitcherRepertoire }
    : null;

  // Total pitches for current pitcher = local committed count (instant) + manual offset.
  // After the initial DB sync, localPitchCounts[pitcherName] is always the correct value:
  // - On load: set directly from DB (authoritative, clears any stale prior-session values)
  // - During play: incremented optimistically so the display updates without DB round-trip lag
  // dbPitchCount is used as a safety fallback if localPitchCounts has no entry yet.
  const dbPitchCount = pitches.filter(p => p.pitcher_name === pitcherName).length;
  const localCount = localPitchCounts[pitcherName];
  const recordedPitchCount = localCount !== undefined ? Math.max(localCount, dbPitchCount) : dbPitchCount;
  const pitcherOffset = pitchOffsets[pitcherName] || 0;
  const displayedPitchCount = recordedPitchCount + pitcherOffset;

  // Pitch budget warning — poll localStorage every 2s (same key BullpenManager writes).
  // We poll rather than useMemo so budget changes made in BullpenManager are picked up
  // without needing a pitch count change to trigger a re-read.
  const [pitcherBudget, setPitcherBudget] = useState(() => {
    if (!gameId || !pitcherName) return null;
    try {
      const b = JSON.parse(localStorage.getItem(`bullpen-budget-${gameId}`) || '{}');
      return b[pitcherName.toUpperCase()] || null;
    } catch { return null; }
  });
  useEffect(() => {
    if (!gameId || !pitcherName) { setPitcherBudget(null); return; }
    const read = () => {
      try {
        const b = JSON.parse(localStorage.getItem(`bullpen-budget-${gameId}`) || '{}');
        setPitcherBudget(b[pitcherName.toUpperCase()] || null);
      } catch { setPitcherBudget(null); }
    };
    read();
    const interval = setInterval(read, 2000);
    return () => clearInterval(interval);
  }, [gameId, pitcherName]);
  const pitchBudgetRemaining = pitcherBudget != null ? pitcherBudget - displayedPitchCount : null;
  const showBudgetWarning = pitchBudgetRemaining != null && pitchBudgetRemaining >= 0 && pitchBudgetRemaining <= 5;

  const adjustPitchCount = (delta) => {
    if (!pitcherName) return;
    setPitchOffsets(prev => {
      const current = prev[pitcherName] || 0;
      const next = current + delta;
      // Clamp so displayedPitchCount never goes below 0
      const minOffset = -recordedPitchCount;
      return { ...prev, [pitcherName]: Math.max(minOffset, next) };
    });
  };

  if (!gameId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground">No game selected.</p>
          <Button className="mt-4" onClick={() => navigate(createPageUrl('Home'))}>Go Home</Button>
        </div>
      </div>
    );
  }

  if (gameLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(createPageUrl('Home'))}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate uppercase">vs {game?.opponent}</p>
          <p className="text-xs text-muted-foreground">{game?.date ? new Date(game.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} · Inning {inning}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate(`/BullpenManager?id=${gameId}`)}
          className="text-xs h-8 gap-1 text-muted-foreground"
        >
          <Flame className="w-3.5 h-3.5" />
          Pen
        </Button>
        {game?.status === 'final' ? (
          <Badge variant="outline" className="text-green-600 border-green-500">Final</Badge>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEndGameConfirm(true)} className="text-xs h-8 gap-1">
            <Trophy className="w-3.5 h-3.5" />
            End Game
          </Button>
        )}
      </div>

      {/* Inning + Outs + Pitcher row */}
      <div className="px-4 pt-3 pb-2 space-y-2">
        {/* Row 1: Inning · Outs · Pitcher name (always visible) */}
        <div className="flex items-center gap-2">
          {/* Inning control */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-1.5 shrink-0">
            <button onClick={() => setInning(i => Math.max(1, i - 1))} className="text-muted-foreground hover:text-foreground p-0.5">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-xs w-12 text-center">Inn {inning}</span>
            <button onClick={() => setInning(i => i + 1)} className="text-muted-foreground hover:text-foreground p-0.5">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Outs counter */}
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5 shrink-0">
            <span className="text-[10px] font-medium text-muted-foreground">Outs</span>
            <div className="flex items-center gap-1">
              {[0, 1, 2].map(i => (
                <button
                  key={i}
                  onClick={() => setOuts(i < outs ? i : Math.min(i + 1, 2))}
                  className={`w-4 h-4 rounded-full border-2 transition-colors ${
                    i < outs ? 'bg-destructive border-destructive' : 'border-muted-foreground/40 bg-transparent'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Pitcher name pill — tappable to change pitcher */}
          <button
            onClick={() => setShowPitcherSub(true)}
            className="flex-1 flex items-center gap-1.5 bg-muted/50 hover:bg-muted/80 rounded-lg px-2.5 py-1.5 transition-colors text-left min-w-0"
          >
            <UserCog className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold truncate uppercase flex-1 min-w-0">
              {pitcherName || 'Set pitcher…'}
            </span>
            {pitcherName && (
              <span className="text-[10px] text-muted-foreground shrink-0">{pitcherHand}HP</span>
            )}
          </button>
        </div>

        {/* Row 2: Live PC strip — only shown when pitcher is set */}
        {pitcherName && (
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-xl px-3 py-2">
            {/* Pitch count with −/+ */}
            <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
              <button
                className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 text-base font-bold leading-none"
                onClick={() => adjustPitchCount(-1)}
              >−</button>
              <div className="flex flex-col items-center min-w-[36px]">
                <span className="text-lg font-bold leading-none tabular-nums">{displayedPitchCount}</span>
                <span className="text-[9px] text-muted-foreground leading-none uppercase tracking-wide">pitches</span>
              </div>
              <button
                className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 text-base font-bold leading-none"
                onClick={() => adjustPitchCount(1)}
              >+</button>
            </div>

            {/* Stat line */}
            <div className="flex-1 min-w-0 border-l border-border/40 pl-2">
              <CurrentGamePitcherSummary
                atBats={atBats}
                pitches={pitches}
                pitcherName={pitcherName}
                pitchCount={displayedPitchCount}
              />
            </div>

            {/* Count badge */}
            <div className="shrink-0 flex flex-col items-center bg-muted/60 rounded-lg px-2 py-1">
              <span className="text-xs font-bold tabular-nums leading-none">{balls}-{strikes}</span>
              <span className="text-[9px] text-muted-foreground leading-none mt-0.5">count</span>
            </div>
          </div>
        )}
      </div>

      {/* Pitch budget warning banner */}
      {showBudgetWarning && (
        <div className="mx-4 mb-2 px-4 py-2.5 rounded-xl bg-yellow-500/20 border border-yellow-500/60 flex items-center gap-2">
          <span className="text-yellow-400 text-base">⚠️</span>
          <p className="text-xs text-yellow-200 font-semibold">
            {pitchBudgetRemaining === 0
              ? `${pitcherName} has reached their pitch limit (${pitcherBudget})`
              : `${pitcherName} — ${pitchBudgetRemaining} pitch${pitchBudgetRemaining !== 1 ? 'es' : ''} from limit (${displayedPitchCount}/${pitcherBudget})`}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 pb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="lineup" className="flex-1 text-xs">Lineup</TabsTrigger>
            <TabsTrigger value="atbat" className="flex-1 text-xs">At-Bat</TabsTrigger>
            <TabsTrigger value="pitches" className="flex-1 text-xs">Pitches</TabsTrigger>
            <TabsTrigger value="log" className="flex-1 text-xs">Log</TabsTrigger>
          </TabsList>

          {/* ── LINEUP TAB ── */}
          <TabsContent value="lineup" className="space-y-4 mt-0">
            <LineupManager
              players={players}
              lineup={lineup}
              onLineupChange={setLineup}
              teamPool={gameSubs}
              currentBatterIndex={currentBatterIndex}
              onSubstitutionMade={() => setActiveTab('atbat')}
              onSelectBatter={(index) => {
                const batter = lineup[index];
                if (batter?.hand === 'S') {
                  setPendingBatterIndex(index);
                  setSwitchSideDialog(true);
                } else {
                  setCurrentBatterIndex(index);
                }
              }}
              showPositions={showPositions}
              onShowPositionsChange={setShowPositions}
              onScoutPlayer={(p) => setScoutPlayer(p)}
              onViewStats={(p) => setStatsPlayer(p)}
            />
            {lineup.length > 0 && (
              <Button
                className="w-full h-12 text-base font-semibold"
                onClick={() => setShowPitcherSub(true)}
              >
                {pitcherName ? `✓ ${pitcherName.toUpperCase()} — Change Pitcher` : '⚾ Set Starting Pitcher →'}
              </Button>
            )}
            {lineup.length > 0 && pitcherName && (
              <Button
                variant="outline"
                className="w-full h-12 text-base font-semibold"
                onClick={() => setActiveTab('atbat')}
              >
                ▶ Start Game →
              </Button>
            )}
          </TabsContent>

          {/* ── AT-BAT TAB ── */}
          <TabsContent value="atbat" className="space-y-4 mt-0">
            {/* Current batter */}
            {currentBatter ? (
              <Card className="border-primary/40">
                <CardContent className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      {currentBatter.jerseyNumber && (
                        <span className="text-muted-foreground font-normal mr-1">#{currentBatter.jerseyNumber}</span>
                      )}
                      {(currentBatter.name || '').toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{currentBatterIndex + 1} in order · {currentBatter.hand || 'R'}HH
                      {currentBatter.isPinchHitter && ' · PH'}
                    </p>
                    <CurrentGameBatterSummary
                      atBats={atBats}
                      batterId={currentBatter.id || currentBatter.name}
                      batterName={currentBatter.name}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ApproachDot color={approaches[currentBatter?.id || currentBatter?.name]} />
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setScoutPlayer(currentBatter)}>
                      <ClipboardList className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-sm text-muted-foreground">Add players in the Lineup tab first</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => setActiveTab('lineup')}>
                    Go to Lineup
                  </Button>
                </CardContent>
              </Card>
            )}

            {currentBatter && (
              <>
                {/* Runners on base */}
                <Card>
                  <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between gap-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Runners on Base</CardTitle>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2 gap-1 border-amber-400 text-amber-600 hover:bg-amber-50"
                        onClick={() => setAdvanceRunnerDialog(true)}
                      >
                        🏃 Advance
                      </Button>
                      {(basesState.first || basesState.second || basesState.third) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2 gap-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                          onClick={() => setCaughtStealingDialog(true)}
                        >
                          ⚡ CS
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <BasesTracker bases={basesState} onChange={setBasesState} size={130} />
                  </CardContent>
                </Card>

                {/* Count */}
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Count</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-3">
                    <CountSelector
                      balls={balls}
                      strikes={strikes}
                      onBallsChange={(newBalls) => {
                        // Increment pitch count by the number of pitches added (not when correcting down)
                        if (newBalls > balls && pitcherName) {
                          const added = newBalls - balls;
                          setLocalPitchCounts(prev => ({
                            ...prev,
                            [pitcherName]: (prev[pitcherName] || 0) + added,
                          }));
                        }
                        setBalls(newBalls);
                      }}
                      onStrikesChange={(newStrikes) => {
                        // Increment pitch count by the number of pitches added (not when correcting down)
                        if (newStrikes > strikes && pitcherName) {
                          const added = newStrikes - strikes;
                          setLocalPitchCounts(prev => ({
                            ...prev,
                            [pitcherName]: (prev[pitcherName] || 0) + added,
                          }));
                        }
                        setStrikes(newStrikes);
                      }}
                    />
                    {/* Foul Tip quick button: +1 pitch, +1 strike only if < 2 strikes */}
                    <button
                      onClick={() => {
                        // +1 pitch count
                        if (pitcherName) {
                          setLocalPitchCounts(prev => ({
                            ...prev,
                            [pitcherName]: (prev[pitcherName] || 0) + 1,
                          }));
                        }
                        // +1 strike only if fewer than 2 strikes
                        if (strikes < 2) setStrikes(s => s + 1);
                      }}
                      className="w-full h-10 rounded-lg bg-muted text-muted-foreground text-xs font-semibold border-2 border-transparent hover:border-muted-foreground/30 transition-all"
                    >
                      ⚡ Foul Tip
                    </button>
                  </CardContent>
                </Card>

                {/* Result */}
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Result</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <ResultSelector
                      selectedResult={selectedResult}
                      onResultSelect={setSelectedResult}
                      hitLocation={hitLocation}
                      onHitLocationChange={setHitLocation}
                    />
                  </CardContent>
                </Card>

                {/* Error fielder — only when error is selected */}
                {selectedResult === 'error' && (
                  <Card>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Fielder Who Committed Error</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      {lineup.length > 0 ? (
                        <Select value={errorFielder || '__none__'} onValueChange={v => setErrorFielder(v === '__none__' ? '' : v)}>
                          <SelectTrigger className="w-full h-10 text-sm">
                            <SelectValue placeholder="Select fielder (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Select fielder (optional)</SelectItem>
                            {lineup.map((p, i) => (
                              <SelectItem key={p.id} value={p.name}>{i + 1}. {p.name}{p.position ? ` (${p.position})` : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={errorFielder}
                          onChange={e => setErrorFielder(e.target.value.toUpperCase())}
                          placeholder="Fielder name (optional)"
                          className="h-10 text-sm uppercase"
                        />
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Hit/Out location is now shown inline in ResultSelector */}

                {/* Notes */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</Label>
                  <Input
                    value={atBatNotes}
                    onChange={e => setAtBatNotes(e.target.value)}
                    placeholder="e.g. hard hit, weak contact..."
                    className="text-sm"
                  />
                </div>

                {/* Submit */}
                <Button
                  className="w-full h-12 text-base font-semibold"
                  disabled={!selectedResult || createAtBat.isPending}
                  onClick={handleSubmitAtBat}
                >
                  {createAtBat.isPending ? 'Saving…' : `Record At-Bat`}
                </Button>

                {/* Intentional Walk */}
                <Button
                  variant="outline"
                  className="w-full h-10 text-sm font-semibold border-blue-400 text-blue-600 hover:bg-blue-50"
                  disabled={createAtBat.isPending || !pitcherName}
                  onClick={handleIntentionalWalk}
                >
                  🤝 Intentional Walk (IBB)
                </Button>

                {/* Undo buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-9 text-muted-foreground"
                    disabled={undoLoading}
                    onClick={undoLastPitch}
                  >
                    ↩ Undo Pitch
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-9 text-muted-foreground"
                    disabled={undoLoading}
                    onClick={undoLastAtBat}
                  >
                    ↩ Undo At-Bat
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── PITCHES TAB ── */}
          <TabsContent value="pitches" className="space-y-4 mt-0">
            {/* Compact pitcher + PC strip — always visible at top of pitch entry screen */}
            {pitcherName && (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-xl px-3 py-2">
                <button
                  onClick={() => setShowPitcherSub(true)}
                  className="flex items-center gap-1.5 min-w-0 flex-1"
                >
                  <UserCog className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-bold uppercase truncate">{pitcherName}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{pitcherHand}HP</span>
                </button>
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-base font-bold"
                    onClick={() => adjustPitchCount(-1)}
                  >−</button>
                  <div className="flex flex-col items-center min-w-[36px]">
                    <span className="text-lg font-bold leading-none tabular-nums">{displayedPitchCount}</span>
                    <span className="text-[9px] text-muted-foreground leading-none uppercase tracking-wide">pitches</span>
                  </div>
                  <button
                    className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-base font-bold"
                    onClick={() => adjustPitchCount(1)}
                  >+</button>
                </div>
                <div className="shrink-0 flex flex-col items-center bg-muted/60 rounded-lg px-2 py-1">
                  <span className="text-xs font-bold tabular-nums leading-none">{balls}-{strikes}</span>
                  <span className="text-[9px] text-muted-foreground leading-none mt-0.5">count</span>
                </div>
              </div>
            )}

            {/* Base runner mini-diamond */}
            <BasesRunnerMini bases={basesState} runnerLabels={runnerPlayers} />

            {currentBatter ? (
              <Card className="border-primary/40">
                <CardContent className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      {currentBatter.jerseyNumber && (
                        <span className="text-muted-foreground font-normal mr-1">#{currentBatter.jerseyNumber}</span>
                      )}
                      {(currentBatter.name || '').toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{currentBatterIndex + 1} in order · {currentBatter.hand || 'R'}HH
                      {currentBatter.isPinchHitter && ' · PH'}
                    </p>
                    <CurrentGameBatterSummary
                      atBats={atBats}
                      batterId={currentBatter.id || currentBatter.name}
                      batterName={currentBatter.name}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ApproachDot color={approaches[currentBatter?.id || currentBatter?.name]} />
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setScoutPlayer(currentBatter)}>
                      <ClipboardList className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-sm text-muted-foreground">Add players in the Lineup tab first</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => setActiveTab('lineup')}>
                    Go to Lineup
                  </Button>
                </CardContent>
              </Card>
            )}
            <PitchTracker
              pitches={currentAtBatPitches}
              onAddPitch={handleAddPitch}
              onRemovePitch={handleRemovePitch}
              currentBatter={currentBatter}
              repertoire={pitcherRepertoire}
              balls={balls}
              strikes={strikes}
            />
            {/* Undo buttons — always visible in pitches tab */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-9 text-muted-foreground"
                disabled={undoLoading}
                onClick={undoLastPitch}
              >
                ↩ Undo Pitch
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-9 text-muted-foreground"
                disabled={undoLoading}
                onClick={undoLastAtBat}
              >
                ↩ Undo At-Bat
              </Button>
            </div>
            {currentBatter && (
              <Button
                variant="outline"
                className="w-full h-10 text-sm font-semibold border-blue-400 text-blue-600 hover:bg-blue-50"
                disabled={createAtBat.isPending || !pitcherName}
                onClick={handleIntentionalWalk}
              >
                🤝 Intentional Walk (IBB)
              </Button>
            )}
            {pitcherObject && (
              <PitchAdvisor
                pitcher={pitcherObject}
                currentBatter={currentBatter}
                balls={balls}
                strikes={strikes}
                runners={basesToString(basesState)}
                atBatHistory={batterAtBats}
                pitchesSoFar={currentAtBatPitchesForAdvisor}
              />
            )}
          </TabsContent>

          {/* ── LOG TAB ── */}
          <TabsContent value="log" className="space-y-2 mt-0">
            {(() => {
              // Collect pitcher names from pitches AND from at-bat records directly
              const fromPitches = [...new Set(pitches.map(p => p.pitcher_name).filter(Boolean))];
              const fromABs = [...new Set(atBats.map(ab => ab.pitcher_name).filter(Boolean))];
              const pitcherNamesInGame = [...new Set([...fromPitches, ...fromABs])];

              const atBatToPitcherMap = {};
              pitches.forEach(p => {
                if (p.at_bat_id && p.pitcher_name) atBatToPitcherMap[p.at_bat_id] = p.pitcher_name;
              });

              // Helper: get all unique at-bats for a pitcher
              const getABsForPitcher = (name) => {
                const seen = new Set();
                return atBats.filter(ab => {
                  const match = atBatToPitcherMap[ab.id] === name || ab.pitcher_name === name;
                  if (!match || seen.has(ab.id)) return false;
                  seen.add(ab.id);
                  return true;
                });
              };

              const unlinkedABs = atBats.filter(ab => !atBatToPitcherMap[ab.id] && !ab.pitcher_name);

              if (pitcherNamesInGame.length === 0) {
                return <PitcherGameLog pitches={pitches} atBats={atBats} pitcherName={''} />;
              }

              if (selectedLogPitcher) {
                const logPitches = pitches.filter(p => p.pitcher_name === selectedLogPitcher);
                const logAtBats = getABsForPitcher(selectedLogPitcher);
                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => setSelectedLogPitcher(null)}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground -ml-1 p-1"
                      >
                        <ChevronLeft className="w-4 h-4" /> All Pitchers
                      </button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => shareStatsImage({ game, pitcherName: selectedLogPitcher, pitches: logPitches, atBats: logAtBats })}
                      >
                        📤 Share
                      </Button>
                    </div>
                    <PitcherGameLog
                      pitches={logPitches}
                      atBats={logAtBats}
                      pitcherName={selectedLogPitcher}
                      gameDate={game?.date}
                      gameOpponent={game?.opponent}
                      extraPitches={pitchOffsets[selectedLogPitcher] || 0}
                    />
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Select a pitcher</p>
                  {pitcherNamesInGame.map((name) => {
                    const pPitches = pitches.filter(p => p.pitcher_name === name);
                    const pABs = getABsForPitcher(name);
                    const ks = pABs.filter(a => a.result?.includes('strikeout')).length;
                    const bbs = pABs.filter(a => a.result === 'walk').length;
                    const totalOuts = pABs.reduce((acc, a) => {
                      if (a.result === 'double_play') return acc + 2;
                      if (a.result === 'triple_play') return acc + 3;
                      return OUT_RESULTS.includes(a.result) ? acc + 1 : acc;
                    }, 0);
                    const full = Math.floor(totalOuts / 3), rem = totalOuts % 3;
                    const ip = rem === 0 ? `${full}.0` : `${full}.${rem}`;
                    return (
                      <button
                        key={name}
                        onClick={() => setSelectedLogPitcher(name)}
                        className="w-full flex items-center gap-3 bg-muted/40 hover:bg-muted/70 rounded-xl p-4 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <UserCog className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{name.toUpperCase()}</p>
                          <p className="text-xs text-muted-foreground">{ip} IP · {(localPitchCounts[name] !== undefined ? Math.max(localPitchCounts[name], pPitches.length) : pPitches.length) + (pitchOffsets[name] || 0)} pitches · {ks} K · {bbs} BB</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <PitcherSubstitutionDialog
        open={showPitcherSub}
        onClose={() => setShowPitcherSub(false)}
        onConfirm={handlePitcherSub}
        rosterPitchers={rosterPitchers}
        knownPitcherNames={knownPitcherNames}
        currentPitcherName={pitcherName}
        currentPitcherHand={pitcherHand}
        currentPitcherRepertoire={pitcherRepertoire}
      />

      {statsPlayer && (
        <HitterStatsDialog
          open={!!statsPlayer}
          onClose={() => setStatsPlayer(null)}
          player={statsPlayer}
          currentGameId={gameId}
        />
      )}

      {scoutPlayer && (
        <ScoutingReport
          player={scoutPlayer}
          open={!!scoutPlayer}
          onClose={() => setScoutPlayer(null)}
          pitcherRepertoire={pitcherRepertoire}
        />
      )}

      {/* Manual runner advancement dialog (wild pitch, passed ball, etc.) */}
      <AdvanceRunnerDialog
        open={advanceRunnerDialog}
        onClose={() => setAdvanceRunnerDialog(false)}
        basesState={basesState}
        runnerPitchers={runnerPitchers}
        runnerEarned={runnerEarned}
        onConfirm={handleAdvanceRunnerConfirm}
      />

      {/* Runner advancement dialog */}
      {runnerAdvDialog && pendingPitchResult && (
        <RunnerAdvancementDialog
          open={runnerAdvDialog}
          onClose={() => setRunnerAdvDialog(false)}
          prevBases={basesState}
          batterResult={pendingPitchResult.result}
          onConfirm={async (newBases, runsScored) => {
            setRunnerAdvDialog(false);
            await finalizeAtBat(pendingPitchResult.result, newBases, runsScored, pendingPitchResult.extraData || {}, pendingPitchResult.pitchesOverride || null);
            setPendingPitchResult(null);
          }}
        />
      )}

      {/* Strikeout type prompt (triggered from pitch screen) */}
      <Dialog open={strikeoutDialog} onOpenChange={() => {}}>
        <DialogContent className="max-w-xs" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Strikeout</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">How did <span className="font-semibold text-foreground">{(currentBatter?.name || '').toUpperCase()}</span> strike out?</p>
          <div className="flex gap-3">
            <Button
              className="flex-1 h-12 text-base font-bold"
              onClick={() => { setStrikeoutDialog(false); recordAtBatFromPitches('strikeout_swinging'); }}
            >
              ⚾ Swinging
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12 text-base font-bold"
              onClick={() => { setStrikeoutDialog(false); recordAtBatFromPitches('strikeout_looking'); }}
            >
              👀 Looking
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* End Game confirmation */}
      <Dialog open={endGameConfirm} onOpenChange={setEndGameConfirm}>
        <DialogContent className="max-w-xs" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>End Game?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">Are you sure you want to mark this game as final? This cannot be undone.</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setEndGameConfirm(false)}>Cancel</Button>
            <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleMarkFinal}>
              <Trophy className="w-4 h-4 mr-1" /> End Game
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Advance to next inning prompt */}
      <Dialog open={nextInningConfirm} onOpenChange={() => {}}>
        <DialogContent className="max-w-xs" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>3 Outs — Inning Over</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">Advance to inning <span className="font-bold text-foreground">{inning + 1}</span>?</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setNextInningConfirm(false)}>Stay</Button>
            <Button className="flex-1" onClick={() => {
              setOuts(0);
              setInning(i => i + 1);
              setBasesState({ first: false, second: false, third: false });
              setRunnerPitchers({});
              setRunnerPlayers({});
              setRunnerEarned({});
              resetAtBatForm({ first: false, second: false, third: false });
              setNextInningConfirm(false);
            }}>
              Next Inning →
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bullpen Budget prompt — shown after setting a pitcher */}
      <Dialog open={showBullpenPrompt} onOpenChange={setShowBullpenPrompt}>
        <DialogContent className="max-w-xs" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Set Bullpen Availability?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Would you like to set your pen's availability before the game starts?
          </p>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full h-11"
              onClick={() => {
                setShowBullpenPrompt(false);
                navigate(`/BullpenManager?id=${gameId}`);
              }}
            >
              🔥 Set Bullpen Availability
            </Button>
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => setShowBullpenPrompt(false)}
            >
              Skip — Set During Game
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Caught Stealing */}
      <CaughtStealingDialog
        open={caughtStealingDialog}
        onClose={() => setCaughtStealingDialog(false)}
        basesState={basesState}
        onConfirm={handleCaughtStealing}
      />

      {/* Switch hitter side prompt */}
      <Dialog open={switchSideDialog} onOpenChange={() => {}}>
        <DialogContent className="max-w-xs" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Switch Hitter</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            <span className="font-semibold text-foreground">{(lineup[pendingBatterIndex]?.name || '').toUpperCase()}</span> bats both ways. Which side today?
          </p>
          <div className="flex gap-3">
            <Button
              className="flex-1 h-12 text-base font-bold"
              onClick={() => {
                const arr = [...lineup];
                arr[pendingBatterIndex] = { ...arr[pendingBatterIndex], hand: 'R' };
                setLineup(arr);
                setCurrentBatterIndex(pendingBatterIndex);
                setSwitchSideDialog(false);
                setPendingBatterIndex(null);
              }}
            >
              ✋ Right
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12 text-base font-bold"
              onClick={() => {
                const arr = [...lineup];
                arr[pendingBatterIndex] = { ...arr[pendingBatterIndex], hand: 'L' };
                setLineup(arr);
                setCurrentBatterIndex(pendingBatterIndex);
                setSwitchSideDialog(false);
                setPendingBatterIndex(null);
              }}
            >
              🤚 Left
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}