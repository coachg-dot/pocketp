import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FIELDERS, DIFFICULTY_LEVELS } from './FieldDifficultySetup';
import { DEFENSIVE_SHIFTS } from './DefensiveShiftSelector';
import FieldSVG from '../FieldSVG';

const RUNNER_LABELS = {
  none:          { label: 'Bases Empty', icon: '○○○' },
  first:         { label: 'Runner on 1st', icon: '○○●' },
  second:        { label: 'Runner on 2nd', icon: '○●○' },
  third:         { label: 'Runner on 3rd', icon: '●○○' },
  first_second:  { label: '1st & 2nd', icon: '○●●' },
  first_third:   { label: '1st & 3rd', icon: '●○●' },
  second_third:  { label: '2nd & 3rd', icon: '●●○' },
  bases_loaded:  { label: 'Bases Loaded', icon: '●●●' },
};

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

function BaseDiamond({ runners }) {
  const hasFirst  = ['first','first_second','first_third','bases_loaded'].includes(runners);
  const hasSecond = ['second','first_second','second_third','bases_loaded'].includes(runners);
  const hasThird  = ['third','first_third','second_third','bases_loaded'].includes(runners);
  const base = "hsl(30 40% 70%)";
  const active = "hsl(35 95% 55%)";

  return (
    <svg viewBox="0 0 60 60" className="w-20 h-20">
      {/* Field */}
      <circle cx="30" cy="45" r="32" fill="hsl(145 50% 35%)" />
      <path d="M 30 45 L 8 25 L 30 5 L 52 25 Z" fill="hsl(30 40% 55%)" />
      {/* Bases */}
      {/* 2nd base (top) */}
      <rect x="27" y="3" width="6" height="6" fill={hasSecond ? active : base} transform="rotate(45 30 6)" />
      {/* 3rd base (left) */}
      <rect x="5" y="22" width="6" height="6" fill={hasThird ? active : base} transform="rotate(45 8 25)" />
      {/* 1st base (right) */}
      <rect x="49" y="22" width="6" height="6" fill={hasFirst ? active : base} transform="rotate(45 52 25)" />
      {/* Home */}
      <polygon points="30,45 27,42 27,40 33,40 33,42" fill="white" />
    </svg>
  );
}

function getDiff(level) {
  return DIFFICULTY_LEVELS.find(d => d.value === level) ?? DIFFICULTY_LEVELS[0];
}

function FieldWithDifficulty({ difficulties, lf, cf, rf }) {
  return (
    <div className="w-full max-w-xs mx-auto" style={{ aspectRatio: '100/110' }}>
      <FieldSVG lf={lf} cf={cf} rf={rf} showFence={true} showPositionLabels={false} className="w-full h-full">
        {FIELDERS.map(f => {
          const level = difficulties?.[f.id] ?? 1;
          const diff = getDiff(level);
          return (
            <g key={f.id}>
              <circle cx={f.cx} cy={f.cy} r={diff.radius} fill={diff.color} opacity="0.25" stroke={diff.color} strokeWidth="0.6" strokeDasharray={level === 1 ? "2 2" : "none"} />
              <circle cx={f.cx} cy={f.cy} r="2.5" fill={diff.color} stroke="white" strokeWidth="0.8" />
              <text x={f.cx} y={f.cy - 4} textAnchor="middle" fill="white" fontSize="3" fontWeight="700">{f.label}</text>
            </g>
          );
        })}
      </FieldSVG>
      <div className="flex justify-center gap-3 mt-2 flex-wrap">
        {DIFFICULTY_LEVELS.map(d => (
          <div key={d.value} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
            <span className="text-[10px] text-muted-foreground">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ScenarioDisplay({ scenario, mode, difficulties, infieldShift, outfieldShift, lf = 300, cf = 350, rf = 300, currentPlayer }) {
  const { balls, strikes, outs, inning, runners, hitterSide, pitcherSide } = scenario;
  const runnerInfo = RUNNER_LABELS[runners] ?? RUNNER_LABELS['none'];

  return (
    <Card className="border-2 border-primary/30 bg-primary/5">
      <CardContent className="pt-5 pb-5 space-y-5">

        {/* Title */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            {mode === 'hitting' ? 'Hitting Scenario' : 'Pitching Scenario'}
          </p>
          {currentPlayer && (
            <p className="text-sm font-semibold text-primary mb-1">{currentPlayer}</p>
          )}
          <p className="text-2xl font-bold">{ordinal(inning)} Inning</p>
        </div>

        {/* Count + Outs row */}
        <div className="flex justify-center gap-6 text-center">
          <div>
            <p className="text-4xl font-bold text-primary">{balls}-{strikes}</p>
            <p className="text-xs text-muted-foreground mt-1">Count</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-4xl font-bold">{outs}</p>
            <p className="text-xs text-muted-foreground mt-1">{outs === 1 ? 'Out' : 'Outs'}</p>
          </div>
        </div>

        {/* Runners */}
        <div className="flex flex-col items-center gap-2">
          <BaseDiamond runners={runners} />
          <p className="text-sm font-semibold">{runnerInfo.label}</p>
        </div>

        {/* Defensive shifts (hitting only) */}
        {mode === 'hitting' && (infieldShift || outfieldShift) && (() => {
          const inf = DEFENSIVE_SHIFTS.find(s => s.id === infieldShift);
          const out = DEFENSIVE_SHIFTS.find(s => s.id === outfieldShift);
          return (
            <div className="flex justify-center gap-3 flex-wrap">
              {inf && inf.id !== 'standard' && (
                <div className="flex items-center gap-1.5 bg-secondary rounded-lg px-3 py-1.5">
                  <span className="text-base">{inf.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold leading-tight">IF: {inf.label}</p>
                    <p className="text-[10px] text-muted-foreground">{inf.desc}</p>
                  </div>
                </div>
              )}
              {out && out.id !== 'of_standard' && (
                <div className="flex items-center gap-1.5 bg-secondary rounded-lg px-3 py-1.5">
                  <span className="text-base">{out.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold leading-tight">OF: {out.label}</p>
                    <p className="text-[10px] text-muted-foreground">{out.desc}</p>
                  </div>
                </div>
              )}
              {inf?.id === 'standard' && out?.id === 'of_standard' && (
                <p className="text-xs text-muted-foreground">Standard alignment</p>
              )}
            </div>
          );
        })()}

        {/* Field difficulty (hitting only) */}
        {mode === 'hitting' && difficulties && (
          <FieldWithDifficulty difficulties={difficulties} lf={lf} cf={cf} rf={rf} />
        )}

        {/* Handedness badges */}
        <div className="flex justify-center gap-3 flex-wrap">
          <Badge variant="secondary" className="text-sm px-4 py-1.5">
            {hitterSide === 'right' ? '🏏 RHH' : '🏏 LHH'} — {hitterSide}-handed batter
          </Badge>
          {mode === 'hitting' && pitcherSide && (
            <Badge variant="outline" className="text-sm px-4 py-1.5">
              ⚾ {pitcherSide === 'right' ? 'RHP' : 'LHP'} — {pitcherSide}-handed pitcher
            </Badge>
          )}
        </div>

      </CardContent>
    </Card>
  );
}