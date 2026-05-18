import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSavedRepertoire, saveRepertoire } from '@/lib/pitcherRepertoireStore';

const ALL_PITCHES = [
  { value: '4seam', label: '4-Seam FB' },
  { value: '2seam', label: '2-Seam FB' },
  { value: 'fastball', label: 'Fastball' },
  { value: 'sinker', label: 'Sinker' },
  { value: 'cutter', label: 'Cutter' },
  { value: 'slider', label: 'Slider' },
  { value: 'sweeper', label: 'Sweeper' },
  { value: 'curveball', label: 'Curveball' },
  { value: 'changeup', label: 'Changeup' },
  { value: 'splitter', label: 'Splitter' },
  { value: 'knuckleball', label: 'Knuckleball' },
  { value: 'eephus', label: 'Eephus' },
];

// Inline-editable pill for a history pitch name
function EditablePitcherPill({ suggestion, isSelected, onSelect, onRename }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(suggestion.name);

  const handleSave = () => {
    const trimmed = editVal.trim().toUpperCase();
    if (trimmed && trimmed !== suggestion.name) {
      onRename(suggestion.name, trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={editVal}
          onChange={e => setEditVal(e.target.value.toUpperCase())}
          className="h-7 text-xs px-2 w-32"
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        />
        <button onClick={handleSave} className="p-1 text-primary hover:text-primary/80">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="p-1 text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => onSelect(suggestion)}
        className={cn(
          "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
          isSelected
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card border-border hover:border-primary/50 text-foreground"
        )}
      >
        {suggestion.name}
        {suggestion.source === 'history' && <span className="ml-1 opacity-60 text-[9px]">★</span>}
      </button>
      {suggestion.source === 'history' && (
        <button
          onClick={(e) => { e.stopPropagation(); setEditVal(suggestion.name); setEditing(true); }}
          className="p-1 text-muted-foreground/50 hover:text-muted-foreground"
          title="Edit name"
        >
          <Edit2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export default function PitcherSubstitutionDialog({ open, onClose, onConfirm, rosterPitchers = [], knownPitcherNames = [], currentPitcherName = '', currentPitcherHand = 'R', currentPitcherRepertoire = [] }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [hand, setHand] = useState('R');
  const [repertoire, setRepertoire] = useState([]);

  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [pitcherSort, setPitcherSort] = useState('number'); // 'number' | 'lastName'
  useEffect(() => {
    if (open) {
      setSelectedTeamId('');
      // Pre-populate with current pitcher info so it's easy to adjust repertoire
      if (currentPitcherName) {
        setName(currentPitcherName);
        setHand(currentPitcherHand || 'R');
        const saved = getSavedRepertoire(currentPitcherName);
        setRepertoire(saved.length > 0 ? saved : currentPitcherRepertoire);
      } else {
        setName('');
        setHand('R');
        setRepertoire([]);
      }
    }
  }, [open]);

  const { data: teams = [] } = useQuery({
    queryKey: ['teams-pitcher-dialog'],
    queryFn: () => base44.entities.Team.list('name', 200),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: allTeamPitchers = [] } = useQuery({
    queryKey: ['allTeamPitchers-pitcher-dialog'],
    queryFn: () => base44.entities.TeamPitcher.list('name', 500),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  const teamPitchers = useMemo(() => {
    if (!selectedTeamId) return allTeamPitchers;
    return allTeamPitchers.filter(p => p.team_id === selectedTeamId);
  }, [allTeamPitchers, selectedTeamId]);

  // Rename a historical pitcher name across all pitch + atBat records
  const renamePitcherInPitches = useMutation({
    mutationFn: async ({ oldName, newName }) => {
      const pitches = await base44.entities.Pitch.filter({ pitcher_name: oldName });
      await Promise.all(pitches.map(p => base44.entities.Pitch.update(p.id, { pitcher_name: newName })));
      const atBats = await base44.entities.AtBat.filter({ pitcher_name: oldName });
      await Promise.all(atBats.map(ab => base44.entities.AtBat.update(ab.id, { pitcher_name: newName })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pitches-all-names'] });
      queryClient.invalidateQueries({ queryKey: ['pitches-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['atBats-analytics'] });
    }
  });

  // Combine roster pitchers + names from pitch history
  const suggestions = useMemo(() => {
    const list = [];
    rosterPitchers.forEach(p => {
      list.push({ name: (p.name || '').toUpperCase(), hand: p.throws || 'R', repertoire: p.pitch_repertoire || [], source: 'roster' });
    });
    const rosterNames = new Set(rosterPitchers.map(p => (p.name || '').toUpperCase()));
    knownPitcherNames.forEach(n => {
      const uName = n.toUpperCase();
      if (!rosterNames.has(uName)) {
        list.push({ name: uName, hand: 'R', repertoire: [], source: 'history' });
      }
    });
    return list;
  }, [rosterPitchers, knownPitcherNames]);

  const handleSelectSuggestion = (s) => {
    setName(s.name);
    setHand(s.hand);
    const saved = getSavedRepertoire(s.name);
    setRepertoire(saved.length > 0 ? saved : (s.repertoire || []));
  };

  const handleSelectTeamPitcher = (p) => {
    const upperName = (p.name || '').toUpperCase();
    setName(upperName);
    setHand(p.throws || 'R');
    const saved = getSavedRepertoire(upperName);
    setRepertoire(saved.length > 0 ? saved : (p.pitch_repertoire || []));
  };

  const togglePitch = (val) => {
    setRepertoire(prev => prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]);
  };

  const handleConfirm = async () => {
    if (!name.trim()) return;
    const upperName = name.trim().toUpperCase();
    // Save repertoire to shared persistent store
    if (repertoire.length > 0) saveRepertoire(upperName, repertoire);
    // Persist back to TeamPitcher entity — search ALL team pitchers (not just filtered)
    if (repertoire.length > 0 && allTeamPitchers.length > 0) {
      const matchedTP = allTeamPitchers.find(p => p.name?.toUpperCase() === upperName);
      if (matchedTP) {
        base44.entities.TeamPitcher.update(matchedTP.id, { pitch_repertoire: repertoire, throws: hand }).catch(() => {});
      }
    }
    onConfirm({ name: upperName, hand, pitch_repertoire: repertoire });
    onClose();
  };

  const handleRename = (oldName, newName) => {
    // If the currently selected name was the old one, update it
    if (name === oldName) setName(newName);
    renamePitcherInPitches.mutate({ oldName, newName });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-sm max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Set Pitcher</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">

          {/* Team pitcher quick-select */}
          {teams.length > 0 && (
            <div>
              <Label className="mb-2 block text-xs">From Team Roster</Label>
              {/* Team filter pills */}
              <div className="flex gap-2 flex-wrap mb-2">
                <button
                  onClick={() => setSelectedTeamId('')}
                  className={cn(
                    "px-3 py-1 rounded-full border text-xs font-medium transition-colors",
                    selectedTeamId === ''
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-primary/50"
                  )}
                >ALL</button>
                {teams.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeamId(prev => prev === t.id ? '' : t.id)}
                    className={cn(
                      "px-3 py-1 rounded-full border text-xs font-medium transition-colors",
                      selectedTeamId === t.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:border-primary/50"
                    )}
                  >
                    {t.name.toUpperCase()}
                  </button>
                ))}
              </div>
              {/* Sort controls + pitcher list */}
              {teamPitchers.length > 0 ? (
                <>
                  <div className="flex gap-1 mb-2">
                    <button onClick={() => setPitcherSort('number')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${pitcherSort === 'number' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'}`}
                    >#</button>
                    <button onClick={() => setPitcherSort('lastName')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${pitcherSort === 'lastName' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'}`}
                    >A-Z</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[...teamPitchers].sort((a, b) => {
                      if (pitcherSort === 'number') {
                        const na = parseInt(String(a.number || '9999'), 10);
                        const nb = parseInt(String(b.number || '9999'), 10);
                        return na - nb;
                      }
                      const la = (a.name || '').trim().split(' ').pop().toLowerCase();
                      const lb = (b.name || '').trim().split(' ').pop().toLowerCase();
                      return la.localeCompare(lb);
                    }).map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectTeamPitcher(p)}
                        className={cn(
                          "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                          name === (p.name || '').toUpperCase()
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-border hover:border-primary/50 text-foreground"
                        )}
                      >
                        {p.number ? `#${p.number} ` : ''}{(p.name || '').toUpperCase()}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No pitchers on roster yet.</p>
              )}
            </div>
          )}

          {/* Quick-select from known pitchers with edit capability */}
          {suggestions.length > 0 && (
            <div>
              <Label className="mb-2 block text-xs">Known Pitchers</Label>
              <div className="flex flex-wrap gap-2">
                {suggestions.map(s => (
                  <EditablePitcherPill
                    key={s.name}
                    suggestion={s}
                    isSelected={name === s.name}
                    onSelect={handleSelectSuggestion}
                    onRename={handleRename}
                  />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">★ = from pitch history · tap ✏ to rename</p>
            </div>
          )}

          {/* Manual name entry */}
          <div>
            <Label className="mb-1.5 block text-xs">Pitcher Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value.toUpperCase())}
              placeholder="e.g. JOHN SMITH"
            />
          </div>

          {/* Throws */}
          <div>
            <Label className="mb-2 block text-xs">Throws</Label>
            <div className="flex gap-2">
              {['R', 'L'].map(h => (
                <Button
                  key={h}
                  variant={hand === h ? 'default' : 'outline'}
                  className="flex-1 h-10"
                  onClick={() => setHand(h)}
                >
                  {h === 'R' ? '✋ Right' : '🤚 Left'}
                </Button>
              ))}
            </div>
          </div>

          {/* Repertoire */}
          <div>
            <Label className="mb-2 block text-xs">Pitch Repertoire</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {ALL_PITCHES.map(pitch => (
                <button
                  key={pitch.value}
                  onClick={() => togglePitch(pitch.value)}
                  className={cn(
                    "py-2 px-2 rounded-lg border text-xs font-medium transition-colors text-center",
                    repertoire.includes(pitch.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-primary/50"
                  )}
                >
                  {pitch.label}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" disabled={!name.trim()} onClick={handleConfirm}>
            Set Pitcher
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}