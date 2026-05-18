import React from 'react';
import FieldSVG from './FieldSVG';

export default function BaseballDiamond({ onLocationSelect, selectedLocation, lf = 300, cf = 350, rf = 300 }) {
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    // y scaled to viewBox height 110
    const y = ((e.clientY - rect.top) / rect.height) * 110;
    onLocationSelect({ x: Math.round(x), y: Math.round(y) });
  };

  return (
    <div className="relative w-full max-w-sm mx-auto touch-target">
      <div className="cursor-crosshair" onClick={handleClick} style={{ aspectRatio: '100/110' }}>
        <FieldSVG lf={lf} cf={cf} rf={rf} showFence={true} showPositionLabels={true}>
          {selectedLocation && (
            <g>
              <circle
                cx={selectedLocation.x}
                cy={selectedLocation.y}
                r="4"
                fill="hsl(0 84% 60%)"
                stroke="white"
                strokeWidth="1.5"
              />
              <circle
                cx={selectedLocation.x}
                cy={selectedLocation.y}
                r="1.5"
                fill="white"
              />
            </g>
          )}
        </FieldSVG>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-2">
        Tap to mark where the ball was hit
      </p>
    </div>
  );
}