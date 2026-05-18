import React from 'react';
import FieldSVG from '../FieldSVG';

const HIT_COLORS = {
  single:   'hsl(145 63% 42%)',
  double:   'hsl(200 70% 50%)',
  triple:   'hsl(280 60% 55%)',
  home_run: 'hsl(0 84% 60%)',
  bunt_single: 'hsl(145 63% 42%)',
  out:      'hsl(35 80% 55%)',
};
const HIT_RESULTS = ['single', 'double', 'triple', 'home_run', 'bunt_single'];
const OUT_RESULTS = ['groundout','flyout','lineout','popout','strikeout_swinging',
  'strikeout_looking','fielders_choice','double_play','triple_play','rbi_groundout'];

export default function BatterSprayMini({ atBats }) {
  const relevant = atBats.filter(ab =>
    (HIT_RESULTS.includes(ab.result) || OUT_RESULTS.includes(ab.result)) &&
    ab.hit_location_x != null && ab.hit_location_y != null
  );

  const hitCount = relevant.filter(ab => HIT_RESULTS.includes(ab.result)).length;

  return (
    <div>
      <div className="relative w-full max-w-[200px] mx-auto" style={{ aspectRatio: '100/110' }}>
        <FieldSVG showFence showPositionLabels={false} className="w-full h-full">
          {relevant.map((ab, i) => {
            const isOut = OUT_RESULTS.includes(ab.result);
            const color = isOut ? HIT_COLORS.out : (HIT_COLORS[ab.result] ?? 'white');
            return (
              <g key={i}>
                <circle cx={ab.hit_location_x} cy={ab.hit_location_y} r="3.5" fill={color} stroke="white" strokeWidth="0.8" opacity="0.85" />
                {isOut && (
                  <>
                    <line x1={ab.hit_location_x-2} y1={ab.hit_location_y-2} x2={ab.hit_location_x+2} y2={ab.hit_location_y+2} stroke="white" strokeWidth="0.8" />
                    <line x1={ab.hit_location_x+2} y1={ab.hit_location_y-2} x2={ab.hit_location_x-2} y2={ab.hit_location_y+2} stroke="white" strokeWidth="0.8" />
                  </>
                )}
              </g>
            );
          })}
        </FieldSVG>
      </div>
      {relevant.length === 0 ? (
        <p className="text-center text-[10px] text-muted-foreground mt-1">No hit locations logged</p>
      ) : (
        <p className="text-center text-[10px] text-muted-foreground mt-1">{hitCount}H / {relevant.length} BIP plotted</p>
      )}
    </div>
  );
}