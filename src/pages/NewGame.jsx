import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Play, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import LineupManager from '../components/LineupManager';
import HitterApproachStep from '../components/HitterApproachStep';
import { cn } from '@/lib/utils';
import { saveRepertoire, getSavedRepertoire } from '@/lib/pitcherRepertoireStore';

const ALL_PITCHES = [
  { value: '4seam',       label: '4-Seam FB' },
  { value: '2seam',       label: '2-Seam FB' },
  { value: 'sinker',      label: 'Sinker' },
  { value: 'cutter',      label: 'Cutter' },
  { value: 'slider',      label: 'Slider' },
  { value: 'sweeper',     label: 'Sweeper' },
  { value: 'slurve',      label: 'Slurve' },
  { value: 'curveball',   label: 'Curveball' },
  { value: 'knuckle_curve', label: 'Knuckle Curve' },
  { value: 'changeup',    label: 'Changeup' },
  { value: 'splitter',    label: 'Splitter' },
  { value: 'screwball',   label: 'Screwball' },
  { value: 'forkball',    label: 'Forkball' },
  { value: 'knuckleball', label: 'Knuckleball' },
  { value: 'eephus',      label: 'Eephus' },
];

export default function NewGame() {
  const navigate = useNavigate();
  const [step, setStep] = useState('lineup'); // 'lineup' | 'approach' | 'pitcher'
  const [approaches, setApproaches] = useState({}); // { [batterId|name]: 'red'|'yellow'|'green'|null }

  const urlParams = new URLSearchParams(window.location.search);

  // Game details
  const [selectedTeamId, setSelectedTeamId] = useState(''); // '' = none, '__new__' = manual
  const [opponent, setOpponent] = useState(urlParams.get('opponent') || '');
  const [date, setDate] = useState(urlParams.get('date') || format(new Date(), 'yyyy-MM-dd'));
  const [location, setLocation] = useState(urlParams.get('location') || 'home');
  const [lineup, setLineup] = useState([]);
  const [teamPool, setTeamPool] = useState([]); // players from selected opponent team
  const [teamPitchers, setTeamPitchers] = useState([]); // pitchers from selected opponent team
  const [showPositions, setShowPositions] = useState(false);

  // Opponent pitcher
  const [pitcherName, setPitcherName] = useState('');
  const [pitcherHand, setPitcherHand] = useState('R');
  const [pitcherRepertoire, setPitcherRepertoire] = useState([]);
  const [selectedRosterPitcherId, setSelectedRosterPitcherId] = useState('');
  const [pitcherTeamFilter, setPitcherTeamFilter] = useState(''); // team filter on step 2
  const [usePen, setUsePen] = useState(false); // "Pen" — no named starter, going straight to bullpen
  const [createdGameId, setCreatedGameId] = useState(null); // game just created — show pen prompt

  // My roster players (for the lineup builder roster tab)
  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('name')
  });

  // Known pitcher names from historical pitch data (for recognition + stat continuity)
  const { data: allPitchRecords = [] } = useQuery({
    queryKey: ['pitches-all-names'],
    queryFn: () => base44.entities.Pitch.list('-created_date', 500),
  });
  const knownPitcherNames = [...new Set(allPitchRecords.map(p => p.pitcher_name).filter(Boolean))].sort();

  // All saved teams for the opponent dropdown
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list('name')
  });

  // All team pitchers (for step 2 team filter)
  const { data: allTeamPitchers = [] } = useQuery({
    queryKey: ['allTeamPitchers'],
    queryFn: () => base44.entities.TeamPitcher.list('name'),
  });

  // Teams that actually have pitchers
  const teamsWithPitchers = teams.filter(t => allTeamPitchers.some(p => p.team_id === t.id));

  // Pitchers shown in step 2 dropdown: filtered by selected team, or use opponent team pitchers
  const step2TeamId = pitcherTeamFilter || (selectedTeamId !== '__new__' && selectedTeamId ? selectedTeamId : '');
  const step2Pitchers = step2TeamId
    ? allTeamPitchers.filter(p => p.team_id === step2TeamId)
    : teamPitchers;

  // When a known team is selected, load their players as a pool (not pre-populated into lineup)
  const handleSelectTeam = async (value) => {
    setSelectedTeamId(value);
    setLineup([]);
    setTeamPool([]);
    if (value === '__new__') {
      setOpponent('');
      setTeamPitchers([]);
      return;
    }
    const team = teams.find(t => t.id === value);
    if (!team) return;
    setOpponent(team.name);
    const [teamPlayers, teamPitchersList] = await Promise.all([
      base44.entities.TeamPlayer.filter({ team_id: value }, 'number'),
      base44.entities.TeamPitcher.filter({ team_id: value }, 'name'),
    ]);
    const pool = teamPlayers.map(p => ({
      id: p.id,
      name: p.name,
      hand: p.bats === 'S' ? 'S' : (p.bats || 'R'),
      jerseyNumber: p.number || '',
      position: p.position || '',
      isPinchHitter: false,
    }));
    setTeamPool(pool);
    setTeamPitchers(teamPitchersList || []);
  };

  const handleApproachChange = (id, color) => {
    setApproaches(prev => ({ ...prev, [id]: color }));
  };

  const rosterPitchers = players.filter(p => p.pitch_repertoire?.length > 0);

  const handleSelectRosterPitcher = (id) => {
    setSelectedRosterPitcherId(id);
    if (!id || id === '') { setPitcherName(''); return; }
    const p = rosterPitchers.find(r => r.id === id);
    if (p) {
      setPitcherName(p.name);
      setPitcherHand(p.throws || 'R');
      // Prefer saved repertoire from the store, fall back to entity field
      const saved = getSavedRepertoire(p.name);
      setPitcherRepertoire(saved.length > 0 ? saved : (p.pitch_repertoire || []));
    }
  };

  const createGame = useMutation({
    mutationFn: async () => {
      const game = await base44.entities.Game.create({ opponent, date, location });
      localStorage.setItem(`lineup-${game.id}`, JSON.stringify(lineup));
      if (Object.keys(approaches).length > 0) {
        localStorage.setItem(`approaches-${game.id}`, JSON.stringify(approaches));
      }
      // Save unused pool players as available subs
      const subs = teamPool.filter(p => !lineup.find(l => l.id === p.id));
      if (subs.length > 0) {
        localStorage.setItem(`subs-${game.id}`, JSON.stringify(subs));
      }
      const pitcher = usePen
        ? { name: 'PEN', hand: pitcherHand, pitch_repertoire: pitcherRepertoire }
        : pitcherName.trim()
          ? { name: pitcherName.trim(), hand: pitcherHand, pitch_repertoire: pitcherRepertoire }
          : null;
      if (pitcher) {
        localStorage.setItem(`pitcher-${game.id}`, JSON.stringify(pitcher));
        // Persist repertoire: always write to localStorage store AND back to TeamPitcher entity
        if (pitcherRepertoire.length > 0 && pitcherName.trim()) {
          const normalizedName = pitcherName.trim().toUpperCase();
          // 1. localStorage cache (fast, session-local)
          saveRepertoire(normalizedName, pitcherRepertoire);
          // 2. TeamPitcher entity (permanent DB persistence)
          //    Try matched by roster ID first, then by name match across all team pitchers
          if (selectedRosterPitcherId) {
            const tp = step2Pitchers.find(p => p.id === selectedRosterPitcherId);
            if (tp) {
              base44.entities.TeamPitcher.update(tp.id, { pitch_repertoire: pitcherRepertoire, throws: pitcherHand }).catch(() => {});
            }
          } else {
            // Name-based fallback: update any TeamPitcher with this name across all teams
            base44.entities.TeamPitcher.list('name', 500).then(allTPs => {
              const matches = allTPs.filter(p => p.name?.toUpperCase() === normalizedName);
              matches.forEach(tp => {
                base44.entities.TeamPitcher.update(tp.id, { pitch_repertoire: pitcherRepertoire, throws: pitcherHand }).catch(() => {});
              });
            }).catch(() => {});
          }
        }
      }
      sessionStorage.removeItem('pending-lineup');
      return game;
    },
    onSuccess: (game) => {
      setCreatedGameId(game.id);
    }
  });

  const togglePitch = (val) => {
    setPitcherRepertoire(prev =>
      prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]
    );
  };

  const lineupReady = lineup.length >= 3 && opponent.trim() && (!showPositions || lineup.every(p => p.position));
  const isManualEntry = selectedTeamId === '__new__' || selectedTeamId === '';

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-4 py-4 pt-safe">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/10"
            onClick={() => step === 'pitcher' ? setStep('approach') : step === 'approach' ? setStep('lineup') : navigate(createPageUrl('Home'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">New Game</h1>
            <p className="text-xs text-primary-foreground/70">
              {step === 'lineup' ? 'Step 1 of 3 – Lineup' : step === 'approach' ? 'Step 2 of 3 – Hitter Approach' : 'Step 3 of 3 – Opposing Pitcher'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* ── STEP 1: Game details + lineup ── */}
        {step === 'lineup' && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Game Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="opponent">Opponent</Label>
                  {/* Team selector dropdown */}
                  <Select value={selectedTeamId} onValueChange={handleSelectTeam}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select or enter team…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__new__">+ New / Manual Entry</SelectItem>
                      {teams.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}{t.location ? ` (${t.location})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Show manual text input only for new/manual */}
                  {isManualEntry && (
                    <Input
                      id="opponent"
                      value={opponent}
                      onChange={(e) => setOpponent(e.target.value.toUpperCase())}
                      placeholder="Enter team name"
                      className="mt-2"
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Select value={location} onValueChange={setLocation}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="home">Home</SelectItem>
                        <SelectItem value="away">Away</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Batting Lineup</CardTitle>
              </CardHeader>
              <CardContent>
                <LineupManager
                  players={players}
                  lineup={lineup}
                  onLineupChange={setLineup}
                  showPositions={showPositions}
                  onShowPositionsChange={setShowPositions}
                  teamPool={teamPool}
                />
                {lineup.length < 3 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">Minimum 3 players required to continue</p>
                )}
              </CardContent>
            </Card>

            <Button
              className="w-full h-14 text-lg font-semibold"
              disabled={!lineupReady}
              onClick={() => {
                sessionStorage.setItem('pending-lineup', JSON.stringify(lineup));
                window.scrollTo(0, 0);
                setStep('approach');
              }}
            >
              Next: Hitter Approach
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </>
        )}

        {/* ── STEP 2: Hitter Approach ── */}
        {step === 'approach' && (
          <HitterApproachStep
            lineup={lineup}
            approaches={approaches}
            onApproachChange={handleApproachChange}
            onContinue={() => { window.scrollTo(0, 0); setStep('pitcher'); }}
          />
        )}

        {/* ── STEP 3: Opposing pitcher ── */}
        {step === 'pitcher' && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Opposing Pitcher</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">


                {/* Team filter + pitcher selector */}
                {!usePen && teamsWithPitchers.length > 0 && (
                  <div className="space-y-2">
                    <Label className="block">Select from Roster <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    {/* Team filter pills */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setPitcherTeamFilter(''); setSelectedRosterPitcherId(''); setPitcherName(''); }}
                        className={cn(
                          "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
                          !pitcherTeamFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50 text-muted-foreground"
                        )}
                      >All</button>
                      {teamsWithPitchers.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { setPitcherTeamFilter(t.id); setSelectedRosterPitcherId(''); setPitcherName(''); }}
                          className={cn(
                            "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
                            pitcherTeamFilter === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50 text-muted-foreground"
                          )}
                        >{t.name.toUpperCase()}</button>
                      ))}
                    </div>
                    {/* Pitcher dropdown */}
                    {step2Pitchers.length > 0 && (
                      <Select value={selectedRosterPitcherId || '__manual__'} onValueChange={(id) => {
                        if (id === '__manual__') { setSelectedRosterPitcherId(''); setPitcherName(''); return; }
                        setSelectedRosterPitcherId(id);
                        const p = step2Pitchers.find(r => r.id === id);
                        if (p) {
                          setPitcherName(p.name);
                          setPitcherHand(p.throws || 'R');
                          // Prefer saved repertoire from the store, fall back to entity field
                          const saved = getSavedRepertoire(p.name);
                          setPitcherRepertoire(saved.length > 0 ? saved : (p.pitch_repertoire || []));
                        }
                      }}>
                        <SelectTrigger><SelectValue placeholder="Choose a pitcher…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__manual__">— Enter manually —</SelectItem>
                          {step2Pitchers.map(p => (
                            <SelectItem key={p.id} value={p.id}>{(p.name || '').toUpperCase()}{p.throws ? ` (${p.throws}HP)` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {step2Pitchers.length === 0 && pitcherTeamFilter && (
                      <p className="text-xs text-muted-foreground">No pitchers on this team's roster yet.</p>
                    )}
                  </div>
                )}

                {/* Known pitchers from history — clicking one links stats */}
                {!usePen && knownPitcherNames.length > 0 && (
                  <div>
                    <Label className="mb-1.5 block">Known Pitchers <span className="text-muted-foreground text-xs">(tap to select — stats will accumulate)</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {knownPitcherNames.map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            setPitcherName(n);
                            setSelectedRosterPitcherId('');
                            const saved = getSavedRepertoire(n);
                            if (saved.length > 0) setPitcherRepertoire(saved);
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                            pitcherName === n
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card border-border hover:border-primary/50 text-foreground"
                          )}
                        >
                          {n.toUpperCase()} ★
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">★ = from pitch history</p>
                  </div>
                )}

                {!usePen && (
                <div>
                  <Label>Pitcher Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    value={pitcherName}
                    onChange={e => { setPitcherName(e.target.value); setSelectedRosterPitcherId(''); }}
                    placeholder="e.g. John Smith"
                    className="mt-1.5"
                  />
                </div>
                )}

                <div>
                  <Label className="mb-2 block">Throws</Label>
                  <div className="flex gap-3">
                    {['R', 'L'].map(h => (
                      <Button
                        key={h}
                        variant={pitcherHand === h ? 'default' : 'outline'}
                        className="flex-1 h-12 text-base font-bold"
                        onClick={() => setPitcherHand(h)}
                      >
                        {h === 'R' ? '✋ Right-Handed' : '🤚 Left-Handed'}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Pitch Repertoire <span className="text-muted-foreground text-xs">(select all that apply)</span></Label>
                  {pitcherName.trim() && pitcherRepertoire.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 mb-2">
                      ⚠️ No saved repertoire for {pitcherName.trim().toUpperCase()} — select pitches below to save for future games.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_PITCHES.map(pitch => (
                      <button
                        key={pitch.value}
                        onClick={() => togglePitch(pitch.value)}
                        className={cn(
                          "py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors text-left",
                          pitcherRepertoire.includes(pitch.value)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-border hover:border-primary/50"
                        )}
                      >
                        {pitch.label}
                      </button>
                    ))}
                  </div>
                  {pitcherRepertoire.length > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                      ✓ {pitcherRepertoire.length} pitch{pitcherRepertoire.length !== 1 ? 'es' : ''} selected — will be saved to this pitcher's profile.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full h-14 text-lg font-semibold"
              disabled={createGame.isPending}
              onClick={() => createGame.mutate()}
            >
              <Play className="w-5 h-5 mr-2" />
              {createGame.isPending ? 'Starting...' : 'Start Game'}
            </Button>
          </>
        )}
      </div>

      {/* Post-game-creation: go to Pen or straight to game */}
      <Dialog open={!!createdGameId} onOpenChange={() => {}}>
        <DialogContent className="max-w-xs" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Game Created!</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Would you like to set bullpen availability before the game starts?
          </p>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={() => navigate(`/BullpenManager?id=${createdGameId}`)}
            >
              🐂 Set Bullpen Availability
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 text-base font-semibold"
              onClick={() => navigate(createPageUrl('TrackGame') + `?id=${createdGameId}`)}
            >
              <Play className="w-4 h-4 mr-2" />
              Skip — Start Game
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}