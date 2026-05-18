import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TeamAPI, TeamPlayerAPI, TeamPitcherAPI } from '@/lib/teamApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Edit2, Users, ChevronDown, ChevronUp, UserPlus, Save } from 'lucide-react';
import PitchRepertoireSelector from './PitchRepertoireSelector';

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'UTL'];

// ── Inline-editable hitter row ─────────────────────────────────
function TeamPlayerRow({ player, teamId, onDelete }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: player.name || '',
    number: player.number || '',
    position: player.position || '',
    bats: player.bats || 'R',
    throws: player.throws || 'R',
  });

  const updatePlayer = useMutation({
    mutationFn: (data) => TeamPlayerAPI.update(player.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPlayers', teamId] });
      setEditing(false);
    }
  });

  const handleSave = () => {
    if (!form.name.trim()) return;
    updatePlayer.mutate({
      name: form.name.toUpperCase(),
      number: form.number.toUpperCase(),
      position: form.position.toUpperCase(),
      bats: form.bats,
      throws: form.throws,
    });
  };

  if (editing) {
    return (
      <div className="py-2 border-b border-border/50 last:border-0 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Jersey #</Label>
            <Input placeholder="00" value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} className="mt-0.5 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Position</Label>
            <Select value={form.position} onValueChange={v => setForm(p => ({ ...p, position: v }))}>
              <SelectTrigger className="mt-0.5 h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{POSITIONS.map(pos => <SelectItem key={pos} value={pos}>{pos}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Name *</Label>
          <Input placeholder="Player name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-0.5 h-8 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Bats</Label>
            <Select value={form.bats} onValueChange={v => setForm(p => ({ ...p, bats: v }))}>
              <SelectTrigger className="mt-0.5 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="R">Right</SelectItem>
                <SelectItem value="L">Left</SelectItem>
                <SelectItem value="S">Switch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Throws</Label>
            <Select value={form.throws} onValueChange={v => setForm(p => ({ ...p, throws: v }))}>
              <SelectTrigger className="mt-0.5 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="R">Right</SelectItem>
                <SelectItem value="L">Left</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-8" disabled={!form.name.trim() || updatePlayer.isPending} onClick={handleSave}>
            <Save className="w-3.5 h-3.5 mr-1" /> Save
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/40 rounded px-1 transition-colors"
      onClick={() => setEditing(true)}
    >
      <div className="flex items-center gap-2">
        <span className="w-8 text-center font-bold text-sm text-primary">{player.number || '—'}</span>
        <div>
          <p className="font-medium text-sm uppercase">{player.name}</p>
          <p className="text-xs text-muted-foreground">{player.position || '—'} · {player.bats || 'R'}/{player.throws || 'R'}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Edit2 className="w-3 h-3 text-muted-foreground/50" />
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(player.id); }}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Inline-editable pitcher row ────────────────────────────────
function TeamPitcherRow({ pitcher, teamId, onDelete }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: pitcher.name || '',
    number: pitcher.number || '',
    throws: pitcher.throws || 'R',
    pitch_repertoire: pitcher.pitch_repertoire || [],
  });

  const updatePitcher = useMutation({
    mutationFn: (data) => TeamPitcherAPI.update(pitcher.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPitchers', teamId] });
      setEditing(false);
    }
  });

  const handleSave = () => {
    if (!form.name.trim()) return;
    updatePitcher.mutate({
      name: form.name.toUpperCase(),
      number: form.number.toUpperCase(),
      throws: form.throws,
      pitch_repertoire: form.pitch_repertoire,
    });
  };

  if (editing) {
    return (
      <div className="py-2 border-b border-border/50 last:border-0 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Jersey #</Label>
            <Input placeholder="00" value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} className="mt-0.5 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Throws</Label>
            <Select value={form.throws} onValueChange={v => setForm(p => ({ ...p, throws: v }))}>
              <SelectTrigger className="mt-0.5 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="R">Right</SelectItem>
                <SelectItem value="L">Left</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Name *</Label>
          <Input placeholder="Pitcher name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-0.5 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Pitch Repertoire</Label>
          <PitchRepertoireSelector selected={form.pitch_repertoire} onChange={rep => setForm(p => ({ ...p, pitch_repertoire: rep }))} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-8" disabled={!form.name.trim() || updatePitcher.isPending} onClick={handleSave}>
            <Save className="w-3.5 h-3.5 mr-1" /> Save
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/40 rounded px-1 transition-colors"
      onClick={() => setEditing(true)}
    >
      <div className="flex items-center gap-2">
        <span className="w-8 text-center font-bold text-sm text-primary">{pitcher.number || '—'}</span>
        <div>
          <p className="font-medium text-sm uppercase">{pitcher.name}</p>
          <p className="text-xs text-muted-foreground">{pitcher.throws || 'R'}HP · {(pitcher.pitch_repertoire || []).length} pitches</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Edit2 className="w-3 h-3 text-muted-foreground/50" />
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(pitcher.id); }}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Add hitter dialog ──────────────────────────────────────────
function AddPlayerToTeamDialog({ teamId, open, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', number: '', position: '', bats: 'R', throws: 'R' });

  const createPlayer = useMutation({
    mutationFn: (data) => TeamPlayerAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPlayers', teamId] });
      setForm({ name: '', number: '', position: '', bats: 'R', throws: 'R' });
      onClose();
    }
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    createPlayer.mutate({
      team_id: teamId,
      name: form.name.toUpperCase(),
      number: form.number.toUpperCase(),
      position: form.position.toUpperCase(),
      bats: form.bats,
      throws: form.throws,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Hitter to Roster</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Jersey #</Label>
              <Input autoFocus placeholder="00" value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Position</Label>
              <Select value={form.position} onValueChange={v => setForm(p => ({ ...p, position: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{POSITIONS.map(pos => <SelectItem key={pos} value={pos}>{pos}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Name *</Label>
            <Input placeholder="Player name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Bats</Label>
              <Select value={form.bats} onValueChange={v => setForm(p => ({ ...p, bats: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="R">Right</SelectItem>
                  <SelectItem value="L">Left</SelectItem>
                  <SelectItem value="S">Switch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Throws</Label>
              <Select value={form.throws} onValueChange={v => setForm(p => ({ ...p, throws: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="R">Right</SelectItem>
                  <SelectItem value="L">Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" disabled={!form.name.trim() || createPlayer.isPending} onClick={handleSubmit}>
            <UserPlus className="w-4 h-4 mr-2" /> Add to Roster
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add pitcher dialog ─────────────────────────────────────────
function AddPitcherToTeamDialog({ teamId, open, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', number: '', throws: 'R', pitch_repertoire: [] });

  const createPitcher = useMutation({
    mutationFn: (data) => TeamPitcherAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPitchers', teamId] });
      setForm({ name: '', number: '', throws: 'R', pitch_repertoire: [] });
      onClose();
    }
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    createPitcher.mutate({
      team_id: teamId,
      name: form.name.toUpperCase(),
      number: form.number.toUpperCase(),
      throws: form.throws,
      pitch_repertoire: form.pitch_repertoire,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Pitcher to Roster</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Jersey #</Label>
              <Input autoFocus placeholder="00" value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Throws</Label>
              <Select value={form.throws} onValueChange={v => setForm(p => ({ ...p, throws: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="R">Right</SelectItem>
                  <SelectItem value="L">Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Name *</Label>
            <Input placeholder="Pitcher name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label className="mb-2 block">Pitch Repertoire</Label>
            <PitchRepertoireSelector selected={form.pitch_repertoire} onChange={rep => setForm(p => ({ ...p, pitch_repertoire: rep }))} />
          </div>
          <Button className="w-full" disabled={!form.name.trim() || createPitcher.isPending} onClick={handleSubmit}>
            <UserPlus className="w-4 h-4 mr-2" /> Add Pitcher
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Team card ──────────────────────────────────────────────────
function TeamCard({ team, onDelete }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addingPitcher, setAddingPitcher] = useState(false);

  const { data: players = [] } = useQuery({
    queryKey: ['teamPlayers', team.id],
    queryFn: () => TeamPlayerAPI.filter(team.id),
    enabled: expanded,
  });

  const { data: pitchers = [] } = useQuery({
    queryKey: ['teamPitchers', team.id],
    queryFn: () => TeamPitcherAPI.filter(team.id),
    enabled: expanded,
  });

  const deletePlayer = useMutation({
    mutationFn: (id) => TeamPlayerAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teamPlayers', team.id] }),
  });

  const deletePitcher = useMutation({
    mutationFn: (id) => TeamPitcherAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teamPitchers', team.id] }),
  });

  return (
    <Card className="border-primary/20">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base uppercase">{team.name}</CardTitle>
            {team.location && <p className="text-xs text-muted-foreground uppercase mt-0.5">{team.location}</p>}
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setExpanded(p => !p)}>
              <Users className="w-3.5 h-3.5 mr-1" />
              Roster
              {expanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(team.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4">
          <Tabs defaultValue="hitters">
            <TabsList className="w-full mb-3">
              <TabsTrigger value="hitters" className="flex-1 text-xs">Hitters</TabsTrigger>
              <TabsTrigger value="pitchers" className="flex-1 text-xs">Pitchers</TabsTrigger>
            </TabsList>

            <TabsContent value="hitters">
              {players.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No hitters on roster yet</p>
              ) : (
                <div className="space-y-0 mb-3">
                  {players.map(p => (
                    <TeamPlayerRow key={p.id} player={p} teamId={team.id} onDelete={(id) => deletePlayer.mutate(id)} />
                  ))}
                </div>
              )}
              <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => setAddingPlayer(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Hitter
              </Button>
              <AddPlayerToTeamDialog teamId={team.id} open={addingPlayer} onClose={() => setAddingPlayer(false)} />
            </TabsContent>

            <TabsContent value="pitchers">
              {pitchers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No pitchers on roster yet</p>
              ) : (
                <div className="space-y-0 mb-3">
                  {pitchers.map(p => (
                    <TeamPitcherRow key={p.id} pitcher={p} teamId={team.id} onDelete={(id) => deletePitcher.mutate(id)} />
                  ))}
                </div>
              )}
              <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => setAddingPitcher(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Pitcher
              </Button>
              <AddPitcherToTeamDialog teamId={team.id} open={addingPitcher} onClose={() => setAddingPitcher(false)} />
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}

// ── Main export ────────────────────────────────────────────────
export default function TeamManager() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', location: '' });
  const [successMsg, setSuccessMsg] = useState('');

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => TeamAPI.list(),
  });

  const createTeam = useMutation({
    mutationFn: (data) => TeamAPI.create(data),
    onSuccess: (created) => {
      console.log('[TeamManager] Team created successfully:', created);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      const savedName = created?.name || form.name.toUpperCase();
      setForm({ name: '', location: '' });
      setShowForm(false);
      setSuccessMsg(`Team "${savedName}" created!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      console.error('[TeamManager] createTeam failed:', err?.message || err);
    },
  });

  const deleteTeam = useMutation({
    mutationFn: (id) => TeamAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });

  return (
    <div className="space-y-4">
      <Button className="w-full" onClick={() => { setShowForm(p => !p); setSuccessMsg(''); }}>
        <Plus className="w-4 h-4 mr-2" /> Create New Team
      </Button>

      {successMsg && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-600 font-medium">
          <span>✓</span> {successMsg}
        </div>
      )}

      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm">New Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Team Name *</Label>
              <Input autoFocus placeholder="e.g. TIGERS" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>City / School (optional)</Label>
              <Input placeholder="e.g. RIVERDALE" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} className="mt-1" />
            </div>
            <Button
              className="w-full"
              disabled={!form.name.trim() || createTeam.isPending}
              onClick={() => {
                const name = form.name.trim();
                if (!name) return;
                createTeam.mutate({ name: name.toUpperCase(), location: (form.location || '').toUpperCase() });
              }}
            >
              {createTeam.isPending ? 'Saving…' : 'Save Team'}
            </Button>
            {createTeam.isError && (
              <p className="text-xs text-destructive text-center">Failed to save team. Please try again.</p>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : teams.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No teams created yet</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {teams.map(team => <TeamCard key={team.id} team={team} onDelete={(id) => deleteTeam.mutate(id)} />)}
        </div>
      )}
    </div>
  );
}