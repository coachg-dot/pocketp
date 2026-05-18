import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const HANDEDNESS = ['R', 'L', 'S'];

export default function HitterSubstitutionDialog({ open, onClose, lineup, rosterPlayers, onConfirm }) {
  const [replacingIndex, setReplacingIndex] = useState(null);
  const [subName, setSubName] = useState('');
  const [subHand, setSubHand] = useState('R');
  const [fromRosterId, setFromRosterId] = useState('');

  const availableRoster = rosterPlayers.filter(p => !lineup.find(l => l.id === p.id));

  const handleRosterSelect = (id) => {
    setFromRosterId(id);
    const p = rosterPlayers.find(pl => pl.id === id);
    if (p) {
      setSubName(p.name);
      setSubHand(p.bats || 'R');
    }
  };

  const handleConfirm = () => {
    if (replacingIndex === null || !subName.trim()) return;
    const newPlayer = fromRosterId
      ? { ...rosterPlayers.find(p => p.id === fromRosterId), hand: subHand, isPinchHitter: true, replacedPlayer: lineup[replacingIndex]?.name }
      : { id: `sub-${Date.now()}`, name: subName.trim(), hand: subHand, isPinchHitter: true, replacedPlayer: lineup[replacingIndex]?.name };
    onConfirm(replacingIndex, newPlayer);
    // reset
    setReplacingIndex(null);
    setSubName('');
    setSubHand('R');
    setFromRosterId('');
    onClose();
  };

  const handleClose = () => {
    setReplacingIndex(null);
    setSubName('');
    setSubHand('R');
    setFromRosterId('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Substitute Hitter</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Who is being replaced */}
          <div>
            <Label className="text-sm">Replace</Label>
            <Select value={replacingIndex?.toString() ?? ''} onValueChange={v => setReplacingIndex(parseInt(v))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select player to replace" />
              </SelectTrigger>
              <SelectContent>
                {lineup.map((p, i) => (
                  <SelectItem key={i} value={i.toString()}>{i + 1}. {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From roster */}
          {availableRoster.length > 0 && (
            <div>
              <Label className="text-sm">From Roster (optional)</Label>
              <Select value={fromRosterId} onValueChange={handleRosterSelect}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pick from roster" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoster.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.bats ? ` (${p.bats})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Manual name */}
          <div>
            <Label className="text-sm">Sub Name</Label>
            <Input
              value={subName}
              onChange={e => { setSubName(e.target.value); setFromRosterId(''); }}
              placeholder="Enter name"
              className="mt-1"
            />
          </div>

          {/* Handedness */}
          <div>
            <Label className="text-sm">Bats</Label>
            <div className="flex gap-2 mt-1">
              {HANDEDNESS.map(h => (
                <Button
                  key={h}
                  size="sm"
                  variant={subHand === h ? 'default' : 'outline'}
                  onClick={() => setSubHand(h)}
                  className="flex-1"
                >
                  {h}
                </Button>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            disabled={replacingIndex === null || !subName.trim()}
            onClick={handleConfirm}
          >
            Substitute
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}