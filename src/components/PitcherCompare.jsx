import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Scale, Download, Share2 } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
} from 'recharts';

const PITCH_LABEL = {
  '4seam':'4-Seam','2seam':'2-Seam','fastball':'FB','sinker':'Sinker',
  'cutter':'Cutter','slider':'SL','sweeper':'SWP','slurve':'Slurve',
  'curveball':'CB','knuckle_curve':'KC','changeup':'CH',
  'splitter':'SPL','knuckleball':'KN','eephus':'EEP',
};

const COLOR_A = 'hsl(145 63% 42%)';  // primary green
const COLOR_B = '#f97316';            // orange

function fmt(n, dec = 2) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—';
  return Number(n).toFixed(dec);
}

// Normalize a value to 0-100 where higher = better for the pitcher
function normalize(value, min, max, invert = false) {
  if (value == null || isNaN(value)) return 0;
  const clamped = Math.min(Math.max(value, min), max);
  const pct = ((clamped - min) / (max - min)) * 100;
  return invert ? 100 - pct : pct;
}

const RADAR_METRICS = [
  { key: 'kPct',      label: 'K%',      min: 0,  max: 40,  invert: false },
  { key: 'strikePct', label: 'Strike%', min: 40, max: 75,  invert: false },
  { key: 'whiffPct',  label: 'Whiff%',  min: 0,  max: 50,  invert: false },
  { key: 'weakPct',   label: 'Weak%',   min: 0,  max: 80,  invert: false },
  { key: 'bbPct',     label: 'BB%',     min: 0,  max: 20,  invert: true  },
  { key: 'whip',      label: 'WHIP',    min: 0,  max: 3,   invert: true  },
];

const KEY_METRICS = [
  { key: 'ip',           label: 'IP',      raw: true },
  { key: 'totalPitches', label: 'PC',      dec: 0 },
  { key: 'bf',           label: 'BF',      dec: 0 },
  { key: 'ks',           label: 'K',       dec: 0 },
  { key: 'bbs',          label: 'BB',      dec: 0 },
  { key: 'hitsAllowed',  label: 'H',       dec: 0 },
  { key: 'hrs',          label: 'HR',      dec: 0 },
  { key: 'hbp',          label: 'HBP',     dec: 0 },
  { key: 'whip',         label: 'WHIP',    dec: 2 },
  { key: 'fip',          label: 'FIP',     dec: 2 },
  { key: 'kPct',         label: 'K%',      pct: true },
  { key: 'bbPct',        label: 'BB%',     pct: true },
  { key: 'strikePct',    label: 'Strike%', pct: true },
  { key: 'whiffPct',     label: 'Whiff%',  pct: true },
  { key: 'kbb',          label: 'K/BB',    dec: 2 },
  { key: 'babip',        label: 'BABIP',   dec: 3 },
  { key: 'weakPct',      label: 'Weak%',   pct: true },
];

function formatVal(s, metric) {
  if (metric.raw) return s[metric.key] ?? '—';
  const v = s[metric.key];
  if (v == null) return '—';
  if (metric.pct) return Math.round(v) + '%';
  return fmt(v, metric.dec ?? 2);
}

function pitchUsageMap(pitches) {
  const m = {};
  pitches.forEach(p => {
    if (!p.pitch_type) return;
    m[p.pitch_type] = (m[p.pitch_type] || 0) + 1;
  });
  const total = pitches.length;
  const result = {};
  Object.entries(m).forEach(([k, v]) => { result[k] = Math.round((v / total) * 100); });
  return result;
}

// Metrics to scale by IP (counting stats)
const COUNTING_KEYS = ['ks', 'bbs', 'hits', 'hbps'];
// Metrics that are rates — don't scale, just average
const RATE_KEYS = ['whip', 'fip', 'kPct', 'bbPct', 'strikePct', 'whiffPct', 'kbb', 'babip', 'weakPct'];

const MEDIAN_METRICS = [
  { key: 'ip',        label: 'IP (median)',  raw: true },
  { key: 'ks',        label: 'K',            dec: 0 },
  { key: 'bbs',       label: 'BB',           dec: 0 },
  { key: 'whip',      label: 'WHIP',         dec: 2 },
  { key: 'fip',       label: 'FIP',          dec: 2 },
  { key: 'kPct',      label: 'K%',           pct: true },
  { key: 'bbPct',     label: 'BB%',          pct: true },
  { key: 'strikePct', label: 'Strike%',      pct: true },
  { key: 'whiffPct',  label: 'Whiff%',       pct: true },
  { key: 'kbb',       label: 'K/BB',         dec: 2 },
  { key: 'babip',     label: 'BABIP',        dec: 3 },
  { key: 'weakPct',   label: 'Weak%',        pct: true },
];

