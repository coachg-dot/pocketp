import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Trophy, ChevronRight, ArrowLeft, User, Share2, Download } from 'lucide-react';
import PitcherGameLog from './PitcherGameLog';
import { shareStatsImage } from './shareStats';

function exportGameCSV(game, pitcherName, pitches, atBats) {
  const rows = [
    ['Pitcher','Game','Date','IP','PC','K','BB','H','HBP'],
    [
      pitcherName,
      `vs ${game.opponent}`,
      game.date,
      (() => { const outs = atBats.reduce((a,ab) => a + (ab.result==='double_play'?2:ab.result==='triple_play'?3:['strikeout_swinging','strikeout_looking','groundout','flyout','lineout','popout','bunt_out','rbi_groundout','sac_fly','sac_bunt','fielders_choice','in_play_out'].includes(ab.result)?1:0), 0); return `${Math.floor(outs/3)}.${outs%3}`; })(),
      pitches.length,
      atBats.filter(ab=>ab.result?.includes('strikeout')).length,
      atBats.filter(ab=>ab.result==='walk').length,
      atBats.filter(ab=>['single','double','triple','home_run','bunt_single'].includes(ab.result)).length,
      atBats.filter(ab=>ab.result==='hbp').length,
    ],
  ];
  const csv = rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`${pitcherName}_${game.opponent}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function GameSummary({ game, open, onClose }) {
  const [selectedPitcher, setSelectedPitcher] = useState(null);

  const { data: gameData = {} } = useQuery({
    queryKey: ['gameData-summary', game?.id],
    queryFn: async () => {
      const [pitches, atBats] = await Promise.all([
        base44.entities.Pitch.filter({ game_id: game.id }),
        base44.entities.AtBat.filter({ game_id: game.id }),
      ]);
      return { pitches, atBats };
    },
    enabled: !!game?.id && open,
  });
  const atBats = gameData.atBats || [];
  const pitches = gameData.pitches || [];

  if (!game) return null;

  // All distinct pitcher names from pitch records (primary source)
  const pitcherNamesAll = [...new Set(pitches.map(p => p.pitcher_name).filter(Boolean))];

  // Map each at_bat_id to pitcher via pitch records
  const atBatToPitcher = {};
  pitches.forEach(p => {
    if (p.at_bat_id && p.pitcher_name) {
      atBatToPitcher[p.at_bat_id] = p.pitcher_name;
    }
  });

  // Filter at-bats per pitcher: pitch linkage first, then AtBat.pitcher_name field
  const atBatsForPitcher = (name) => {
    const seen = new Set();
    return atBats.filter(ab => {
      const match = atBatToPitcher[ab.id] === name || ab.pitcher_name === name;
      if (!match || seen.has(ab.id)) return false;
      seen.add(ab.id);
      return true;
    });
  };

  // At-bats truly unlinked (no pitch record AND no pitcher_name on the at-bat)
  const unlinkedAtBats = atBats.filter(ab => !atBatToPitcher[ab.id] && !ab.pitcher_name);

  // Use pitch-based names if available, otherwise fall back to at-bat pitcher_name fields
  const pitcherNamesFromABs = [...new Set(atBats.map(ab => ab.pitcher_name).filter(Boolean))];
  const allPitcherNames = pitcherNamesAll.length > 0
    ? pitcherNamesAll
    : pitcherNamesFromABs;

  const pitcherName = allPitcherNames[0] || '';

  // For at-bats-only pitcher lookup (when pitch records are inaccessible)
  const atBatsForPitcherByName = (name) => atBats.filter(ab => ab.pitcher_name === name);

  // When sheet closes, reset pitcher selection
  const handleClose = () => {
    setSelectedPitcher(null);
    onClose();
  };

  // Determine what to show inside the sheet
  const showPitcherList = !selectedPitcher;

  // Quick summary stats for pitcher list cards
  const OUT_RESULTS_QS = ['strikeout_swinging','strikeout_looking','groundout','flyout','lineout','popout','bunt_out','rbi_groundout','sac_fly','sac_bunt','fielders_choice','in_play_out'];
  const pitcherQuickStats = (name) => {
    const p = pitches.filter(px => px.pitcher_name === name);
    const ab = [...atBatsForPitcher(name), ...(pitcherNamesAll.length === 0 && allPitcherNames[0] === name ? unlinkedAtBats : [])];
    const ks = ab.filter(a => a.result?.includes('strikeout')).length;
    const bbs = ab.filter(a => a.result === 'walk').length;
    const totalOuts = ab.reduce((acc, a) => {
      if (a.result === 'double_play') return acc + 2;
      if (a.result === 'triple_play') return acc + 3;
      return OUT_RESULTS_QS.includes(a.result) ? acc + 1 : acc;
    }, 0);
    const full = Math.floor(totalOuts / 3), rem = totalOuts % 3;
    const ip = rem === 0 ? `${full}.0` : `${full}.${rem}`;
    return { pc: p.length, ks, bbs, ip };
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">

        {/* Header — changes based on view */}
        <SheetHeader className="text-left mb-4">
          {selectedPitcher ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedPitcher(null)} className="p-1 -ml-1 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <SheetTitle className="text-base">{selectedPitcher.name.toUpperCase()}</SheetTitle>
                <p className="text-xs text-muted-foreground">vs {game.opponent} · {game.date ? format(new Date(game.date + 'T12:00:00'), 'MMM d, yyyy') : ''}</p>
              </div>
            </div>
          ) : (
            <>
              <SheetTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-accent" />
                vs {game.opponent}
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {game.date ? format(new Date(game.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy') : ''}
                {game.location && ` • ${game.location}`}
                {game.status === 'final' && (
                  <Badge className="ml-2 bg-green-100 text-green-700 text-xs">Final</Badge>
                )}
              </p>
            </>
          )}
        </SheetHeader>

        {/* Pitcher detail view */}
        {selectedPitcher && (
          <>
            <div>
              <PitcherGameLog
                pitches={pitches.filter(p => p.pitcher_name === selectedPitcher.name)}
                atBats={[...atBatsForPitcher(selectedPitcher.name), ...(selectedPitcher.idx === 0 ? unlinkedAtBats : [])]}
                pitcherName={selectedPitcher.name}
              />
            </div>
            <div className="flex gap-2 pt-4 pb-2">
              <Button
                variant="outline"
                onClick={() => exportGameCSV(
                  game,
                  selectedPitcher.name,
                  pitches.filter(p => p.pitcher_name === selectedPitcher.name),
                  [...atBatsForPitcher(selectedPitcher.name), ...(selectedPitcher.idx === 0 ? unlinkedAtBats : [])],
                )}
                className="flex-1 gap-2"
              >
                <Download className="w-4 h-4" /> Export CSV
              </Button>
              <Button
                onClick={() => shareStatsImage({
                  game,
                  pitcherName: selectedPitcher.name,
                  pitches: pitches.filter(p => p.pitcher_name === selectedPitcher.name),
                  atBats: [...atBatsForPitcher(selectedPitcher.name), ...(selectedPitcher.idx === 0 ? unlinkedAtBats : [])],
                })}
                className="flex-1 gap-2"
              >
                <Share2 className="w-4 h-4" /> Share
              </Button>
            </div>
          </>
        )}

        {/* Pitcher list view */}
        {!selectedPitcher && (
          <>
            {allPitcherNames.length === 0 && pitches.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3 mb-3 text-xs text-amber-700 dark:text-amber-400">
                ⚠️ {pitches.length} pitches recorded but no pitcher name assigned.
              </div>
            )}

            {allPitcherNames.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Select a pitcher to view stats</p>
                {allPitcherNames.map((name, idx) => {
                  const qs = pitcherQuickStats(name, idx);
                  return (
                    <button
                      key={name}
                      onClick={() => setSelectedPitcher({ name, idx })}
                      className="w-full flex items-center gap-3 bg-muted/40 hover:bg-muted/70 rounded-xl p-4 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{name.toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">{qs.ip} IP · {qs.pc} pitches · {qs.ks} K · {qs.bbs} BB</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            ) : (
              // No pitchers linked — show full log
              <>
                <div>
                  <PitcherGameLog pitches={pitches} atBats={atBats} pitcherName={pitcherName} />
                </div>
                <div className="flex gap-2 pt-4 pb-2">
                  <Button
                    variant="outline"
                    onClick={() => exportGameCSV(game, pitcherName, pitches, atBats)}
                    className="flex-1 gap-2"
                  >
                    <Download className="w-4 h-4" /> Export CSV
                  </Button>
                  <Button
                    onClick={() => shareStatsImage({ game, pitcherName, pitches, atBats })}
                    className="flex-1 gap-2"
                  >
                    <Share2 className="w-4 h-4" /> Share
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}