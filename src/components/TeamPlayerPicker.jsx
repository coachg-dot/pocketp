import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * TeamPlayerPicker
 * Props:
 *   label        – "Pitcher" | "Batter"
 *   names        – string[] of names that have historical data (used for highlighting)
 *   value        – currently selected name
 *   onChange     – (name: string) => void
 *   disabled     – optional boolean
 *   role         – 'pitcher' | 'batter' | 'any' (default: 'any')
 *                  When 'pitcher', also shows teams from TeamPitcher entity
 */
export default function TeamPlayerPicker({ label, names = [], value, onChange, disabled, role = 'any' }) {
  const [selectedTeam, setSelectedTeam] = useState(null);

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list('name'),
  });

  const { data: teamPlayers = [] } = useQuery({
    queryKey: ['teamPlayers'],
    queryFn: () => base44.entities.TeamPlayer.list(),
  });

  const { data: teamPitchers = [] } = useQuery({
    queryKey: ['teamPitchers'],
    queryFn: () => base44.entities.TeamPitcher.list(),
  });

  // Normalize names with data into a set for quick lookup
  const namesWithData = useMemo(() => new Set(names.map(n => n.trim().toUpperCase())), [names]);

  // Build a map: normalized name → team_id  (from both roster entities)
  const nameToTeam = useMemo(() => {
    const map = {};
    [...teamPlayers, ...teamPitchers].forEach(p => {
      if (p.name && p.team_id) map[p.name.trim().toUpperCase()] = p.team_id;
    });
    return map;
  }, [teamPlayers, teamPitchers]);

  // Team id → team name
  const teamById = useMemo(() => {
    const m = {};
    teams.forEach(t => { m[t.id] = t.name; });
    return m;
  }, [teams]);

  // Build per-team player lists from roster entities (not just from pitch data)
  // For pitcher role: use TeamPitcher; for batter role: use TeamPlayer; for any: both
  const rosterByTeam = useMemo(() => {
    const byTeam = {};
    const addPlayer = (p) => {
      if (!p.name || !p.team_id) return;
      if (!byTeam[p.team_id]) byTeam[p.team_id] = new Set();
      byTeam[p.team_id].add(p.name.trim().toUpperCase());
    };
    if (role === 'pitcher') {
      teamPitchers.forEach(addPlayer);
    } else if (role === 'batter') {
      teamPlayers.forEach(addPlayer);
    } else {
      [...teamPlayers, ...teamPitchers].forEach(addPlayer);
    }
    return byTeam;
  }, [teamPlayers, teamPitchers, role]);

  // Also add players from the `names` prop who are assigned to a team
  // (so players with pitch data but in a team show up under that team)
  const groupedByTeam = useMemo(() => {
    const byTeam = {};
    // Start with roster entries
    Object.entries(rosterByTeam).forEach(([tid, nameSet]) => {
      byTeam[tid] = new Set(nameSet);
    });
    // Add names-with-data that are assigned to a team
    names.forEach(name => {
      const upper = name.trim().toUpperCase();
      const tid = nameToTeam[upper];
      if (tid) {
        if (!byTeam[tid]) byTeam[tid] = new Set();
        byTeam[tid].add(upper);
      }
    });
    return byTeam;
  }, [rosterByTeam, names, nameToTeam]);

  // Unassigned: names with data that have no team assignment
  const unassigned = useMemo(() => {
    return names.filter(name => !nameToTeam[name.trim().toUpperCase()]);
  }, [names, nameToTeam]);

  // All teams that have at least one player (from roster OR from data)
  const activeTeamIds = useMemo(() => {
    const ids = new Set(Object.keys(groupedByTeam));
    // Also include all teams from the DB that have roster entries
    Object.keys(rosterByTeam).forEach(tid => ids.add(tid));
    // Filter to only teams that actually exist in teams list
    return [...ids].filter(tid => teamById[tid]).sort((a, b) =>
      (teamById[a] || '').localeCompare(teamById[b] || '')
    );
  }, [groupedByTeam, rosterByTeam, teamById]);

  // Derived: which team does the current value belong to?
  const valueTeamId = value ? nameToTeam[value.trim().toUpperCase()] : null;

  const handleSelect = (name) => {
    onChange(name);
    setSelectedTeam(null);
  };

  const handleTeamClick = (tid) => setSelectedTeam(tid);
  const handleBack = () => setSelectedTeam(null);

  if (disabled) {
    return (
      <div className="h-9 flex items-center px-3 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
        {label === 'Batter' ? 'Select pitcher first' : 'No data'}
      </div>
    );
  }

  // ── Player list within a team ──────────────────────────────────────────────
  if (selectedTeam !== null) {
    const nameSet = selectedTeam === '__unassigned__'
      ? new Set(unassigned.map(n => n.trim().toUpperCase()))
      : (groupedByTeam[selectedTeam] || new Set());
    const playerList = [...nameSet].sort();
    const teamName = selectedTeam === '__unassigned__' ? 'Unassigned' : (teamById[selectedTeam] || 'Team');

    return (
      <div className="space-y-1">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mb-1"
        >
          <ChevronLeft className="w-3 h-3" /> {teamName}
        </button>
        <div className="flex flex-col gap-0 max-h-52 overflow-y-auto rounded-lg border bg-card">
          {playerList.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No players</p>
          )}
          {playerList.map(upperName => {
            const hasData = namesWithData.has(upperName);
            return (
              <button
                key={upperName}
                onClick={() => handleSelect(upperName)}
                className={cn(
                  'text-left px-3 py-2 text-xs font-medium transition-colors border-b last:border-0 flex items-center justify-between',
                  value?.trim().toUpperCase() === upperName
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted/60'
                )}
              >
                <span>{upperName}</span>
                {!hasData && (
                  <span className="text-[9px] text-muted-foreground/50 font-normal">no data</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Team list view ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-1">
      {/* Show current selection */}
      {value && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 mb-1">
          <span className="text-xs font-bold text-primary">{value.trim().toUpperCase()}</span>
          <button
            onClick={() => onChange('')}
            className="text-[10px] text-muted-foreground hover:text-destructive ml-2"
          >
            ✕ Clear
          </button>
        </div>
      )}
      <div className="flex flex-col gap-0 rounded-lg border bg-card overflow-hidden">
        {activeTeamIds.length === 0 && unassigned.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No {label.toLowerCase()}s found</p>
        )}
        {activeTeamIds.map(tid => {
          const playerSet = groupedByTeam[tid] || new Set();
          const count = playerSet.size;
          return (
            <button
              key={tid}
              onClick={() => handleTeamClick(tid)}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 text-xs font-medium border-b last:border-0 transition-colors',
                valueTeamId === tid ? 'bg-primary/5 text-primary' : 'hover:bg-muted/60'
              )}
            >
              <span className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 opacity-50" />
                {teamById[tid] || tid}
              </span>
              <span className="text-muted-foreground text-[10px]">{count} players ›</span>
            </button>
          );
        })}
        {unassigned.length > 0 && (
          <button
            onClick={() => handleTeamClick('__unassigned__')}
            className={cn(
              'flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors',
              !valueTeamId && value ? 'bg-primary/5 text-primary' : 'hover:bg-muted/60'
            )}
          >
            <span className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 opacity-50" />
              Unassigned
            </span>
            <span className="text-muted-foreground text-[10px]">{unassigned.length} players ›</span>
          </button>
        )}
      </div>
    </div>
  );
}