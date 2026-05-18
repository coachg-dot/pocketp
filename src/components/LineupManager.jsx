import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { UserPlus, X, Users, ChevronUp, ChevronDown, ClipboardList, BarChart2, ArrowLeftRight } from 'lucide-react';
import HitterSubstitutionDialog from './HitterSubstitutionDialog';
import { cn } from "@/lib/utils";

const POSITIONS = [
  { value: 'P',   label: 'P – Pitcher' },
  { value: 'C',   label: 'C – Catcher' },
  { value: '1B',  label: '1B – First Base' },
  { value: '2B',  label: '2B – Second Base' },
  { value: '3B',  label: '3B – Third Base' },
  { value: 'SS',  label: 'SS – Shortstop' },
  { value: 'LF',  label: 'LF – Left Field' },
  { value: 'CF',  label: 'CF – Center Field' },
  { value: 'RF',  label: 'RF – Right Field' },
  { value: 'DH',  label: 'DH – Designated Hitter' },
  { value: 'EH',  label: 'EH – Extra Hitter' },
];

const HANDEDNESS = [
  { value: 'R', label: 'R' },
  { value: 'L', label: 'L' },
];

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 100;

function getLastName(name) {
  const parts = (name || '').trim().split(' ');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : parts[0].toLowerCase();
}

