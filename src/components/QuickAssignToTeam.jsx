import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Check } from 'lucide-react';

// Adds a pitcher (from pitch history) to a team as a TeamPitcher record
// Adds a player (from Player entity) to a team as a TeamPlayer record

export default function QuickAssignToTeam() {
  const queryClient = useQueryClient();
  const [assigningId, setAssigningId] = useState(null); // "pitcher:NAME" or "player:ID"
  const [selectedTeam, setSelectedTeam] = useState('');

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list('name'),
  });

  const { data: teamPitchers = [] } = useQuery({
    queryKey: ['teamPitchers-all'],
    queryFn: () => base44.entities.TeamPitcher.list('name', 500),
  });

  const { data: teamPlayers = [] } = useQuery({
    queryKey: ['teamPlayers-all'],
    queryFn: () => base44.entities.TeamPlayer.list('name', 500),
  });

  const { data: pitches = [] } = useQuery({
    queryKey: ['pitches'],
    queryFn: () => base44.entities.Pitch.list('-created_date', 2000),
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('name'),
  });

  // Unique pitcher names from pitch records not already in any team
  const assignedPitcherNames = useMemo(() => new Set(teamPitchers.map(p => p.name?.trim().toUpperCase())), [teamPitchers]);
  const unassignedPitchers = useMemo(() => {
    const nameMap = {};
    pitches.forEach(p => {
      if (!p.pitcher_name) return;
      const name = p.pitcher_name.trim().toUpperCase();
      if (!assignedPitcherNames.has(name)) nameMap[name] = true;
    });
    return Object.keys(nameMap).sort();
  }, [pitches, assignedPitcherNames]);

  // Players from Player entity not already in any team
  const assignedPlayerNames = useMemo(() => new Set(teamPlayers.map(p => p.name?.trim().toUpperCase())), [teamPlayers]);
  const unassignedPlayers = useMemo(() =>
    players.filter(p => !assignedPlayerNames.has(p.name?.trim().toUpperCase())),
    [players, assignedPlayerNames]
  );

  const addPitcherMutation = useMutation({
    mutationFn: ({ name, teamId }) => base44.entities.TeamPitcher.create({ team_id: teamId, name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPitchers-all'] });
      queryClient.invalidateQueries({ queryKey: ['teamPitchers'] });
      setAssigningId(null);
      setSelectedTeam('');
    },
  });

  const addPlayerMutation = useMutation({
    mutationFn: ({ player, teamId }) => base44.entities.TeamPlayer.create({
      team_id: teamId,
      name: player.name,
      number: player.number?.toString() || '',
      position: player.position || '',
      bats: player.bats || 'R',
      throws: player.throws || 'R',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPlayers-all'] });
      queryClient.invalidateQueries({ queryKey: ['teamPlayers'] });
      setAssigningId(null);
      setSelectedTeam('');
    },
  });

  const handleAssign = (id) => {
    if (!selectedTeam) return;
    if (id.startsWith('pitcher:')) {
      const name = id.slice(8);
      addPitcherMutation.mutate({ name, teamId: selectedTeam });
    } else {
      const player = players.find(p => p.id === id.slice(7));
      if (player) addPlayerMutation.mutate({ player, teamId: selectedTeam });
    }
  };

  const isPending = addPitcherMutation.isPending || addPlayerMutation.isPending;

  if (teams.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-3">Create a team first to assign players.</p>;
  }

  if (unassignedPitchers.length === 0 && unassignedPlayers.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-3">All players are assigned to a team.</p>;
  }

  return (
    <div className="space-y-2">
      {unassignedPitchers.map(name => {
        const id = `pitcher:${name}`;
        const isAssigning = assigningId === id;
        return (
          <div key={id} className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-card">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate uppercase">{name}</p>
              <Badge variant="secondary" className="text-xs mt-0.5">Pitcher</Badge>
            </div>
            {isAssigning ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Team…" /></SelectTrigger>
                  <SelectContent>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="icon" className="h-8 w-8" disabled={!selectedTeam || isPending} onClick={() => handleAssign(id)}>
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setAssigningId(null); setSelectedTeam(''); }}>✕</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => setAssigningId(id)}>
                <UserPlus className="w-3 h-3 mr-1" /> Add to Team
              </Button>
            )}
          </div>
        );
      })}

      {unassignedPlayers.map(player => {
        const id = `player:${player.id}`;
        const isAssigning = assigningId === id;
        return (
          <div key={id} className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-card">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate uppercase">{player.name}</p>
              <Badge variant="outline" className="text-xs mt-0.5">{player.position || 'Player'}</Badge>
            </div>
            {isAssigning ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Team…" /></SelectTrigger>
                  <SelectContent>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="icon" className="h-8 w-8" disabled={!selectedTeam || isPending} onClick={() => handleAssign(id)}>
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setAssigningId(null); setSelectedTeam(''); }}>✕</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => setAssigningId(id)}>
                <UserPlus className="w-3 h-3 mr-1" /> Add to Team
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}