function parseIP(ipStr) {
  if (!ipStr) return 0;
  const [whole, frac] = String(ipStr).split('.');
  return parseInt(whole || 0) + (parseInt(frac || 0) / 3);
}

function formatIP(decimalInnings) {
  const whole = Math.floor(decimalInnings);
  const outs = Math.round((decimalInnings - whole) * 3);
  return `${whole}.${outs}`;
}

function buildMedianStats(statsA, statsB) {
  const ipA = parseIP(statsA.ip);
  const ipB = parseIP(statsB.ip);
  const medianIP = (ipA + ipB) / 2;

  const result = { ip: formatIP(medianIP) };

  // Scale counting stats proportionally to median IP
  COUNTING_KEYS.forEach(key => {
    const scaledA = ipA > 0 ? (statsA[key] || 0) * (medianIP / ipA) : 0;
    const scaledB = ipB > 0 ? (statsB[key] || 0) * (medianIP / ipB) : 0;
    result[key] = (scaledA + scaledB) / 2;
  });

  // Average rate stats
  RATE_KEYS.forEach(key => {
    const a = statsA[key];
    const b = statsB[key];
    if (a != null && b != null) result[key] = (a + b) / 2;
  });

  return result;
}

function formatMedianVal(stats, metric) {
  if (metric.raw) return stats[metric.key] ?? '—';
  const v = stats[metric.key];
  if (v == null || isNaN(v)) return '—';
  if (metric.pct) return Math.round(v) + '%';
  return fmt(v, metric.dec ?? 2);
}

