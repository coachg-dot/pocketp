import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, GitMerge, CheckCircle2, AlertCircle } from 'lucide-react';

export default function MergePitchersDialog({ open, onClose, pitcherNames = [] }) {
  const queryClient = useQueryClient();
  const [sourcePitcher, setSourcePitcher] = useState('');
  const [targetPitcher, setTargetPitcher] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleClose = () => {
    setSourcePitcher('');
    setTargetPitcher('');
    setSuccessMsg('');
    setErrorMsg('');
    onClose();
  };

  const merge = useMutation({
    mutationFn: async ({ from, to }) => {
      console.log('[MergePitchers] Starting merge:', from, '→', to);

      // Re-attribute all pitch records from "from" → "to"
      const pitches = await base44.entities.Pitch.filter({ pitcher_name: from });
      console.log('[MergePitchers] Pitches to reassign:', pitches.length);
      for (const p of pitches) {
        await base44.entities.Pitch.update(p.id, { pitcher_name: to });
      }

      // Re-attribute all at-bat records
      const atBats = await base44.entities.AtBat.filter({ pitcher_name: from });
      console.log('[MergePitchers] AtBats to reassign:', atBats.length);
      for (const ab of atBats) {
        await base44.entities.AtBat.update(ab.id, { pitcher_name: to });
      }

      // Delete the source pitcher from TeamPitcher roster
      const teamPitchers = await base44.entities.TeamPitcher.filter({ name: from });
      console.log('[MergePitchers] TeamPitchers to delete:', teamPitchers.length);
      for (const p of teamPitchers) {
        await base44.entities.TeamPitcher.delete(p.id);
      }

      // Delete the source pitcher from Player roster
      const players = await base44.entities.Player.filter({ name: from });
      console.log('[MergePitchers] Players to delete:', players.length);
      for (const p of players) {
        await base44.entities.Player.delete(p.id);
      }

      console.log('[MergePitchers] Merge complete.');
      return { pitches: pitches.length, atBats: atBats.length };
    },
    onSuccess: (data) => {
      console.log('[MergePitchers] onSuccess, invalidating queries.');
      queryClient.invalidateQueries({ queryKey: ['pitches-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['atBats-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['pitches-all-names'] });
      queryClient.invalidateQueries({ queryKey: ['gameData'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['teamPlayers'] });
      setSuccessMsg(`Merged ${data.pitches} pitch record(s) and ${data.atBats} at-bat record(s) successfully.`);
      setSourcePitcher('');
      setTargetPitcher('');
    },
    onError: (err) => {
      console.error('[MergePitchers] Merge failed:', err);
      setErrorMsg(err?.message || 'Merge failed. Please try again.');
    },
  });

  const canMerge = sourcePitcher && targetPitcher && sourcePitcher !== targetPitcher;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-4 h-4" /> Merge Pitchers
          </DialogTitle>
        </DialogHeader>

        {successMsg ? (
          <div className="space-y-4 pt-2">
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 dark:text-green-400">{successMsg}</p>
            </div>
            <Button className="w-full" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Merge all stats from one pitcher name into another. This re-assigns all pitch and at-bat records. The duplicate name will no longer appear.
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs mb-1.5 block">Merge FROM (duplicate)</Label>
                <Select value={sourcePitcher} onValueChange={(v) => { setSourcePitcher(v); setErrorMsg(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select pitcher to merge from…" />
                  </SelectTrigger>
                  <SelectContent>
                    {pitcherNames.map(n => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {sourcePitcher && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                  <span className="font-semibold text-foreground">{sourcePitcher}</span>
                  <ArrowRight className="w-4 h-4" />
                  <span>merged into</span>
                </div>
              )}

              <div>
                <Label className="text-xs mb-1.5 block">Merge INTO (keep this name)</Label>
                <Select value={targetPitcher} onValueChange={(v) => { setTargetPitcher(v); setErrorMsg(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target pitcher…" />
                  </SelectTrigger>
                  <SelectContent>
                    {pitcherNames.filter(n => n !== sourcePitcher).map(n => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {canMerge && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ This will move all records from <strong>{sourcePitcher}</strong> into <strong>{targetPitcher}</strong> and delete <strong>{sourcePitcher}</strong> from the roster. This cannot be undone.
                </div>
              )}

              {errorMsg && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400">{errorMsg}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
                <Button
                  className="flex-1"
                  disabled={!canMerge || merge.isPending}
                  onClick={() => {
                    setErrorMsg('');
                    merge.mutate({ from: sourcePitcher, to: targetPitcher });
                  }}
                >
                  {merge.isPending ? 'Merging…' : 'Merge Pitchers'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}