import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const BASE_LABELS = { first: '1st Base', second: '2nd Base', third: '3rd Base' };

export default function CaughtStealingDialog({ open, onClose, basesState, onConfirm }) {
  const [selected, setSelected] = useState(null);

  const runnersOn = Object.entries(basesState)
    .filter(([, occupied]) => occupied)
    .map(([base]) => base);

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm(selected);
    setSelected(null);
  };

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xs" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>⚡ Caught Stealing</DialogTitle>
        </DialogHeader>
        {runnersOn.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No runners on base.
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3">Which runner was caught stealing?</p>
            <div className="space-y-2">
              {runnersOn.map(base => (
                <button
                  key={base}
                  onClick={() => setSelected(base)}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-semibold border-2 transition-all text-left ${
                    selected === base
                      ? 'bg-destructive/10 border-destructive text-destructive'
                      : 'bg-muted border-transparent hover:border-muted-foreground/30'
                  }`}
                >
                  Runner on {BASE_LABELS[base]}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
              <Button
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={!selected}
                onClick={handleConfirm}
              >
                Record Out
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}