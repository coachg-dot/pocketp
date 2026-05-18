import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from 'lucide-react';

const DOT_OPTIONS = [
  { value: 'red',    label: 'Danger',  bg: 'bg-red-500',    border: 'border-red-500',    ring: 'ring-red-400' },
  { value: 'yellow', label: 'Caution', bg: 'bg-yellow-400', border: 'border-yellow-400', ring: 'ring-yellow-300' },
  { value: 'green',  label: 'Attack',  bg: 'bg-green-500',  border: 'border-green-500',  ring: 'ring-green-400' },
];

export function ApproachDot({ color, size = 'sm' }) {
  if (!color) return null;
  const dot = DOT_OPTIONS.find(d => d.value === color);
  if (!dot) return null;
  const sizeClass = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
  return (
    <span className={`inline-block rounded-full shrink-0 ${sizeClass} ${dot.bg}`} title={dot.label} />
  );
}

export default function HitterApproachStep({ lineup, approaches, onApproachChange, onContinue }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Hitter Approach</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tag each hitter with a scouting dot — optional but helpful during the game.
          </p>
        </CardHeader>
        <CardContent className="space-y-1 pb-3">
          {/* Legend */}
          <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
            {DOT_OPTIONS.map(d => (
              <span key={d.value} className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${d.bg}`} />
                {d.label}
              </span>
            ))}
          </div>

          {lineup.map((batter, idx) => {
            const current = approaches[batter.id || batter.name] || null;
            return (
              <div
                key={batter.id || batter.name}
                className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0"
              >
                {/* Order + name */}
                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{idx + 1}.</span>
                {batter.jerseyNumber && (
                  <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">#{batter.jerseyNumber}</span>
                )}
                <span className="flex-1 text-sm font-semibold truncate">{(batter.name || '').toUpperCase()}</span>

                {/* Dot selector */}
                <div className="flex gap-2 shrink-0">
                  {DOT_OPTIONS.map(dot => (
                    <button
                      key={dot.value}
                      onClick={() =>
                        onApproachChange(
                          batter.id || batter.name,
                          current === dot.value ? null : dot.value
                        )
                      }
                      className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center
                        ${dot.bg}
                        ${current === dot.value
                          ? `${dot.border} ring-2 ${dot.ring} scale-110`
                          : 'opacity-30 border-transparent hover:opacity-70'
                        }`}
                      title={dot.label}
                    />
                  ))}
                  {/* Clear button — only when assigned */}
                  {current && (
                    <button
                      onClick={() => onApproachChange(batter.id || batter.name, null)}
                      className="w-7 h-7 rounded-full border-2 border-border text-muted-foreground text-xs flex items-center justify-center hover:border-destructive hover:text-destructive transition-colors"
                      title="Clear"
                    >×</button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Button className="w-full h-14 text-lg font-semibold" onClick={onContinue}>
        Next: Set Opposing Pitcher
        <ChevronRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );
}