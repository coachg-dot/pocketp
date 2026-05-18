import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { Users, User, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * mode: 'pitching' | 'hitting'
 * sessionType: 'open' | 'rotation' | 'lineup'
 * onSelect: (config) => void
 *   config for pitching: { sessionType: 'open' } | { sessionType: 'rotation', lineup: string[] }
 *   config for hitting:  { sessionType: 'open' } | { sessionType: 'lineup', lineup: string[] }
 */
export default function PlayerSessionPicker({ mode, onSelect }) {
  const [type, setType] = useState(null); // 'open' | 'rotation' | 'lineup'
  const [lineup, setLineup] = useState([]);

  const { data: pitchers = [] } = useQuery({
    queryKey: ['team-pitchers'],
    queryFn: () => base44.entities.TeamPitcher.list(),
    enabled: mode === 'pitching',
  });

  const { data: players = [] } = useQuery({
    queryKey: ['team-players'],
    queryFn: () => base44.entities.TeamPlayer.list(),
    enabled: mode === 'hitting',
  });

  const pitcherNames = pitchers.map(p => p.name).filter(Boolean).sort();
  const playerNames = players.map(p => p.name).filter(Boolean).sort();

  const isPitching = mode === 'pitching';
  const listType = isPitching ? 'rotation' : 'lineup';

  const addToList = (name) => {
    if (!lineup.includes(name)) setLineup(prev => [...prev, name]);
  };

  const removeFromList = (name) => setLineup(prev => prev.filter(n => n !== name));

  const canConfirm = () => {
    if (!type) return false;
    if (type === 'open') return true;
    return lineup.length >= 1;
  };

  const handleConfirm = () => {
    if (type === 'open') {
      onSelect({ sessionType: 'open' });
    } else {
      onSelect({ sessionType: listType, lineup });
    }
  };

  return (
    <div className="space-y-5">
      {/* Type toggle */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">
          {isPitching ? 'Who is pitching?' : 'Who is hitting?'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setType('open'); setLineup([]); }}
            className={cn(
              "p-4 rounded-xl border text-left transition-all",
              type === 'open' ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-1" : "border-border hover:border-primary/40"
            )}
          >
            <Users className="w-5 h-5 mb-1 text-primary" />
            <p className="font-semibold text-sm">Open</p>
            <p className="text-xs text-muted-foreground mt-0.5">No specific player — general practice</p>
          </button>
          <button
            onClick={() => { setType(listType); setLineup([]); }}
            className={cn(
              "p-4 rounded-xl border text-left transition-all",
              type === listType ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-1" : "border-border hover:border-primary/40"
            )}
          >
            <User className="w-5 h-5 mb-1 text-primary" />
            <p className="font-semibold text-sm">{isPitching ? 'Pitching Rotation' : 'Batting Order'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{isPitching ? 'Select 1+ pitchers' : 'Select 1+ hitters in order'}</p>
          </button>
        </div>
      </div>

      {/* Rotation / Batting Order builder */}
      {type === listType && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            {isPitching ? 'Build Your Pitching Rotation' : 'Build Your Batting Order'}
          </p>

          {/* Current list */}
          {lineup.length > 0 && (
            <div className="space-y-1">
              {lineup.map((name, i) => (
                <div key={name} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                  <span className="text-sm font-medium flex-1">{name}</span>
                  <button onClick={() => removeFromList(name)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add player */}
          {(isPitching ? pitcherNames : playerNames).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No {isPitching ? 'pitchers' : 'players'} found. Add them via the Players tab.
            </p>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">
                Add {isPitching ? 'pitcher' : 'player'}:
              </p>
              <div className="flex flex-wrap gap-2">
                {(isPitching ? pitcherNames : playerNames).filter(n => !lineup.includes(n)).map(name => (
                  <button
                    key={name}
                    onClick={() => addToList(name)}
                    className="px-3 py-1.5 rounded-full border border-border hover:border-primary/40 text-xs font-medium flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3 h-3" /> {name}
                  </button>
                ))}
              </div>
              {(isPitching ? pitcherNames : playerNames).filter(n => !lineup.includes(n)).length === 0 && lineup.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">All added.</p>
              )}
            </div>
          )}
        </div>
      )}

      <Button className="w-full h-11 text-sm" disabled={!canConfirm()} onClick={handleConfirm}>
        Confirm Selection
      </Button>
    </div>
  );
}