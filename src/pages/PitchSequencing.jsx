import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Target, Trash2, ChevronRight, User, AlertCircle, Edit2, Check, X, Users, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { shareStatsImage } from '../components/shareStats';
import { createPageUrl } from '@/utils';
import PitcherCareerStats from '../components/PitcherCareerStats';
import TeamManager from '../components/TeamManager';
import QuickAssignToTeam from '../components/QuickAssignToTeam';

export default function PitchSequencing() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedPitcher, setSelectedPitcher] = useState(null);
  const [deletingPitcher, setDeletingPitcher] = useState(null);
  const [editingPitcher, setEditingPitcher] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [showTeams, setShowTeams] = useState(false);
  const [assignName, setAssignName] = useState('');
  const [assignCount, setAssignCount] = useState('');

  const { data: pitches = [], isLoading: pitchesLoading } = useQuery({
    queryKey: ['pitches'],
    queryFn: () => base44.entities.Pitch.list('-created_date', 2000),
  });

  const { data: atBats = [] } = useQuery({
    queryKey: ['atBats-all'],
    queryFn: () => base44.entities.AtBat.list('-created_date', 2000),
  });

  const { data: games = [] } = useQuery({
    // Use a unique key so it doesn't collide with Home's 20-game-limited ['games'] cache
    queryKey: ['games-sequencing'],
    queryFn: () => base44.entities.Game.list('-date', 500),
  });

  // All unique pitchers sourced from pitcher_name field on pitches
  const pitchers = useMemo(() => {
    const nameMap = {};
    pitches.forEach(p => {
      if (!p.pitcher_name) return;
      const name = p.pitcher_name.trim();
      if (!nameMap[name]) nameMap[name] = 0;
      nameMap[name]++;
    });
    return Object.entries(nameMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [pitches]);

  // Pitches with no pitcher_name assigned
  const unassignedPitches = useMemo(() => pitches.filter(p => !p.pitcher_name), [pitches]);

  const assignPitcherMutation = useMutation({
    mutationFn: async ({ name, pitchesToAssign }) => {
      const normalized = name.trim().toUpperCase();
      await Promise.all(
        pitchesToAssign.map(p =>
          base44.entities.Pitch.update(p.id, { pitcher_name: normalized, pitcher_id: normalized })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pitches'] });
      queryClient.refetchQueries({ queryKey: ['pitches'] });
      setAssignName('');
      setAssignCount('');
    },
  });

  const deletePitcherMutation = useMutation({
    mutationFn: async (name) => {
      const toDelete = pitches.filter(p => p.pitcher_name === name);
      await Promise.all(toDelete.map(p => base44.entities.Pitch.delete(p.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pitches'] });
      if (selectedPitcher === deletingPitcher) setSelectedPitcher(null);
      setDeletingPitcher(null);
    },
  });

  const renamePitcherMutation = useMutation({
    mutationFn: async ({ oldName, newName }) => {
      const toRename = pitches.filter(p => p.pitcher_name === oldName);
      await Promise.all(toRename.map(p => base44.entities.Pitch.update(p.id, { pitcher_name: newName, pitcher_id: newName })));
      const abToRename = atBats.filter(ab => ab.pitcher_name === oldName);
      await Promise.all(abToRename.map(ab => base44.entities.AtBat.update(ab.id, { pitcher_name: newName })));
    },
    onSuccess: (_data, { newName }) => {
      queryClient.invalidateQueries({ queryKey: ['pitches'] });
      queryClient.invalidateQueries({ queryKey: ['atBats-all'] });
      if (selectedPitcher === editingPitcher) setSelectedPitcher(newName);
      setEditingPitcher(null);
      setEditingValue('');
    },
  });

  const handleRenameStart = (name, e) => {
    e.stopPropagation();
    setEditingPitcher(name);
    setEditingValue(name);
  };

  const handleRenameSave = (oldName, e) => {
    e.stopPropagation();
    const newName = editingValue.trim().toUpperCase();
    if (newName && newName !== oldName) {
      renamePitcherMutation.mutate({ oldName, newName });
    } else {
      setEditingPitcher(null);
    }
  };

  const handleRenameCancel = (e) => {
    e.stopPropagation();
    setEditingPitcher(null);
    setEditingValue('');
  };

  if (selectedPitcher) {
    const pitcherPitches = pitches.filter(p => p.pitcher_name === selectedPitcher);
    const pitcherAtBatIds = new Set(pitcherPitches.map(p => p.at_bat_id).filter(Boolean));
    // Include at-bats linked via pitch records OR directly stamped with pitcher_name
    const seenAbIds = new Set();
    const pitcherAtBats = atBats.filter(ab => {
      const match = pitcherAtBatIds.has(ab.id) || ab.pitcher_name === selectedPitcher;
      if (!match || seenAbIds.has(ab.id)) return false;
      seenAbIds.add(ab.id);
      return true;
    });

    return (
      <div className="min-h-screen bg-background pb-8">
        <div className="bg-primary text-primary-foreground px-4 py-3 sticky top-0 z-10">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10 -ml-2"
              onClick={() => setSelectedPitcher(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <p className="font-semibold text-sm">{selectedPitcher.toUpperCase()}</p>
              <p className="text-xs opacity-80">{pitcherPitches.length} pitches tracked</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-white/10 gap-1.5"
                onClick={() => shareStatsImage({
                    game: null,
                    pitcherName: selectedPitcher,
                    pitches: pitcherPitches,
                    atBats: pitcherAtBats,
                    label: selectedPitcher,
                  })}
              >
                <Share2 className="w-4 h-4" />
                <span className="text-xs">Share</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-white/10"
                onClick={() => setDeletingPitcher(selectedPitcher)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-4">
          <PitcherCareerStats
            pitcherName={selectedPitcher}
            allPitches={pitcherPitches}
            allAtBats={pitcherAtBats}
            games={games}
          />
        </div>

        <AlertDialog open={!!deletingPitcher} onOpenChange={(o) => !o && setDeletingPitcher(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Pitcher Data</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all pitch records for <strong>{deletingPitcher}</strong>. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deletePitcherMutation.mutate(deletingPitcher)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="bg-primary text-primary-foreground px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10 -ml-2"
            onClick={() => navigate(createPageUrl('Home'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <p className="font-semibold text-sm">Pitch Data</p>
            <p className="text-xs opacity-80">Select a pitcher to view stats</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">

        {/* Teams Section */}
        <div className="border rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors"
            onClick={() => setShowTeams(p => !p)}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Manage Teams</span>
            </div>
            {showTeams ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showTeams && (
            <div className="p-4 border-t bg-background space-y-5">
              <TeamManager />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Unassigned Players</p>
                <QuickAssignToTeam />
              </div>
            </div>
          )}
        </div>

        {/* Banner for unassigned pitches */}
        {unassignedPitches.length > 0 && (
          <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {unassignedPitches.length} pitches have no pitcher assigned
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Enter a name and optionally how many to assign (oldest first). Leave count blank to assign all.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                value={assignName}
                onChange={e => setAssignName(e.target.value.toUpperCase())}
                placeholder="PITCHER NAME"
                className="flex-1 h-9 text-sm"
              />
              <Input
                type="number"
                value={assignCount}
                onChange={e => setAssignCount(e.target.value)}
                placeholder={`ALL (${unassignedPitches.length})`}
                className="w-24 h-9 text-sm"
                min={1}
                max={unassignedPitches.length}
              />
              <Button
                size="sm"
                disabled={!assignName.trim() || assignPitcherMutation.isPending}
                onClick={() => {
                  const count = parseInt(assignCount, 10);
                  const pitchesToAssign = (!assignCount || isNaN(count) || count <= 0)
                    ? [...unassignedPitches]
                    : [...unassignedPitches].slice(0, Math.min(count, unassignedPitches.length));
                  assignPitcherMutation.mutate({ name: assignName, pitchesToAssign });
                }}
                className="shrink-0"
              >
                {assignPitcherMutation.isPending ? 'Saving…' : 'Assign'}
              </Button>
            </div>
            {assignCount && !isNaN(parseInt(assignCount)) && parseInt(assignCount) > 0 && parseInt(assignCount) < unassignedPitches.length && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Will assign {Math.min(parseInt(assignCount), unassignedPitches.length)} of {unassignedPitches.length} pitches. {unassignedPitches.length - parseInt(assignCount)} will remain unassigned.
              </p>
            )}
          </div>
        )}

        {pitchesLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : pitchers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground space-y-3">
            <Target className="w-12 h-12 mx-auto opacity-25" />
            <p className="font-medium">No pitcher data yet</p>
            <p className="text-xs max-w-[220px] mx-auto">
              Set a pitcher in the game header, then log pitches from the Pitches tab during a game.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide">
              {pitchers.length} pitcher{pitchers.length !== 1 ? 's' : ''} tracked
            </p>
            {pitchers.map(({ name, count }) => {
              const games_set = new Set(
                pitches.filter(p => p.pitcher_name === name).map(p => p.game_id).filter(Boolean)
              );
              const isEditing = editingPitcher === name;
              return (
                <div
                  key={name}
                  className="w-full border rounded-xl p-4 bg-card hover:border-primary/50 transition-colors flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value.toUpperCase())}
                          className="h-8 text-sm font-semibold"
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameSave(name, e);
                            if (e.key === 'Escape') handleRenameCancel(e);
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                        <button onClick={(e) => handleRenameSave(name, e)} className="p-1 text-green-600 shrink-0">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={handleRenameCancel} className="p-1 text-muted-foreground shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button className="font-semibold text-sm text-left" onClick={() => setSelectedPitcher(name)}>
                          {name.toUpperCase()}
                        </button>
                        <button onClick={(e) => handleRenameStart(name, e)} className="text-muted-foreground/40 hover:text-muted-foreground">
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {count} pitches · {games_set.size} game{games_set.size !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {!isEditing && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 cursor-pointer" onClick={() => setSelectedPitcher(name)} />
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      <AlertDialog open={!!deletingPitcher} onOpenChange={(o) => !o && setDeletingPitcher(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Pitcher Data</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all pitch records for <strong>{deletingPitcher}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletePitcherMutation.mutate(deletingPitcher)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}