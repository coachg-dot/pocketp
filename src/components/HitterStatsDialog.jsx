import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';

const RESULT_LABELS = {
  single: { label: '1B', color: 'bg-green-500' },
  double: { label: '2B', color: 'bg-green-600' },
  triple: { label: '3B', color: 'bg-green-700' },
  home_run: { label: 'HR', color: 'bg-yellow-500' },
  walk: { label: 'BB', color: 'bg-blue-500' },
  hbp: { label: 'HBP', color: 'bg-blue-400' },
  strikeout_swinging: { label: 'K', color: 'bg-red-500' },
  strikeout_looking: { label: 'Kl', color: 'bg-red-400' },
  groundout: { label: 'GO', color: 'bg-gray-500' },
  flyout: { label: 'FO', color: 'bg-gray-500' },
  lineout: { label: 'LO', color: 'bg-gray-500' },
  popout: { label: 'PO', color: 'bg-gray-400' },
  double_play: { label: 'DP', color: 'bg-gray-600' },
  fielders_choice: { label: 'FC', color: 'bg-gray-500' },
  sac_fly: { label: 'SF', color: 'bg-purple-400' },
  sac_bunt: { label: 'SB', color: 'bg-purple-500' },
  rbi_groundout: { label: 'RBIGO', color: 'bg-gray-500' },
  error: { label: 'E', color: 'bg-orange-500' },
  triple_play: { label: 'TP', color: 'bg-red-700' },
};

const isHit = (r) => ['single','double','triple','home_run'].includes(r);
const isAtBat = (r) => !['walk','hbp','sac_fly','sac_bunt'].includes(r);
const isOut = (r) => !isHit(r) && !['walk','hbp'].includes(r);

function calcStats(atBats) {
  const abs = atBats.filter(ab => isAtBat(ab.result));
  const hits = atBats.filter(ab => isHit(ab.result));
  const avg = abs.length > 0 ? (hits.length / abs.length).toFixed(3).replace('0.', '.') : '.000';
  const obp_denom = atBats.filter(ab => isAtBat(ab.result) || ['walk','hbp'].includes(ab.result)).length;
  const on_base = atBats.filter(ab => isHit(ab.result) || ['walk','hbp'].includes(ab.result)).length;
  const obp = obp_denom > 0 ? (on_base / obp_denom).toFixed(3).replace('0.', '.') : '.000';
  const total_bases = atBats.reduce((acc, ab) => {
    if (ab.result === 'single') return acc + 1;
    if (ab.result === 'double') return acc + 2;
    if (ab.result === 'triple') return acc + 3;
    if (ab.result === 'home_run') return acc + 4;
    return acc;
  }, 0);
  const slg = abs.length > 0 ? (total_bases / abs.length).toFixed(3).replace('0.', '.') : '.000';
  const ops_val = (parseFloat('0' + obp) + parseFloat('0' + slg)).toFixed(3).replace('0.', '.');
  const hrs = atBats.filter(ab => ab.result === 'home_run').length;
  const rbis = atBats.reduce((acc, ab) => acc + (ab.rbis || 0), 0);
  const ks = atBats.filter(ab => ab.result === 'strikeout_swinging' || ab.result === 'strikeout_looking').length;
  return { avg, obp, slg, ops: ops_val, hrs, rbis, ks, hits: hits.length, abs: abs.length };
}

export default function HitterStatsDialog({ open, onClose, player, currentGameId }) {
  const [tab, setTab] = useState('game');

  const { data: gameAtBats = [] } = useQuery({
    queryKey: ['atBats', currentGameId],
    queryFn: () => base44.entities.AtBat.filter({ game_id: currentGameId }, 'created_date'),
    enabled: !!currentGameId && open,
  });

  const { data: allAtBats = [], isLoading: allLoading } = useQuery({
    queryKey: ['allAtBats', player?.id],
    queryFn: () => base44.entities.AtBat.filter({ player_id: player?.id }, '-created_date'),
    enabled: !!player?.id && open && tab === 'alltime',
  });

  const playerGameABs = gameAtBats.filter(ab => ab.player_id === player?.id);
  const gameStats = calcStats(playerGameABs);
  const allStats = calcStats(allAtBats);

  if (!player) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {(player.name || '').toUpperCase()}
            {player.number && <span className="text-muted-foreground font-normal text-sm ml-2">#{player.number}</span>}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="game" className="flex-1">This Game</TabsTrigger>
            <TabsTrigger value="alltime" className="flex-1">All-Time</TabsTrigger>
          </TabsList>

          <TabsContent value="game" className="mt-3 space-y-3">
            {/* Stats bar */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[['AVG', gameStats.avg], ['OBP', gameStats.obp], ['SLG', gameStats.slg], ['OPS', gameStats.ops]].map(([k, v]) => (
                <div key={k} className="bg-muted/50 rounded-lg py-2">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="font-bold text-sm">{v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[['H', gameStats.hits], ['AB', gameStats.abs], ['HR', gameStats.hrs], ['RBI', gameStats.rbis]].map(([k, v]) => (
                <div key={k} className="bg-muted/30 rounded-lg py-1.5">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="font-semibold text-sm">{v}</p>
                </div>
              ))}
            </div>

            {/* At-bat history */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">At-Bats This Game</p>
              {playerGameABs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No at-bats yet</p>
              ) : (
                <div className="space-y-1.5">
                  {playerGameABs.map((ab, i) => {
                    const r = RESULT_LABELS[ab.result] || { label: ab.result, color: 'bg-gray-400' };
                    return (
                      <div key={ab.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Inn {ab.inning}</span>
                          <Badge className={`${r.color} text-white text-xs px-1.5 py-0`}>{r.label}</Badge>
                          {ab.rbis > 0 && <span className="text-xs text-muted-foreground">{ab.rbis} RBI</span>}
                        </div>
                        <span className="text-xs text-muted-foreground">{ab.balls}-{ab.strikes}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="alltime" className="mt-3 space-y-3">
            {allLoading ? (
              <div className="py-8 flex justify-center">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['AVG', allStats.avg], ['OBP', allStats.obp], ['SLG', allStats.slg], ['OPS', allStats.ops]].map(([k, v]) => (
                    <div key={k} className="bg-muted/50 rounded-lg py-2">
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="font-bold text-sm">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['H', allStats.hits], ['AB', allStats.abs], ['HR', allStats.hrs], ['RBI', allStats.rbis]].map(([k, v]) => (
                    <div key={k} className="bg-muted/30 rounded-lg py-1.5">
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="font-semibold text-sm">{v}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Recent At-Bats ({allAtBats.length} total)</p>
                  {allAtBats.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No history found</p>
                  ) : (
                    <div className="space-y-1.5">
                      {allAtBats.slice(0, 20).map((ab) => {
                        const r = RESULT_LABELS[ab.result] || { label: ab.result, color: 'bg-gray-400' };
                        return (
                          <div key={ab.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Badge className={`${r.color} text-white text-xs px-1.5 py-0`}>{r.label}</Badge>
                              {ab.rbis > 0 && <span className="text-xs text-muted-foreground">{ab.rbis} RBI</span>}
                            </div>
                            <span className="text-xs text-muted-foreground">{ab.balls}-{ab.strikes}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}