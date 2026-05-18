import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Pencil, Trash2, Users, ChevronRight, GitMerge, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';
import { useToast } from '@/components/ui/use-toast';
import MergePitchersDialog from '@/components/MergePitchersDialog';
import PitchRepertoireSelector from '@/components/PitchRepertoireSelector';
import ImportRosters from './ImportRosters';
import ImportStats from './ImportStats';

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'IF', 'OF', 'UT'];

const EMPTY_HITTER = { name: '', number: '', position: '', bats: 'R', throws: 'R', notes: '' };
const EMPTY_PITCHER = { name: '', number: '', throws: 'R', pitch_repertoire: [], notes: '' };

function HitterForm({ initial = EMPTY_HITTER, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...EMPTY_HITTER, ...initial });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Name *</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="PLAYER NAME" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Jersey #</Label>
          <Input value={form.number} onChange={e => set('number', e.target.value)} placeholder="00" />
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1.5 block">Position</Label>
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map(pos => (
            <button key={pos} onClick={() => set('position', form.position === pos ? '' : pos)}
              className={cn("px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors",
                form.position === pos ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"
              )}>{pos}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1.5 block">Bats</Label>
          <div className="flex gap-1.5">
            {['R', 'L', 'S'].map(h => (
              <button key={h} onClick={() => set('bats', h)}
                className={cn("flex-1 py-2 rounded-lg border text-xs font-medium transition-colors",
                  form.bats === h ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                )}>{h}</button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs mb-1.5 block">Throws</Label>
          <div className="flex gap-1.5">
            {['R', 'L'].map(h => (
              <button key={h} onClick={() => set('throws', h)}
                className={cn("flex-1 py-2 rounded-lg border text-xs font-medium transition-colors",
                  form.throws === h ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                )}>{h}</button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">Notes</Label>
        <Input value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" disabled={!form.name.trim() || saving} onClick={() => onSave(form)}>
          {saving ? 'Saving…' : 'Save Hitter'}
        </Button>
      </div>
    </div>
  );
}

function PitcherForm({ initial = EMPTY_PITCHER, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...EMPTY_PITCHER, ...initial });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Name *</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="PITCHER NAME" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Jersey #</Label>
          <Input value={form.number} onChange={e => set('number', e.target.value)} placeholder="00" />
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1.5 block">Throws</Label>
        <div className="flex gap-1.5">
          {['R', 'L'].map(h => (
            <button key={h} onClick={() => set('throws', h)}
              className={cn("flex-1 py-2 rounded-lg border text-xs font-medium transition-colors",
                form.throws === h ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
              )}>{h}</button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1.5 block">Pitch Repertoire</Label>
        <PitchRepertoireSelector selected={form.pitch_repertoire || []} onChange={v => set('pitch_repertoire', v)} />
      </div>
      <div>
        <Label className="text-xs mb-1 block">Notes</Label>
        <Input value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" disabled={!form.name.trim() || saving} onClick={() => onSave(form)}>
          {saving ? 'Saving…' : 'Save Pitcher'}
        </Button>
      </div>
    </div>
  );
}

export default function RosterManager() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [editingHitter, setEditingHitter] = useState(null);
  const [editingPitcher, setEditingPitcher] = useState(null);
  const [deleteConfirmHitter, setDeleteConfirmHitter] = useState(null);
  const [deleteConfirmPitcher, setDeleteConfirmPitcher] = useState(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [sortBy, setSortBy] = useState('number'); // 'number' | 'lastName'

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list('name', 200),
  });

  const { data: hitters = [], isLoading: hittersLoading } = useQuery({
    queryKey: ['teamPlayers', selectedTeamId],
    queryFn: () => base44.entities.TeamPlayer.filter({ team_id: selectedTeamId }, 'number'),
    enabled: !!selectedTeamId,
  });

  const { data: pitchers = [], isLoading: pitchersLoading } = useQuery({
    queryKey: ['teamPitchers', selectedTeamId],
    queryFn: () => base44.entities.TeamPitcher.filter({ team_id: selectedTeamId }, 'number'),
    enabled: !!selectedTeamId,
  });

  const createTeam = useMutation({
    mutationFn: (data) => base44.entities.Team.create(data),
    onSuccess: (newTeam) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setAddingTeam(false);
      setNewTeamName('');
      toast({ title: 'Team added', description: `${newTeam?.name || 'Team'} was saved successfully.` });
    },
    onError: (err) => {
      console.error('[RosterManager] createTeam failed:', err);
      toast({ title: 'Failed to save team', description: err?.message || 'Please try again.', variant: 'destructive' });
    },
  });

  // Hitter mutations
  const createHitter = useMutation({
    mutationFn: (data) => base44.entities.TeamPlayer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPlayers', selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ['teamPlayers-all'] });
      setEditingHitter(null);
    },
  });
  const updateHitter = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TeamPlayer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPlayers', selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ['teamPlayers-all'] });
      setEditingHitter(null);
    },
  });
  const deleteHitter = useMutation({
    mutationFn: (id) => base44.entities.TeamPlayer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPlayers', selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ['teamPlayers-all'] });
      setDeleteConfirmHitter(null);
    },
  });

  // Pitcher mutations
  const createPitcher = useMutation({
    mutationFn: (data) => base44.entities.TeamPitcher.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPitchers', selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ['allTeamPitchers'] });
      setEditingPitcher(null);
    },
  });
  const updatePitcher = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TeamPitcher.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPitchers', selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ['allTeamPitchers'] });
      setEditingPitcher(null);
    },
  });
  const deletePitcher = useMutation({
    mutationFn: (id) => base44.entities.TeamPitcher.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPitchers', selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ['allTeamPitchers'] });
      setDeleteConfirmPitcher(null);
    },
  });

  const handleSaveHitter = (form) => {
    const data = {
      name: form.name.trim().toUpperCase(),
      number: form.number || '',
      position: form.position || '',
      bats: form.bats || 'R',
      throws: form.throws || 'R',
      notes: form.notes || '',
    };
    if (editingHitter === 'new') {
      createHitter.mutate({ ...data, team_id: selectedTeamId });
    } else {
      updateHitter.mutate({ id: editingHitter.id, data });
    }
  };

  const handleSavePitcher = (form) => {
    const data = {
      name: form.name.trim().toUpperCase(),
      number: form.number || '',
      throws: form.throws || 'R',
      pitch_repertoire: form.pitch_repertoire || [],
      notes: form.notes || '',
    };
    if (editingPitcher === 'new') {
      createPitcher.mutate({ ...data, team_id: selectedTeamId });
    } else {
      updatePitcher.mutate({ id: editingPitcher.id, data });
    }
  };

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const sortPlayers = (arr) => [...arr].sort((a, b) => {
    if (sortBy === 'lastName') {
      const lastName = (p) => (p.name || '').trim().split(' ').pop() || '';
      return lastName(a).localeCompare(lastName(b));
    }
    const numA = a.number != null && a.number !== '' ? Number(a.number) : Infinity;
    const numB = b.number != null && b.number !== '' ? Number(b.number) : Infinity;
    return numA - numB;
  });

  // ── Team selector screen ───────────────────────────────────────
  if (!selectedTeamId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(createPageUrl('Home'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <p className="font-bold text-sm">Roster Manager</p>
            <p className="text-xs text-muted-foreground">Select a team</p>
          </div>
        </div>

        <div className="px-4 py-4 space-y-3">
          {teams.map(team => (
            <button key={team.id} onClick={() => setSelectedTeamId(team.id)}
              className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-4 text-left hover:border-primary/50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{team.name.toUpperCase()}</p>
                {team.location && <p className="text-xs text-muted-foreground">{team.location}</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}

          {addingTeam ? (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <input
                  autoFocus
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  style={{ textTransform: 'none' }}
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  placeholder="Enter team name..."
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const name = newTeamName.trim();
                      if (name && !createTeam.isPending) createTeam.mutate({ name: name.toUpperCase() });
                    }
                  }}
                />
                {!newTeamName.trim() && (
                  <p className="text-xs text-muted-foreground">Type a team name above to enable the button</p>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setAddingTeam(false); setNewTeamName(''); }}>Cancel</Button>
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={!newTeamName.trim() || createTeam.isPending}
                    onClick={() => {
                      const name = newTeamName.trim();
                      if (!name) return;
                      console.log('[RosterManager] Add Team clicked, name:', name);
                      createTeam.mutate({ name: name.toUpperCase() });
                    }}
                  >
                    {createTeam.isPending ? 'Saving…' : 'Add Team'}
                  </Button>
                </div>
                {createTeam.isError && (
                  <p className="text-xs text-destructive">Failed to save. Please try again.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Button variant="outline" className="w-full gap-2" onClick={() => setAddingTeam(true)}>
              <Plus className="w-4 h-4" /> Add New Team
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Team roster screen ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSelectedTeamId(null)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <p className="font-bold text-sm">{selectedTeam?.name?.toUpperCase()}</p>
          <p className="text-xs text-muted-foreground">{hitters.length} hitters · {pitchers.length} pitchers</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowMerge(true)}>
          <GitMerge className="w-3.5 h-3.5" /> Merge
        </Button>
      </div>

      <div className="px-4 py-4">
        <Tabs defaultValue="hitters">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="hitters" className="flex-1 text-xs">
              Hitters <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{hitters.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pitchers" className="flex-1 text-xs">
              Pitchers <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{pitchers.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="import" className="flex-1 text-xs">Roster</TabsTrigger>
            <TabsTrigger value="stats" className="flex-1 text-xs">Stats</TabsTrigger>
          </TabsList>

          {/* ── HITTERS TAB ── */}
          <TabsContent value="hitters" className="space-y-2">
            <div className="flex items-center gap-2 pb-1">
              <span className="text-xs text-muted-foreground font-medium shrink-0">Sort:</span>
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button onClick={() => setSortBy('number')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${sortBy === 'number' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}># Number</button>
                <button onClick={() => setSortBy('lastName')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${sortBy === 'lastName' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}>A–Z Name</button>
              </div>
            </div>
            <Button size="sm" className="w-full gap-1" onClick={() => setEditingHitter('new')}>
              <Plus className="w-3.5 h-3.5" /> Add Hitter
            </Button>

            {hittersLoading && <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted/40 animate-pulse rounded-xl" />)}</div>}

            {!hittersLoading && hitters.length === 0 && (
              <div className="text-center py-12 text-muted-foreground space-y-2">
                <Users className="w-10 h-10 mx-auto opacity-20" />
                <p className="text-sm">No hitters yet</p>
              </div>
            )}

            {sortPlayers(hitters).map(player => (
              <div key={player.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                {player.number && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold">{player.number}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{(player.name || '').toUpperCase()}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {player.position && <span className="text-xs text-muted-foreground">{player.position}</span>}
                    <span className="text-xs text-muted-foreground">{player.bats || 'R'}/{player.throws || 'R'}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingHitter(player)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmHitter(player)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* ── ROSTER IMPORT TAB ── */}
          <TabsContent value="import" className="pt-1">
            <ImportRosters embedded={true} preselectedTeamId={selectedTeamId} preselectedTeamName={selectedTeam?.name} />
          </TabsContent>

          {/* ── STATS IMPORT TAB ── */}
          <TabsContent value="stats" className="pt-1">
            <ImportStats embedded={true} />
          </TabsContent>

          {/* ── PITCHERS TAB ── */}
          <TabsContent value="pitchers" className="space-y-2">
            <div className="flex items-center gap-2 pb-1">
              <span className="text-xs text-muted-foreground font-medium shrink-0">Sort:</span>
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button onClick={() => setSortBy('number')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${sortBy === 'number' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}># Number</button>
                <button onClick={() => setSortBy('lastName')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${sortBy === 'lastName' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}>A–Z Name</button>
              </div>
            </div>
            <Button size="sm" className="w-full gap-1" onClick={() => setEditingPitcher('new')}>
              <Plus className="w-3.5 h-3.5" /> Add Pitcher
            </Button>

            {pitchersLoading && <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted/40 animate-pulse rounded-xl" />)}</div>}

            {!pitchersLoading && pitchers.length === 0 && (
              <div className="text-center py-12 text-muted-foreground space-y-2">
                <Users className="w-10 h-10 mx-auto opacity-20" />
                <p className="text-sm">No pitchers yet</p>
              </div>
            )}

            {sortPlayers(pitchers).map(pitcher => (
              <div key={pitcher.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                {pitcher.number && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold">{pitcher.number}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{(pitcher.name || '').toUpperCase()}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="text-xs text-muted-foreground">{pitcher.throws || 'R'}HP</span>
                    {pitcher.pitch_repertoire?.length > 0 && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        {pitcher.pitch_repertoire.length} pitches
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingPitcher(pitcher)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmPitcher(pitcher)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Hitter Dialog */}
      <Dialog open={!!editingHitter} onOpenChange={() => setEditingHitter(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingHitter === 'new' ? 'Add Hitter' : 'Edit Hitter'}</DialogTitle>
          </DialogHeader>
          {editingHitter && (
            <HitterForm
              initial={editingHitter === 'new' ? EMPTY_HITTER : {
                name: editingHitter.name || '',
                number: editingHitter.number || '',
                position: editingHitter.position || '',
                bats: editingHitter.bats || 'R',
                throws: editingHitter.throws || 'R',
                notes: editingHitter.notes || '',
              }}
              onSave={handleSaveHitter}
              onCancel={() => setEditingHitter(null)}
              saving={createHitter.isPending || updateHitter.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Pitcher Dialog */}
      <Dialog open={!!editingPitcher} onOpenChange={() => setEditingPitcher(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPitcher === 'new' ? 'Add Pitcher' : 'Edit Pitcher'}</DialogTitle>
          </DialogHeader>
          {editingPitcher && (
            <PitcherForm
              initial={editingPitcher === 'new' ? EMPTY_PITCHER : {
                name: editingPitcher.name || '',
                number: editingPitcher.number || '',
                throws: editingPitcher.throws || 'R',
                pitch_repertoire: editingPitcher.pitch_repertoire || [],
                notes: editingPitcher.notes || '',
              }}
              onSave={handleSavePitcher}
              onCancel={() => setEditingPitcher(null)}
              saving={createPitcher.isPending || updatePitcher.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Hitter Confirm */}
      <Dialog open={!!deleteConfirmHitter} onOpenChange={() => setDeleteConfirmHitter(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Remove Hitter?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Remove <span className="font-semibold text-foreground">{(deleteConfirmHitter?.name || '').toUpperCase()}</span> from this roster?
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmHitter(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" disabled={deleteHitter.isPending}
              onClick={() => deleteHitter.mutate(deleteConfirmHitter.id)}>Remove</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Pitcher Confirm */}
      <Dialog open={!!deleteConfirmPitcher} onOpenChange={() => setDeleteConfirmPitcher(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Remove Pitcher?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Remove <span className="font-semibold text-foreground">{(deleteConfirmPitcher?.name || '').toUpperCase()}</span> from this roster?
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmPitcher(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" disabled={deletePitcher.isPending}
              onClick={() => deletePitcher.mutate(deleteConfirmPitcher.id)}>Remove</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Merge Pitchers */}
      <MergePitchersDialog
        open={showMerge}
        onClose={() => setShowMerge(false)}
        pitcherNames={pitchers.map(p => p.name).filter(Boolean)}
      />
    </div>
  );
}