export default function PitcherCompare({ pitcherData }) {
  const [pitcherA, setPitcherA] = useState(pitcherData[0]?.name ?? '');
  const [pitcherB, setPitcherB] = useState(pitcherData[1]?.name ?? '');
  const [showMedian, setShowMedian] = useState(false);

  const dataA = pitcherData.find(p => p.name === pitcherA);
  const dataB = pitcherData.find(p => p.name === pitcherB);

  const radarData = useMemo(() => {
    return RADAR_METRICS.map(m => ({
      metric: m.label,
      [pitcherA || 'A']: dataA ? normalize(dataA.stats[m.key], m.min, m.max, m.invert) : 0,
      [pitcherB || 'B']: dataB ? normalize(dataB.stats[m.key], m.min, m.max, m.invert) : 0,
    }));
  }, [dataA, dataB, pitcherA, pitcherB]);

  // Combined pitch usage for grouped bar chart
  const pitchUsageData = useMemo(() => {
    if (!dataA && !dataB) return [];
    const usageA = dataA ? pitchUsageMap(dataA.pitches) : {};
    const usageB = dataB ? pitchUsageMap(dataB.pitches) : {};
    const allTypes = [...new Set([...Object.keys(usageA), ...Object.keys(usageB)])];
    return allTypes
      .sort((a, b) => ((usageA[b] || 0) + (usageB[b] || 0)) - ((usageA[a] || 0) + (usageB[a] || 0)))
      .map(type => ({
        name: PITCH_LABEL[type] || type,
        [pitcherA || 'A']: usageA[type] || 0,
        [pitcherB || 'B']: usageB[type] || 0,
      }));
  }, [dataA, dataB, pitcherA, pitcherB]);

  const names = pitcherData.map(p => p.name);

  if (pitcherData.length < 2) {
    return (
      <div className="text-center py-16 text-muted-foreground space-y-2">
        <Users className="w-10 h-10 mx-auto opacity-20" />
        <p className="text-sm font-medium">Need at least 2 pitchers</p>
        <p className="text-xs">Log more games with different pitchers to compare.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Picker row */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { value: pitcherA, set: setPitcherA, color: COLOR_A, exclude: pitcherB, label: 'Pitcher A' },
          { value: pitcherB, set: setPitcherB, color: COLOR_B, exclude: pitcherA, label: 'Pitcher B' },
        ].map(({ value, set, color, exclude, label }) => (
          <div key={label}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
            </div>
            <Select value={value} onValueChange={set}>
              <SelectTrigger className="h-9 text-xs uppercase">
                <SelectValue placeholder="Select pitcher" />
              </SelectTrigger>
              <SelectContent>
                {names.filter(n => n !== exclude).map(n => (
                  <SelectItem key={n} value={n}>{n.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {/* Radar chart */}
      {dataA && dataB && (
        <Card>
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Scouting Radar
            </CardTitle>
            <p className="text-[9px] text-muted-foreground/60">Higher = better performance for each metric</p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={pitcherA.toUpperCase()} dataKey={pitcherA} stroke={COLOR_A} fill={COLOR_A} fillOpacity={0.25} strokeWidth={2} />
                  <Radar name={pitcherB.toUpperCase()} dataKey={pitcherB} stroke={COLOR_B} fill={COLOR_B} fillOpacity={0.20} strokeWidth={2} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v, name, props) => {
                    const metric = RADAR_METRICS.find(m => m.label === props.payload.metric);
                    const src = name === pitcherA ? dataA : dataB;
                    if (!metric || !src) return [Math.round(v), name];
                    const raw = src.stats[metric.key];
                    if (raw == null) return ['—', name];
                    const display = metric.key.endsWith('Pct') || metric.key === 'strikePct' || metric.key === 'whiffPct'
                      ? Math.round(raw) + '%'
                      : fmt(raw, metric.key === 'babip' ? 3 : 2);
                    return [display, name];
                  }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key metrics side-by-side */}
      {dataA && dataB && (
        <Card>
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Metrics</CardTitle>
            <p className="text-[9px] text-muted-foreground/60">Actual totals &amp; rates — not scaled or adjusted</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-0 text-xs">
              {/* Header */}
              <div className="flex items-center gap-1.5 pb-2 font-semibold truncate">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLOR_A }} />
                <span className="truncate">{pitcherA.toUpperCase()}</span>
              </div>
              <div className="text-center pb-2 text-muted-foreground font-medium px-2" />
              <div className="flex items-center justify-end gap-1.5 pb-2 font-semibold truncate">
                <span className="truncate">{pitcherB.toUpperCase()}</span>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLOR_B }} />
              </div>

              {KEY_METRICS.map(metric => {
                const valA = formatVal(dataA.stats, metric);
                const valB = formatVal(dataB.stats, metric);
                const numA = dataA.stats[metric.key];
                const numB = dataB.stats[metric.key];
                const lowerIsBetter = ['bbPct', 'whip', 'fip', 'babip', 'bbs', 'hitsAllowed', 'hrs', 'hbp'].includes(metric.key);
                const betterA = numA != null && numB != null && numA !== numB && (lowerIsBetter ? numA < numB : numA > numB);
                const betterB = numA != null && numB != null && numA !== numB && !betterA;

                return (
                  <React.Fragment key={metric.key}>
                    <div className={`py-2 border-t border-muted/30 font-semibold ${betterA ? 'text-primary' : ''}`}>
                      {valA}
                    </div>
                    <div className="py-2 border-t border-muted/30 text-center text-muted-foreground px-2">
                      {metric.label}
                    </div>
                    <div className={`py-2 border-t border-muted/30 text-right font-semibold ${betterB ? 'text-orange-500' : ''}`}>
                      {valB}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pitch usage grouped bar chart */}
      {dataA && dataB && pitchUsageData.length > 0 && (
        <Card>
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pitch Usage %</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pitchUsageData} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis type="number" tick={{ fontSize: 9 }} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={36} />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey={pitcherA} fill={COLOR_A} radius={[0, 3, 3, 0]} barSize={8} />
                  <Bar dataKey={pitcherB} fill={COLOR_B} radius={[0, 3, 3, 0]} barSize={8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Median Report Button */}
      {dataA && dataB && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setShowMedian(true)}
        >
          <Scale className="w-4 h-4" />
          TruTale Comparison Report
        </Button>
      )}

      {/* TruTale Report Dialog */}
      <Dialog open={showMedian} onOpenChange={setShowMedian}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Scale className="w-4 h-4" /> TruTale Comparison Report
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Counting stats scaled to median IP ({
                dataA && dataB
                  ? formatIP((parseIP(dataA.stats.ip) + parseIP(dataB.stats.ip)) / 2)
                  : '—'
              } innings). TruScore based on weighted category points.
            </p>
          </DialogHeader>

          {dataA && dataB && (() => {
            const medianStats = buildMedianStats(dataA.stats, dataB.stats);

            // TruScore weighted categories
            // BB and FIP = 10pts for winner; all others = 6pts for winner; tie = 50% each
            const TRUSCORE_CATS = [
              { key: 'ks',        label: 'K',        points: 6,  lowerBetter: false, pct: false, dec: 0 },
              { key: 'bbs',       label: 'BB',       points: 10, lowerBetter: true,  pct: false, dec: 0 },
              { key: 'whip',      label: 'WHIP',     points: 6,  lowerBetter: true,  pct: false, dec: 2 },
              { key: 'fip',       label: 'FIP',      points: 10, lowerBetter: true,  pct: false, dec: 2 },
              { key: 'kPct',      label: 'K%',       points: 6,  lowerBetter: false, pct: true },
              { key: 'bbPct',     label: 'BB%',      points: 10, lowerBetter: true,  pct: true },
              { key: 'strikePct', label: 'Strike%',  points: 6,  lowerBetter: false, pct: true },
              { key: 'whiffPct',  label: 'Whiff%',   points: 6,  lowerBetter: false, pct: true },
              { key: 'kbb',       label: 'K/BB',     points: 6,  lowerBetter: false, pct: false, dec: 2 },
              { key: 'babip',     label: 'BABIP',    points: 6,  lowerBetter: true,  pct: false, dec: 3 },
              { key: 'weakPct',   label: 'Weak%',    points: 6,  lowerBetter: false, pct: true },
              { key: 'baa',       label: 'BAA',      points: 6,  lowerBetter: true,  pct: false, dec: 3 },
            ];

            // Get values for each pitcher (scaled for counting, raw for rates)
            const getVal = (statsObj, key) => {
              if (COUNTING_KEYS.includes(key)) {
                const ipSrc = parseIP(statsObj.ip);
                const medIP = parseIP(medianStats.ip);
                return ipSrc > 0 ? (statsObj[key] || 0) * (medIP / ipSrc) : 0;
              }
              return statsObj[key];
            };

            let truScoreA = 0;
            let truScoreB = 0;

            const catResults = TRUSCORE_CATS.map(cat => {
              const vA = getVal(dataA.stats, cat.key);
              const vB = getVal(dataB.stats, cat.key);
              const fmtV = (v) => {
                if (v == null || isNaN(v)) return '—';
                if (cat.pct) return Math.round(v) + '%';
                return fmt(v, cat.dec ?? 2);
              };

              let ptsA = 0, ptsB = 0, isTie = false;
              if (vA != null && vB != null && !isNaN(vA) && !isNaN(vB)) {
                // Use tolerance-based comparison to handle floating-point drift
                // from IP scaling (e.g. both pitchers had 2 BB but scaled values differ slightly)
                const tolerance = 1e-9;
                if (Math.abs(vA - vB) < tolerance) {
                  isTie = true;
                  ptsA = 0;
                  ptsB = 0;
                } else {
                  const aWins = cat.lowerBetter ? vA < vB : vA > vB;
                  if (aWins) {
                    ptsA = cat.points;
                  } else {
                    ptsB = cat.points;
                  }
                }
              }
              truScoreA += ptsA;
              truScoreB += ptsB;

              return { ...cat, vA, vB, fmtA: fmtV(vA), fmtB: fmtV(vB), ptsA, ptsB, isTie };
            });

            const maxScore = TRUSCORE_CATS.reduce((s, c) => s + c.points, 0);

            const exportTruTaleCSV = () => {
              const rows = [
                ['TruTale Comparison Report', '', ''],
                [pitcherA.toUpperCase(), 'Category', pitcherB.toUpperCase()],
                ...catResults.map(c => [c.fmtA + ` (${c.ptsA}pts)`, c.label, c.fmtB + ` (${c.ptsB}pts)`]),
                ['', '', ''],
                [`TruScore: ${truScoreA}/${maxScore}`, 'TOTAL', `TruScore: ${truScoreB}/${maxScore}`],
              ];
              const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'trutale_report.csv'; a.click();
              URL.revokeObjectURL(url);
            };

            const shareTruTale = async () => {
              const winnerName = truScoreA > truScoreB ? pitcherA : truScoreB > truScoreA ? pitcherB : null;
              const text = [
                `⚾ TruTale Comparison Report`,
                `${pitcherA.toUpperCase()} vs ${pitcherB.toUpperCase()}`,
                ``,
                ...catResults.map(c => `${c.label}: ${c.fmtA} (${c.ptsA}pts) vs ${c.fmtB} (${c.ptsB}pts)`),
                ``,
                `TruScore: ${pitcherA.toUpperCase()} ${truScoreA} — ${pitcherB.toUpperCase()} ${truScoreB}`,
                winnerName ? `🏆 Winner: ${winnerName.toUpperCase()}` : `🤝 Tied`,
              ].join('\n');
              if (navigator.share) {
                await navigator.share({ title: 'TruTale Comparison Report', text });
              } else {
                await navigator.clipboard.writeText(text);
                alert('Report copied to clipboard!');
              }
            };

            const aWinsOverall = truScoreA > truScoreB;
            const bWinsOverall = truScoreB > truScoreA;

            return (
              <div className="space-y-3">
                {/* Share / Export buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={shareTruTale}>
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={exportTruTaleCSV}>
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </Button>
                </div>

                {/* Header row */}
                <div className="grid grid-cols-[1fr_auto_1fr] text-xs font-semibold">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLOR_A }} />
                    <span className="truncate">{pitcherA.toUpperCase()}</span>
                  </div>
                  <div className="text-center text-muted-foreground px-2">Stat</div>
                  <div className="flex items-center justify-end gap-1">
                    <span className="truncate">{pitcherB.toUpperCase()}</span>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLOR_B }} />
                  </div>
                </div>

                {/* Median IP banner */}
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-center text-xs text-muted-foreground">
                  Median baseline: <strong>{medianStats.ip} IP</strong>
                  &nbsp;(A: {dataA.stats.ip} IP · B: {dataB.stats.ip} IP)
                </div>

                {/* Category rows with points */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-0 text-xs">
                  {catResults.map(cat => {
                    const aWins = !cat.isTie && cat.ptsA > cat.ptsB;
                    const bWins = !cat.isTie && cat.ptsB > cat.ptsA;
                    return (
                      <React.Fragment key={cat.key}>
                        <div className={`py-2 border-t border-muted/30 ${cat.isTie ? 'font-semibold text-muted-foreground' : aWins ? 'text-primary font-bold' : 'font-semibold text-muted-foreground'}`}>
                          <div>{cat.fmtA}</div>
                          <div className="text-[10px] font-medium" style={cat.isTie ? { color: '#94a3b8' } : {}}>
                              {cat.isTie ? `0pts (tie)` : aWins ? <span className="text-primary">{cat.ptsA}pts</span> : <span className="text-muted-foreground/60">{cat.ptsA}pts</span>}
                            </div>
                        </div>
                        <div className="py-2 border-t border-muted/30 text-center text-muted-foreground px-2 flex flex-col items-center justify-center gap-0.5">
                          <span>{cat.label}</span>
                          <span className="text-[9px] opacity-50">{cat.points}pt</span>
                        </div>
                        <div className={`py-2 border-t border-muted/30 text-right ${cat.isTie ? 'font-semibold text-muted-foreground' : bWins ? 'text-orange-500 font-bold' : 'font-semibold text-muted-foreground'}`}>
                          <div>{cat.fmtB}</div>
                          <div className="text-[10px] font-medium" style={cat.isTie ? { color: '#94a3b8' } : {}}>
                            {cat.isTie ? `0pts (tie)` : bWins ? <span className="text-orange-500">{cat.ptsB}pts</span> : <span className="text-muted-foreground/60">{cat.ptsB}pts</span>}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* TruScore totals */}
                <div className="grid grid-cols-[1fr_auto_1fr] border-t-2 border-border pt-3 text-sm font-bold">
                  <div className={`flex flex-col ${aWinsOverall ? 'text-primary' : 'text-muted-foreground'}`}>
                    <span className="text-lg">{truScoreA}</span>
                    <span className="text-[10px] font-medium uppercase tracking-wide">TruScore</span>
                    {aWinsOverall && <span className="text-[10px]">🏆 Winner</span>}
                  </div>
                  <div className="flex flex-col items-center justify-center px-2">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wide">of {maxScore}</span>
                  </div>
                  <div className={`flex flex-col items-end ${bWinsOverall ? 'text-orange-500' : 'text-muted-foreground'}`}>
                    <span className="text-lg">{truScoreB}</span>
                    <span className="text-[10px] font-medium uppercase tracking-wide">TruScore</span>
                    {bWinsOverall && <span className="text-[10px]">🏆 Winner</span>}
                  </div>
                </div>
                {!aWinsOverall && !bWinsOverall && (
                  <div className="text-center text-xs text-muted-foreground font-medium">🤝 Tied</div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}