import React from 'react';

/**
 * Shared baseball field SVG.
 * viewBox: 0 0 100 110  (extra bottom space for home plate / catcher)
 * 
 * Coordinate reference (approximate):
 *   Home plate:  (50, 100)
 *   1st base:    (75, 75)
 *   2nd base:    (50, 50)
 *   3rd base:    (25, 75)
 *   Pitcher:     (50, 65)
 *
 * Fence dimensions (default: lf=300, cf=350, rf=300) affect how far the
 * outfield arc is drawn. Max real-world dimension is ~420', mapped to the SVG.
 */

const MAX_FEET = 440; // feet that map to the full SVG radius

export function feetToSvgRadius(feet) {
  // home plate is at y=100; arc top at ~y=0 ≈ 100 svg units above home
  return (feet / MAX_FEET) * 100;
}

export default function FieldSVG({
  lf = 300, cf = 350, rf = 300,
  showFence = false,
  showPositionLabels = true,
  children,
  className = "w-full h-full",
}) {
  // Build an SVG arc for the outfield fence
  // We approximate with 3 points: LF corner, CF top, RF corner
  // then draw quadratic/cubic bezier arcs.

  // Convert fence depths to SVG coordinates.
  // Home = (50, 100). Directions:
  //   Dead CF = straight up → (50, 100 - lfRad)  [using cf]
  //   LF line corner ≈ 45° left  → (50 - r*sin45, 100 - r*cos45)  [using lf]
  //   RF line corner ≈ 45° right → (50 + r*sin45, 100 - r*cos45)  [using rf]
  const lfR  = feetToSvgRadius(lf);
  const cfR  = feetToSvgRadius(cf);
  const rfR  = feetToSvgRadius(rf);

  const sin45 = Math.sin(Math.PI / 4);
  const cos45 = Math.cos(Math.PI / 4);

  const lfX = 50 - lfR * sin45;
  const lfY = 100 - lfR * cos45;
  const cfX = 50;
  const cfY = 100 - cfR;
  const rfX = 50 + rfR * sin45;
  const rfY = 100 - rfR * cos45;

  // Foul line extensions (beyond fence)
  const foulExt = 1.08;
  const lfFoulX = 50 - lfR * foulExt * sin45;
  const lfFoulY = 100 - lfR * foulExt * cos45;
  const rfFoulX = 50 + rfR * foulExt * sin45;
  const rfFoulY = 100 - rfR * foulExt * cos45;

  // Fence path: line from LF foul → LF corner, cubic bezier to CF, to RF corner, to RF foul
  const fencePath = `M ${lfFoulX} ${lfFoulY} L ${lfX} ${lfY} Q ${cfX - 5} ${cfY + 2} ${cfX} ${cfY} Q ${cfX + 5} ${cfY + 2} ${rfX} ${rfY} L ${rfFoulX} ${rfFoulY}`;

  return (
    <svg viewBox="0 0 100 110" className={className}>
      {/* Sky/background */}
      <rect width="100" height="110" fill="hsl(145 50% 35%)" />

      {/* Outfield grass (large arc) */}
      <path
        d={`M 50 100 L ${lfFoulX} ${lfFoulY} Q ${cfX} ${cfY - 5} ${rfFoulX} ${rfFoulY} Z`}
        fill="hsl(145 50% 33%)"
      />

      {/* Infield dirt - proper diamond size: home→3B→2B→1B is 90ft; scale: ~32 svg units for 90ft */}
      {/* Home(50,100) 1B(75,75) 2B(50,50) 3B(25,75) */}
      <path d="M 50 100 L 75 75 L 50 50 L 25 75 Z" fill="hsl(30 40% 55%)" />

      {/* Inner grass circle around mound */}
      <circle cx="50" cy="72" r="10" fill="hsl(145 50% 38%)" />

      {/* Baselines */}
      <line x1="50" y1="100" x2="25" y2="75"  stroke="white" strokeWidth="0.6" opacity="0.7" />
      <line x1="50" y1="100" x2="75" y2="75"  stroke="white" strokeWidth="0.6" opacity="0.7" />
      <line x1="25" y1="75"  x2="50" y2="50"  stroke="white" strokeWidth="0.6" opacity="0.7" />
      <line x1="75" y1="75"  x2="50" y2="50"  stroke="white" strokeWidth="0.6" opacity="0.7" />

      {/* Foul lines */}
      <line x1="50" y1="100" x2={lfFoulX} y2={lfFoulY} stroke="white" strokeWidth="0.5" opacity="0.6" />
      <line x1="50" y1="100" x2={rfFoulX} y2={rfFoulY} stroke="white" strokeWidth="0.5" opacity="0.6" />

      {/* Fence arc */}
      {showFence && (
        <path d={fencePath} fill="none" stroke="hsl(35 95% 65%)" strokeWidth="1" opacity="0.9" strokeDasharray="3 2" />
      )}

      {/* Bases */}
      {/* Home plate */}
      <polygon points="50,100 47.5,97.5 47.5,96 52.5,96 52.5,97.5" fill="white" />
      {/* 3rd base (25,75) */}
      <rect x="22.5" y="72.5" width="5" height="5" fill="white" transform="rotate(45 25 75)" />
      {/* 2nd base (50,50) */}
      <rect x="47.5" y="47.5" width="5" height="5" fill="white" transform="rotate(45 50 50)" />
      {/* 1st base (75,75) */}
      <rect x="72.5" y="72.5" width="5" height="5" fill="white" transform="rotate(45 75 75)" />

      {/* Pitcher's mound */}
      <circle cx="50" cy="72" r="2.5" fill="hsl(30 35% 50%)" />
      <rect x="49" y="71.5" width="2" height="0.8" fill="white" />

      {/* Position labels */}
      {showPositionLabels && (
        <>
          {/* Outfielders: placed inside the outfield grass, well inside fence and foul lines, above infield */}
          <text x={cfX}                        y={100 - cfR * 0.60}          textAnchor="middle" fill="white" fontSize="3.5" fontWeight="600" opacity="0.9">CF</text>
          <text x={50 - lfR * sin45 * 0.52}    y={100 - lfR * cos45 * 0.72} textAnchor="middle" fill="white" fontSize="3.5" fontWeight="600" opacity="0.9">LF</text>
          <text x={50 + rfR * sin45 * 0.52}    y={100 - rfR * cos45 * 0.72} textAnchor="middle" fill="white" fontSize="3.5" fontWeight="600" opacity="0.9">RF</text>
          {/* Infielders */}
          <text x="35"  y="62"  textAnchor="middle" fill="white" fontSize="3"   fontWeight="600" opacity="0.8">SS</text>
          <text x="65"  y="62"  textAnchor="middle" fill="white" fontSize="3"   fontWeight="600" opacity="0.8">2B</text>
          <text x="17"  y="78"  textAnchor="middle" fill="white" fontSize="3"   fontWeight="600" opacity="0.8">3B</text>
          <text x="83"  y="78"  textAnchor="middle" fill="white" fontSize="3"   fontWeight="600" opacity="0.8">1B</text>
          <text x="50"  y="80"  textAnchor="middle" fill="white" fontSize="3"   fontWeight="600" opacity="0.8">P</text>
          <text x="50"  y="108" textAnchor="middle" fill="white" fontSize="3"   fontWeight="600" opacity="0.8">C</text>
        </>
      )}

      {/* Fence distance labels */}
      {showFence && (
        <>
          <text x={lfX - 4}  y={lfY + 3}  textAnchor="middle" fill="hsl(35 95% 75%)" fontSize="3" fontWeight="700">{lf}'</text>
          <text x={cfX}      y={cfY + 5}   textAnchor="middle" fill="hsl(35 95% 75%)" fontSize="3" fontWeight="700">{cf}'</text>
          <text x={rfX + 4}  y={rfY + 3}   textAnchor="middle" fill="hsl(35 95% 75%)" fontSize="3" fontWeight="700">{rf}'</text>
        </>
      )}

      {/* Extra content (markers, fielders, etc.) */}
      {children}
    </svg>
  );
}