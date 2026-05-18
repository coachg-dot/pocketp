import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, CalendarDays, MapPin, Pencil, Check, X, BarChart2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { format, isPast, isToday } from 'date-fns';
import PullToRefresh from '../components/PullToRefresh';
import GameSummary from '../components/GameSummary';

export default function Schedule() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const [showForm, setShowForm] = useState(urlParams.get('add') === '1');
  const [form, setForm] = useState({ opponent: '', date: '', location: '', notes: '' });
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [summaryGame, setSummaryGame] = useState(null);

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list('name')
  });

  const { data: scheduledGames = [], isLoading, refetch } = useQuery({
    queryKey: ['schedule'],
    queryFn: () => base44.entities.ScheduledGame.list('date')
  });

  // Completed games — used to show stats when clicking a past scheduled game
  const { data: completedGames = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => base44.entities.Game.list('-date', 100)
  });

  const handleSelectTeam = (value) => {
    setSelectedTeamId(value);
    if (value === '__new__' || value === '') {
      setForm(p => ({ ...p, opponent: '' }));
    } else {
      const team = teams.find(t => t.id === value);
      if (team) setForm(p => ({ ...p, opponent: team.name }));
    }
  };

  const createGame = useMutation({
    mutationFn: () => base44.entities.ScheduledGame.create({
      ...form,
      opponent: form.opponent.toUpperCase(),
      location: form.location.toUpperCase(),
      notes: form.notes.toUpperCase(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setForm({ opponent: '', date: '', location: '', notes: '' });
      setSelectedTeamId('');
      setShowForm(false);
    }
  });

  const updateGame = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScheduledGame.update(id, {
      ...data,
      opponent: data.opponent?.toUpperCase(),
      location: data.location?.toUpperCase(),
      notes: data.notes?.toUpperCase(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setEditingId(null);
    }
  });

  const deleteGame = useMutation({
    mutationFn: (id) => base44.entities.ScheduledGame.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule'] })
  });

  const startEdit = (game) => {
    setEditingId(game.id);
    setEditForm({ opponent: game.opponent, date: game.date, location: game.location || '', notes: game.notes || '' });
  };

  const upcoming = scheduledGames.filter(g => g.date && (!isPast(new Date(g.date + 'T12:00:00')) || isToday(new Date(g.date + 'T12:00:00'))));
  const past = scheduledGames.filter(g => g.date && isPast(new Date(g.date + 'T12:00:00')) && !isToday(new Date(g.date + 'T12:00:00')));

  // Find a matching completed Game record by opponent name + date proximity
  const findCompletedGame = (scheduled) => {
    const sOpponent = scheduled.opponent?.toLowerCase().trim();
    return completedGames.find(cg =>
      cg.opponent?.toLowerCase().trim() === sOpponent && cg.date === scheduled.date
    ) || completedGames.find(cg =>
      cg.opponent?.toLowerCase().trim() === sOpponent
    );
  };

  const GameCard = ({ game }) => {
    const isEditing = editingId === game.id;
    const gameDate = new Date(game.date + 'T12:00:00');
    const isUpcoming = !isPast(gameDate) || isToday(gameDate);
    const completedGame = !isUpcoming ? findCompletedGame(game) : null;

    return (
      <Card className={isUpcoming ? 'border-primary/20' : 'opacity-70'}>
        <CardContent className="p-4">
          {isEditing ? (
            <div className="space-y-2">
              <Input placeholder="Opponent" value={editForm.opponent} onChange={e => setEditForm(p => ({ ...p, opponent: e.target.value }))} className="h-8 text-sm" />
              <Input type="date" value={editForm.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} className="h-8 text-sm" />
              <Input placeholder="Location (optional)" value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} className="h-8 text-sm" />
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1" onClick={() => updateGame.mutate({ id: game.id, data: editForm })}>
                  <Check className="w-3.5 h-3.5 mr-1" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {isToday(gameDate) && (
                    <span className="text-xs bg-accent text-accent-foreground font-bold px-1.5 py-0.5 rounded">TODAY</span>
                  )}
                  <p className="font-semibold truncate">vs {game.opponent}</p>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {format(gameDate, 'MMM d, yyyy')}
                  </span>
                  {game.location && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {game.location}
                    </span>
                  )}
                </div>
                {game.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{game.notes}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                {completedGame && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-primary"
                    title="View pitcher stats"
                    onClick={() => setSummaryGame(completedGame)}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(game)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => {
                    if (window.confirm(`Remove "${game.opponent}" from the schedule?`)) {
                      deleteGame.mutate(game.id);
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="bg-primary text-primary-foreground px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10 -ml-2" onClick={() => navigate(createPageUrl('Home'))}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <p className="font-semibold text-sm">Schedule</p>
              <p className="text-xs opacity-80">Upcoming games</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setShowForm(p => !p)}>
            <Plus className="w-4 h-4 mr-1" /> Add Game
          </Button>
        </div>
      </div>

      <PullToRefresh onRefresh={refetch}>
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Add form */}
        {showForm && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">New Scheduled Game</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select value={selectedTeamId} onValueChange={handleSelectTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Select existing team…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">+ Enter manually</SelectItem>
                  {teams.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.location ? ` (${t.location})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Opponent name"
                value={form.opponent}
                onChange={e => setForm(p => ({ ...p, opponent: e.target.value }))}
              />
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              />
              <Input
                placeholder="Location (optional)"
                value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              />
              <Input
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              />
              <Button
                className="w-full mt-1"
                disabled={!form.opponent || !form.date || createGame.isPending}
                onClick={() => createGame.mutate()}
              >
                Save Game
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : (
          <>
            {/* Upcoming */}
            <div className="space-y-2">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Upcoming ({upcoming.length})</h2>
              {upcoming.length === 0 ? (
                <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No upcoming games scheduled</CardContent></Card>
              ) : (
                upcoming.map(g => <GameCard key={g.id} game={g} />)
              )}
            </div>

            {/* Past */}
            {past.length > 0 && (
              <div className="space-y-2">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Past ({past.length})</h2>
                {past.map(g => <GameCard key={g.id} game={g} />)}
              </div>
            )}
          </>
        )}
      </div>
      </PullToRefresh>

      <GameSummary
        game={summaryGame}
        open={!!summaryGame}
        onClose={() => setSummaryGame(null)}
      />
    </div>
  );
}