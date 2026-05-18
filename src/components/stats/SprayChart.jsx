import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from 'lucide-react';
import FieldSVG from '../FieldSVG';

const HIT_COLORS = {
  single:   { fill: 'hsl(145 63% 42%)', label: '1B' },
  double:   { fill: 'hsl(200 70% 50%)', label: '2B' },
  triple:   { fill: 'hsl(280 60% 55%)', label: '3B' },
  home_run: { fill: 'hsl(0 84% 60%)',   label: 'HR' },
  out:      { fill: 'hsl(35 80% 55%)',  label: 'Out' },
};

const HIT_RESULTS = ['single', 'double', 'triple', 'home_run'];
const OUT_RESULTS = ['groundout','flyout','lineout','popout','strikeout_swinging','strikeout_looking','fielders_choice','double_play','triple_play','rbi_groundout'];

export default function SprayChart({ atBats, players }) {
  const [selectedPlayer, setSelectedPlayer] = useState('team');

  const isRelevant = ab => (HIT_RESULTS.includes(ab.result) || OUT_RESULTS.includes(ab.result)) && ab.hit_location_x != null && ab.hit_location_y != null;

  const filteredAtBats = selectedPlayer === 'team'
    ? atBats.filter(isRelevant)
    : atBats.filter(ab => ab.player_id === selectedPlayer && isRelevant(ab));

  const counts = { single: 0, double: 0, triple: 0, home_run: 0, out: 0 };
  filteredAtBats.forEach(ab => {
    if (HIT_RESULTS.includes(ab.result)) counts[ab.result]++;
    else if (OUT_RESULTS.includes(ab.result)) counts.out++;
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Spray Chart
          </CardTitle>
          <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">Entire Team</SelectItem>
              {players.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '100/110' }}>
          <FieldSVG showFence={true} showPositionLabels={true} className="w-full h-full">
            {filteredAtBats.map((ab, i) => {
              const isOut = OUT_RESULTS.includes(ab.result);
              const color = isOut ? HIT_COLORS.out.fill : (HIT_COLORS[ab.result]?.fill ?? 'white');
              return (
                <g key={i}>
                  <circle cx={ab.hit_location_x} cy={ab.hit_location_y} r="3" fill={color} stroke="white" strokeWidth="0.8" opacity="0.85" />
                  {isOut && <line x1={ab.hit_location_x - 2} y1={ab.hit_location_y - 2} x2={ab.hit_location_x + 2} y2={ab.hit_location_y + 2} stroke="white" strokeWidth="0.8" />}
                  {isOut && <line x1={ab.hit_location_x + 2} y1={ab.hit_location_y - 2} x2={ab.hit_location_x - 2} y2={ab.hit_location_y + 2} stroke="white" strokeWidth="0.8" />}
                </g>
              );
            })}
          </FieldSVG>
        </div>

        {filteredAtBats.length === 0 && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            No hit locations recorded yet
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-3 mt-3">
          {Object.entries(HIT_COLORS).map(([result, { fill, label }]) => (
            <div key={result} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full border border-white/30" style={{ background: fill }} />
              <span className="text-xs text-muted-foreground">{label} ({counts[result]})</span>
            </div>
          ))}
          {filteredAtBats.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              · {filteredAtBats.length} total hits plotted
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}