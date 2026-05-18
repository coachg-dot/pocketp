import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TeamAPI, TeamPlayerAPI } from '@/lib/teamApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, Edit2, User, ClipboardList, Users, Upload, GitMerge } from 'lucide-react';
import ImportRosters from './ImportRosters';
import ImportStats from './ImportStats';
import { createPageUrl } from '@/utils';
import PullToRefresh from '../components/PullToRefresh';
import PitchRepertoireSelector from '../components/PitchRepertoireSelector';
import ScoutingReport from '../components/ScoutingReport';
import TeamManager from '../components/TeamManager';
import QuickAssignToTeam from '../components/QuickAssignToTeam';
import MergePitchersDialog from '../components/MergePitchersDialog';

export default function Players() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [position, setPosition] = useState('');
  const [bats, setBats] = useState('R');
  const [throws, setThrows] = useState('R');
  const [pitchRepertoire, setPitchRepertoire] = useState([]);
  const [scoutingPlayer, setScoutingPlayer] = useState(null);
  const [showMerge, setShowMerge] = useState(false);
  const [sortBy, setSortBy] = useState('number'); // 'number' | 'lastName'

  const { data: pitches = [] } = useQuery({
    queryKey: ['pitches-all-names'],
    queryFn: () => base44.entities.Pitch.list('-created_date', 2000),
  });

  const pitcherNames = useMemo(() => {
    const names = new Set(pitches.map(p => p.pitcher_name).filter(Boolean));
    return [...names].sort();
  }, [pitches]);

  const { data: players = [], isLoading, refetch: refetchPlayers } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('name')
  });

  const { data: teamPlayers = [], refetch: refetchTeamPlayers } = useQuery({
    queryKey: ['teamPlayers'],
    queryFn: () => TeamPlayerAPI.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => TeamAPI.list(),
  });

  const refetch = () => { refetchPlayers(); refetchTeamPlayers(); };

  // Build team id→name map
  const teamMap = useMemo(() => {
    const m = {};
    teams.forEach(t => { m[t.id] = t.name; });
    return m;
  }, [teams]);

  // Merge Player + TeamPlayer lists, tag each with team name
  const allPlayers = useMemo(() => {
    const fromPlayers = players.map(p => ({ ...p, _source: 'Player', _teamName: null }));
    const fromTeamPlayers = teamPlayers.map(p => ({
      ...p, _source: 'TeamPlayer',
      _teamName: p.team_id ? (teamMap[p.team_id] || 'Unknown Team') : null
    }));
    return [...fromPlayers, ...fromTeamPlayers];
  }, [players, teamPlayers, teamMap]);

  const sortPlayers = (arr) => [...arr].sort((a, b) => {
    if (sortBy === 'lastName') {
      const lastName = (p) => (p.name || '').trim().split(' ').pop() || '';
      return lastName(a).localeCompare(lastName(b));
    }
    // Default: sort by number numerically, missing numbers go to end
    const numA = a.number != null && a.number !== '' ? Number(a.number) : Infinity;
    const numB = b.number != null && b.number !== '' ? Number(b.number) : Infinity;
    return numA - numB;
  });

  // Group by team name; ungrouped under "No Team"
  const grouped = useMemo(() => {
    const groups = {};
    allPlayers.forEach(p => {
      const key = p._teamName || 'No Team';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    // Sort: named teams first alphabetically, then "No Team"
    const sorted = Object.keys(groups).sort((a, b) => {
      if (a === 'No Team') return 1;
      if (b === 'No Team') return -1;
      return a.localeCompare(b);
    });
    return sorted.map(name => ({ name, players: groups[name] }));
  }, [allPlayers]);

  const createPlayer = useMutation({
    mutationFn: (data) => base44.entities.Player.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['players'] }); resetForm(); }
  });

  const updatePlayer = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Player.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['players'] }); resetForm(); }
  });

  const deletePlayer = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] })
  });

  const resetForm = () => {
    setName(''); setNumber(''); setPosition('');
    setBats('R'); setThrows('R'); setPitchRepertoire([]);
    setEditingPlayer(null); setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    const data = {
      name: name.toUpperCase(),
      number: number ? parseInt(number) : null,
      position: position.toUpperCase(),
      bats, throws,
      pitch_repertoire: pitchRepertoire,
    };
    if (editingPlayer) {
      updatePlayer.mutate({ id: editingPlayer.id, data });
    } else {
      createPlayer.mutate(data);
    }
  };

  const handleEdit = (player) => {
    // Only allow editing native Player records, not imported TeamPlayer records
    if (player._source === 'TeamPlayer') return;
    setEditingPlayer(player);
    setName(player.name);
    setNumber(player.number?.toString() || '');
    setPosition(player.position || '');
    setBats(player.bats || 'R');
    setThrows(player.throws || 'R');
    setPitchRepertoire(player.pitch_repertoire || []);
    setIsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10" onClick={() => navigate(createPageUrl('Home'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Players &amp; Teams</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        <Tabs defaultValue="players" className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="players" className="flex-1">
              <User className="w-4 h-4 mr-1.5" />Players
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex-1">
              <Users className="w-4 h-4 mr-1.5" />Teams
            </TabsTrigger>
            <TabsTrigger value="import" className="flex-1">
              <Upload className="w-4 h-4 mr-1.5" />Roster
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex-1">
              <ClipboardList className="w-4 h-4 mr-1.5" />Stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="px-0">
            <ImportRosters embedded />
          </TabsContent>

          <TabsContent value="stats" className="px-0">
            <ImportStats embedded />
          </TabsContent>

          <TabsContent value="teams" className="space-y-5">
            <TeamManager />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Unassigned Players</p>
              <QuickAssignToTeam />
            </div>
          </TabsContent>

          <TabsContent value="players" className="space-y-4">
            {/* Sort control */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium shrink-0">Sort:</span>
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  onClick={() => setSortBy('number')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${sortBy === 'number' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
                >
                  # Number
                </button>
                <button
                  onClick={() => setSortBy('lastName')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${sortBy === 'lastName' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
                >
                  A–Z Name
                </button>
              </div>
            </div>

            {/* Merge Pitchers — prominent card */}
            <div
              className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => setShowMerge(true)}
            >
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <GitMerge className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary">Merge Duplicate Pitchers</p>
                <p className="text-xs text-muted-foreground">Fix name mismatches so stats accumulate correctly</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="flex-1">
                    <Plus className="w-4 h-4 mr-2" />Add Player
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingPlayer ? 'Edit Player' : 'Add Player'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" className="mt-1.5" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="number">Jersey #</Label>
                      <Input id="number" type="number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="00" className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor="position">Position</Label>
                      <Input id="position" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. SS, P" className="mt-1.5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Bats</Label>
                      <Select value={bats} onValueChange={setBats}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="R">Right</SelectItem>
                          <SelectItem value="L">Left</SelectItem>
                          <SelectItem value="S">Switch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Throws</Label>
                      <Select value={throws} onValueChange={setThrows}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="R">Right</SelectItem>
                          <SelectItem value="L">Left</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Pitch Repertoire</Label>
                    <p className="text-xs text-muted-foreground mb-2">Tap pitches this player throws</p>
                    <PitchRepertoireSelector selected={pitchRepertoire} onChange={setPitchRepertoire} />
                  </div>
                  <Button onClick={handleSubmit} disabled={!name.trim() || createPlayer.isPending || updatePlayer.isPending} className="w-full">
                    {editingPlayer ? 'Update' : 'Add'} Player
                  </Button>
                </div>
              </DialogContent>
              </Dialog>
            </div>

            <PullToRefresh onRefresh={refetch}>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
                </div>
              ) : allPlayers.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <User className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No players added yet</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-5">
                  {grouped.map(({ name: groupName, players: groupPlayers }) => (
                    <div key={groupName}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
                        {groupName}
                      </p>
                      <div className="space-y-2">
                        {sortPlayers(groupPlayers).map((player) => (
                          <Card key={player.id}>
                            <CardContent className="p-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="font-bold text-primary text-sm">{player.number || '?'}</span>
                                </div>
                                <div>
                                  <p className="font-semibold uppercase">{player.name}</p>
                                  {player.position && <p className="text-sm text-muted-foreground uppercase">{player.position}</p>}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setScoutingPlayer(player)}>
                                  <ClipboardList className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(player)}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => {
                                  if (player._source === 'TeamPlayer') {
                                    TeamPlayerAPI.delete(player.id).then(() => queryClient.invalidateQueries({ queryKey: ['teamPlayers'] }));
                                  } else {
                                    deletePlayer.mutate(player.id);
                                  }
                                }}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PullToRefresh>
          </TabsContent>
        </Tabs>
      </div>

      {scoutingPlayer && (
        <ScoutingReport player={scoutingPlayer} open={!!scoutingPlayer} onClose={() => setScoutingPlayer(null)} />
      )}
      <MergePitchersDialog open={showMerge} onClose={() => setShowMerge(false)} pitcherNames={pitcherNames} />
    </div>
  );
}