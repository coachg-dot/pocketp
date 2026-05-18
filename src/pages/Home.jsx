import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Play, Trophy, Clock, Pencil, Trash2, Check, X, CalendarDays, MapPin, FileText, FlagTriangleRight } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import PullToRefresh from '../components/PullToRefresh';

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editOpponent, setEditOpponent] = useState('');


  const { data: games = [], isLoading, refetch } = useQuery({
    queryKey: ['games'],
    queryFn: () => base44.entities.Game.list('-created_date', 20)
  });

  const { data: scheduledGames = [] } = useQuery({
    queryKey: ['scheduledGames'],
    queryFn: () => base44.entities.ScheduledGame.list('date', 10)
  });

  const today = new Date().toISOString().split('T')[0];

  const finishedOpponents = new Set(
    games.filter((g) => g.status === 'final').map((g) => g.opponent?.toLowerCase().trim())
  );
  const upcomingGames = scheduledGames.filter((g) =>
  g.date >= today && !finishedOpponents.has(g.opponent?.toLowerCase().trim())
  );

  const markGameFinal = useMutation({
    mutationFn: (id) => base44.entities.Game.update(id, { status: 'final' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['games'] })
  });

  const updateGame = useMutation({
    mutationFn: ({ id, opponent }) => base44.entities.Game.update(id, { opponent }),
    onMutate: async ({ id, opponent }) => {
      await queryClient.cancelQueries({ queryKey: ['games'] });
      const prev = queryClient.getQueryData(['games']);
      queryClient.setQueryData(['games'], (old = []) =>
      old.map((g) => g.id === id ? { ...g, opponent } : g)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['games'], ctx.prev);
    },
    onSuccess: () => {
      setEditingId(null);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['games'] })
  });

  const deleteGame = useMutation({
    mutationFn: async (id) => {
      // Cascade-delete all at-bats and pitches for this game to prevent orphaned records
      const [atBats, pitches] = await Promise.all([
        base44.entities.AtBat.filter({ game_id: id }),
        base44.entities.Pitch.filter({ game_id: id }),
      ]);
      await Promise.all([
        ...atBats.map(ab => base44.entities.AtBat.delete(ab.id)),
        ...pitches.map(p => base44.entities.Pitch.delete(p.id)),
      ]);
      await base44.entities.Game.delete(id);
      // Clear any localStorage state for this game
      ['lineup','subs','batterIdx','inning','outs','bases','runnerPitchers','runnerPlayers',
       'runnerEarned','pitchOffsets','localPitchCounts','pitcher','approaches','bullpen-budget'].forEach(key => {
        localStorage.removeItem(`${key}-${id}`);
      });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['games'] });
      const prev = queryClient.getQueryData(['games']);
      queryClient.setQueryData(['games'], (old = []) => old.filter((g) => g.id !== id));
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      queryClient.setQueryData(['games'], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['games'] })
  });

  const startEdit = (game, e) => {
    e.stopPropagation();
    setEditingId(game.id);
    setEditOpponent(game.opponent);
  };

  const saveEdit = (e) => {
    e.stopPropagation();
    updateGame.mutate({ id: editingId, opponent: editOpponent });
  };

  const cancelEdit = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <div className="min-h-screen">
      <div className="min-h-screen">
        <div className="relative text-primary-foreground px-4 pt-8 pb-4">
          <div className="relative max-w-lg mx-auto flex flex-col items-center">
            <img src="https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/76c32d5d4_Untitled__2_.png"

            alt="Pocket Pitcher" className="w-36 h-auto object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]" />

            
            <p className="text-white/70 mt-2 text-xs font-bold uppercase tracking-widest">Track Smarter.Analyze Faster.Perform Better</p>
          </div>
        </div>

      <div className="max-w-lg mx-auto px-4 pt-4">

        {/* Quick Links */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: 'Track Pitches', emoji: '⚾', page: 'NewGame' },
            { label: 'Pitch Data', emoji: '📈', page: 'PitchSequencing' },
            { label: 'Practice', emoji: '🎯', page: 'Practice' }].
            map(({ label, emoji, page }) =>
            <Card key={page} className="cursor-pointer hover:border-primary/50 transition-colors select-none touch-target" onClick={() => navigate(createPageUrl(page))}>
              <CardContent className="p-3 text-center">
                <span className="text-xl">{emoji}</span>
                <p className="font-medium text-xs mt-1">{label}</p>
              </CardContent>
            </Card>
            )}
        </div>

        {/* Upcoming Games */}
        <div className="space-y-2 mb-6">
          <h2 className="font-semibold text-lg flex items-center gap-2 text-primary-foreground">
            <CalendarDays className="w-4 h-4 text-primary-foreground/70" />
            Upcoming Games
          </h2>
          {upcomingGames.length === 0 ?
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(createPageUrl('Schedule') + '?add=1')}>
              
              <CardContent className="py-6 text-center">
                <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No scheduled games</p>
                <p className="text-xs text-primary/70 mt-0.5 font-medium">Tap to add a game →</p>
              </CardContent>
            </Card> :

            upcomingGames.map((g) =>
            <Card
              key={g.id}
              className="border-l-4 border-l-accent cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(createPageUrl('NewGame') + `?opponent=${encodeURIComponent(g.opponent)}&date=${g.date}&location=${encodeURIComponent(g.location || '')}`)}>
              
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">vs {(g.opponent || '').toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {format(new Date(g.date + 'T12:00:00'), 'EEE, MMM d')}
                      {g.location &&
                    <>
                          <span className="mx-0.5">·</span>
                          <MapPin className="w-3 h-3" />
                          {g.location}
                        </>
                    }
                    </p>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Play className="w-4 h-4 text-muted-foreground shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>Tap to start tracking this game</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardContent>
              </Card>
            )
            }
        </div>

        {/* Recent Games */}
        <PullToRefresh onRefresh={refetch}>
        <div className="space-y-3 pb-4">
          {isLoading ?
              <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
            </div> :
              games.length > 0 &&
              <>
              <h2 className="font-semibold text-lg flex items-center gap-2 text-primary-foreground">
                <Trophy className="w-4 h-4 text-primary-foreground/70" />
                Recent Games
              </h2>
              {games.map((game) =>
                <Card
                  key={game.id}
                  className={`transition-colors ${editingId === game.id ? 'border-primary/50' : 'cursor-pointer hover:border-primary/50'}`}
                  onClick={() => {
                    if (editingId === game.id) return;
                    if (game.status === 'final') {navigate(`/GameSummaryDashboard?id=${game.id}`);} else
                    {navigate(createPageUrl('TrackGame') + `?id=${game.id}`);}
                  }}>
                  
                  <CardContent className="p-4 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {editingId === game.id ?
                      <Input
                        value={editOpponent}
                        onChange={(e) => setEditOpponent(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 text-sm font-semibold mb-1"
                        autoFocus
                        onKeyDown={(e) => {if (e.key === 'Enter') saveEdit(e);if (e.key === 'Escape') cancelEdit(e);}} /> :


                      <p className="font-semibold truncate uppercase">vs {game.opponent}</p>
                      }
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        {game.date ? format(new Date(game.date + 'T12:00:00'), 'MMM d, yyyy') : ''}
                        {game.location && ` • ${game.location}`}
                        {game.status === 'final' && <span className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5 font-medium">Final</span>}
                      </p>
                    </div>
                    {editingId === game.id ?
                    <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={saveEdit}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div> :

                    <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => startEdit(game, e)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}>
                            
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete game?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the game vs <strong>{game.opponent}</strong> and all its at-bat data. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteGame.mutate(game.id)}>
                              
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => {e.stopPropagation();navigate(`/GameSummaryDashboard?id=${game.id}`);}}>
                                <FileText className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>Game Summary</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {game.status !== 'final' &&
                      <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700"
                              onClick={(e) => {e.stopPropagation();markGameFinal.mutate(game.id);}}
                              disabled={markGameFinal.isPending}>
                              
                                  <FlagTriangleRight className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p>Mark as Final</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                      }
                      </div>
                    }
                  </CardContent>
                </Card>
                )}
            </>
              }
        </div>
        </PullToRefresh>
      </div>
      </div>

      
    </div>);

}