export default function LineupManager({
  players,
  lineup,
  onLineupChange,
  currentBatterIndex,
  onSelectBatter,
  showPositions,
  onShowPositionsChange,
  onScoutPlayer,
  onViewStats,
  teamPool = [], // players from a selected opponent team (one-click add pool)
  onSubstitutionMade, // callback fired after a substitution is confirmed
}) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHand, setNewHand] = useState('R');
  const cycleHand = (h) => h === 'R' ? 'L' : h === 'L' ? 'S' : 'R';
  const [newPosition, setNewPosition] = useState('');
  const [newJerseyNumber, setNewJerseyNumber] = useState('');

  // Pinch hitter dialog
  const [isAddingPinchHitter, setIsAddingPinchHitter] = useState(false);
  const [pinchHitterName, setPinchHitterName] = useState('');
  const [pinchHand, setPinchHand] = useState('R');
  const [replacingPosition, setReplacingPosition] = useState(null);

  // Hitter substitution dialog
  const [hitterSubOpen, setHitterSubOpen] = useState(false);

  const handleAddPlayer = () => {
    if (!newName.trim()) return;
    if (lineup.length >= MAX_PLAYERS) return;
    const entry = {
      id: `quick-${Date.now()}-${Math.random()}`,
      name: newName.trim().toUpperCase(),
      hand: newHand,
      jerseyNumber: newJerseyNumber.trim() || undefined,
      position: showPositions ? newPosition : undefined,
      isPinchHitter: false,
    };
    onLineupChange([...lineup, entry]);
    setNewName('');
    setNewHand('R');

    setNewPosition('');
    setNewJerseyNumber('');
  };

  const handleAddFromRoster = (player) => {
    if (lineup.length >= MAX_PLAYERS) return;
    if (lineup.find(p => p.id === player.id)) return;
    // Preserve 'S' for switch hitters so TrackGame can prompt which side
    const hand = player.bats || player.hand || 'R';
    onLineupChange([...lineup, { ...player, hand, isPinchHitter: false }]);
  };

  const handleRemove = (index) => {
    onLineupChange(lineup.filter((_, i) => i !== index));
  };

  const handleMove = (index, dir) => {
    const arr = [...lineup];
    const swapIdx = index + dir;
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    [arr[index], arr[swapIdx]] = [arr[swapIdx], arr[index]];
    onLineupChange(arr);
  };

  const handleToggleHand = (index) => {
    const arr = [...lineup];
    const cur = arr[index].hand || 'R';
    arr[index] = { ...arr[index], hand: cur === 'R' ? 'L' : cur === 'L' ? 'S' : 'R' };
    onLineupChange(arr);
  };

  const handlePositionChange = (index, pos) => {
    const arr = [...lineup];
    arr[index] = { ...arr[index], position: pos };
    onLineupChange(arr);
  };

  const handleAddPinchHitter = () => {
    if (!pinchHitterName.trim() || replacingPosition === null) return;
    const newLineup = [...lineup];
    newLineup[replacingPosition] = {
      id: `ph-${Date.now()}`,
      name: pinchHitterName.trim().toUpperCase(),
      hand: pinchHand,
      isPinchHitter: true,
      replacedPlayer: lineup[replacingPosition]?.name,
      position: lineup[replacingPosition]?.position,
    };
    onLineupChange(newLineup);
    setPinchHitterName('');
    setPinchHand('R');
    setReplacingPosition(null);
    setIsAddingPinchHitter(false);
    onSubstitutionMade?.();
  };

  const handleHitterSub = (index, newPlayer) => {
    const arr = [...lineup];
    arr[index] = newPlayer;
    onLineupChange(arr);
    onSubstitutionMade?.();
  };

  const [rosterSort, setRosterSort] = useState('number'); // 'lastName' | 'number'

  const sortedRoster = [...players].sort((a, b) => {
    if (rosterSort === 'number') {
      const na = parseInt(String(a.jerseyNumber || a.number || '9999'), 10);
      const nb = parseInt(String(b.jerseyNumber || b.number || '9999'), 10);
      return na - nb;
    }
    return getLastName(a.name).localeCompare(getLastName(b.name));
  });
  const availableFromRoster = sortedRoster.filter(p => !lineup.find(l => l.id === p.id));
  const positionsValid = !showPositions || lineup.every(p => p.position);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="w-4 h-4" />
          Batting Order
          <span className="text-xs text-muted-foreground font-normal">({lineup.length}/{MAX_PLAYERS})</span>
        </h3>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" disabled={lineup.length === 0} onClick={() => setHitterSubOpen(true)}>
            <ArrowLeftRight className="w-4 h-4 mr-1" />
            Sub
          </Button>
          <Button variant="outline" size="sm" disabled={lineup.length === 0} onClick={() => setIsAddingPinchHitter(true)}>
            <UserPlus className="w-4 h-4 mr-1" />
            PH
          </Button>
        </div>
      </div>

      {/* Position toggle */}
      {onShowPositionsChange !== undefined && (
        <div className="flex items-center gap-2 text-sm">
          <Switch id="pos-toggle" checked={!!showPositions} onCheckedChange={onShowPositionsChange} />
          <Label htmlFor="pos-toggle">Track Positions</Label>
        </div>
      )}

      {/* Lineup list */}
      <div className="space-y-1.5">
        {lineup.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Add players below to build your batting order</p>
        ) : (
          lineup.map((player, index) => (
            <div
              key={player.id}
              onClick={() => onSelectBatter && onSelectBatter(index)}
              className={cn(
                "flex items-center gap-1.5 p-2 rounded-lg transition-all",
                onSelectBatter ? "cursor-pointer" : "",
                currentBatterIndex === index
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card border hover:border-primary/50"
              )}
            >
              {/* Order number */}
              <span className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                currentBatterIndex === index ? "bg-white/20" : "bg-muted"
              )}>
                {index + 1}
              </span>

              {/* Jersey number */}
              {player.jerseyNumber && (
                <span className={cn(
                  "text-xs font-bold shrink-0 w-6 text-center",
                  currentBatterIndex === index ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  #{player.jerseyNumber}
                </span>
              )}

              {/* Name + PH label */}
              <div className="flex-1 min-w-0 flex items-center gap-1">
                <p className="font-medium text-sm truncate uppercase">
                  {player.name}
                  {player.isPinchHitter && (
                    <span className="ml-1.5 text-xs opacity-70">(PH)</span>
                  )}
                </p>
                {onViewStats && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewStats(player); }}
                    className={cn(
                      "p-1 rounded transition-colors shrink-0",
                      currentBatterIndex === index ? "hover:bg-white/20" : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
                    )}
                    title="View Stats"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {onScoutPlayer && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onScoutPlayer(player); }}
                    className={cn(
                      "p-1 rounded transition-colors shrink-0",
                      currentBatterIndex === index ? "hover:bg-white/20" : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
                    )}
                    title="Scouting Report"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Handedness badge — toggle R/L, show S for switch */}
              <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleHand(index);
              }}
                className={cn(
                  "w-7 h-7 rounded text-xs font-bold shrink-0 transition-colors",
                  currentBatterIndex === index
                    ? "bg-white/20 hover:bg-white/30"
                    : player.hand === 'S'
                      ? "bg-purple-100 text-purple-700 cursor-default"
                      : player.hand === 'L'
                        ? "bg-accent/20 text-accent-foreground hover:bg-accent/30"
                        : "bg-secondary hover:bg-secondary/80"
                )}
                title={player.hand === 'S' ? 'Switch hitter — will be prompted each at-bat' : 'Click to toggle handedness'}
              >
                {player.hand || 'R'}
              </button>

              {/* Position selector */}
              {showPositions && (
                <div onClick={e => e.stopPropagation()} className="shrink-0">
                  <Select value={player.position || ''} onValueChange={(v) => handlePositionChange(index, v)}>
                    <SelectTrigger className={cn(
                      "h-7 w-16 text-xs px-1",
                      !player.position && "border-destructive/50"
                    )}>
                      <SelectValue placeholder="Pos" />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Move up/down */}
              <div className="flex flex-col shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={() => handleMove(index, -1)} disabled={index === 0}
                  className="p-0.5 hover:bg-black/10 rounded disabled:opacity-30">
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button onClick={() => handleMove(index, 1)} disabled={index === lineup.length - 1}
                  className="p-0.5 hover:bg-black/10 rounded disabled:opacity-30">
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {/* Remove */}
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(index); }}
                className="p-1 hover:bg-destructive/20 rounded shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Quick-add form */}
      {lineup.length < MAX_PLAYERS && (
        <div className="pt-3 border-t space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Quick Add Player</p>
          <div className="flex gap-2">
            <Input
              value={newJerseyNumber}
              onChange={e => setNewJerseyNumber(e.target.value)}
              placeholder="#"
              className="w-14 h-9 text-sm shrink-0"
              maxLength={3}
              autoFocus
            />
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value.toUpperCase())}
              placeholder="Player name"
              className="flex-1 h-9 text-sm"
              onKeyDown={e => { if (e.key === 'Enter') handleAddPlayer(); }}
            />
            {/* Handedness toggle R→L→S */}
            <button
              onClick={() => setNewHand(h => cycleHand(h))}
              className={`h-9 w-12 rounded border text-sm font-bold shrink-0 transition-colors ${
                newHand === 'S' ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {newHand === 'S' ? 'SHH' : `${newHand}HH`}
            </button>
          </div>
          {showPositions && (
            <Select value={newPosition} onValueChange={setNewPosition}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            onClick={handleAddPlayer}
            disabled={!newName.trim()}
            className="w-full h-9"
            variant="outline"
          >
            <UserPlus className="w-4 h-4 mr-1" />
            Add to Lineup
          </Button>
        </div>
      )}

      {/* Team pool one-click add (shown when a saved team is selected) */}
      {teamPool.length > 0 && lineup.length < MAX_PLAYERS && (
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground font-medium">Team Roster — tap to add to lineup</p>
            <div className="flex gap-1">
              <button
                onClick={() => setRosterSort('number')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${rosterSort === 'number' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'}`}
              >#</button>
              <button
                onClick={() => setRosterSort('lastName')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${rosterSort === 'lastName' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'}`}
              >A-Z</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...teamPool].sort((a, b) => {
              if (rosterSort === 'number') {
                const na = parseInt(a.jerseyNumber || '9999', 10);
                const nb = parseInt(b.jerseyNumber || '9999', 10);
                return na - nb;
              }
              return getLastName(a.name).localeCompare(getLastName(b.name));
            }).map(player => {
              const inLineup = !!lineup.find(l => l.id === player.id);
              return (
                <button
                  key={player.id}
                  onClick={() => !inLineup && handleAddFromRoster(player)}
                  disabled={inLineup}
                  className={cn(
                    "px-2.5 py-1.5 text-xs rounded-lg border font-medium transition-colors flex items-center gap-1",
                    inLineup
                      ? "bg-primary/10 text-primary border-primary/30 cursor-default"
                      : "bg-card border-border hover:border-primary hover:bg-primary/5"
                  )}
                >
                  {player.jerseyNumber && <span className="text-muted-foreground">#{player.jerseyNumber}</span>}
                  {(player.name || '').toUpperCase()}
                  {player.hand && !inLineup && (
                    <span className={cn("opacity-60 text-[10px]", player.hand === 'S' && "text-purple-600 opacity-100")}>
                      ({player.hand})
                    </span>
                  )}
                  {inLineup && <span className="text-primary text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Roster quick-add (own players, shown when no teamPool or as fallback) */}
      {players.length > 0 && teamPool.length === 0 && lineup.length < MAX_PLAYERS && (
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">From Roster</p>
            <div className="flex gap-1">
              <button
                onClick={() => setRosterSort('number')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${rosterSort === 'number' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'}`}
              >#</button>
              <button
                onClick={() => setRosterSort('lastName')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${rosterSort === 'lastName' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'}`}
              >A-Z</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sortedRoster.map(player => {
              const inLineup = !!lineup.find(l => l.id === player.id);
              const num = player.jerseyNumber || player.number;
              return (
                <button
                  key={player.id}
                  onClick={() => !inLineup && handleAddFromRoster(player)}
                  disabled={inLineup}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-full transition-colors flex items-center gap-1",
                    inLineup
                      ? "bg-green-500 text-white cursor-default"
                      : "bg-secondary hover:bg-secondary/80"
                  )}
                >
                  {num && <span className="text-muted-foreground opacity-70">#{num}</span>}
                  {(player.name || '').toUpperCase()}
                  {player.bats && !inLineup && (
                    <span className="text-muted-foreground opacity-70">({player.bats})</span>
                  )}
                  {inLineup && <span className="opacity-80 text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Hitter Substitution Dialog */}
      <HitterSubstitutionDialog
        open={hitterSubOpen}
        onClose={() => setHitterSubOpen(false)}
        lineup={lineup}
        rosterPlayers={players}
        onConfirm={handleHitterSub}
      />

      {/* Pinch Hitter Dialog */}
      <Dialog open={isAddingPinchHitter} onOpenChange={setIsAddingPinchHitter}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Add Pinch Hitter</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-sm">Name</Label>
              <Input value={pinchHitterName} onChange={e => setPinchHitterName(e.target.value.toUpperCase())} placeholder="Player name" className="mt-1" />
            </div>
            <div className="flex gap-2">
              {HANDEDNESS.map(h => (
                <Button key={h.value} size="sm" variant={pinchHand === h.value ? 'default' : 'outline'}
                  onClick={() => setPinchHand(h.value)} className="flex-1">
                  {h.value}HH
                </Button>
              ))}
            </div>
            <div>
              <Label className="text-sm">Replacing</Label>
              <Select value={replacingPosition?.toString()} onValueChange={v => setReplacingPosition(parseInt(v))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  {lineup.map((p, i) => (
                    <SelectItem key={i} value={i.toString()}>{i + 1}. {(p.name || '').toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddPinchHitter} disabled={!pinchHitterName.trim() || replacingPosition === null} className="w-full">
              Add Pinch Hitter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}