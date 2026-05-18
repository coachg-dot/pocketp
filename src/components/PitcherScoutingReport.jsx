import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Target, Zap, Users } from 'lucide-react';
import { PITCH_TYPES } from './PitchTracker';

const OUT_RESULTS = ['in_play_out', 'swinging_strike', 'called_strike'];
const isOut = (r) => OUT_RESULTS.includes(r);
const isStrikeout = (r) => ['swinging_strike', 'called_strike'].includes(r);

const getPitchBg = (type) => PITCH_TYPES.find(p => p.id === type)?.color || 'bg-gray-400';
const getPitchFull = (type) => PITCH_TYPES.find(p => p.id === type)?.full || type;

function pctBar(val, color) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${val}%` }} />
      </div>
      <span className="text-xs font-semibold w-10 text-right">{val}%</span>
    </div>
  );
}

function StatBox({ label, value, sub, color }) {
  return (
    <div className="text-center p-3 bg-muted/40 rounded-xl">
      <p className={`text-2xl font-bold ${color || ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function PitchBreakdown({ pitches, title, emptyMsg }) {
  const usage = useMemo(() => {
    const counts = {};
    pitches.forEach(p => {
      if (!counts[p.pitch_type]) counts[p.pitch_type] = { total: 0, outs: 0, k: 0 };
      counts[p.pitch_type].total++;
      if (isOut(p.result)) counts[p.pitch_type].outs++;
      if (isStrikeout(p.result)) counts[p.pitch_type].k++;
    });
    return Object.entries(counts)
      .map(([type, d]) => ({
        type,
        ...d,
        usagePct: Math.round((d.total / pitches.length) * 100),
        outPct: Math.round((d.outs / d.total) * 100),
        kPct: Math.round((d.k / d.total) * 100),
      }))
      .sort((a, b) => b.total - a.total);
  }, [pitches]);

  if (!pitches.length) return <p className="text-sm text-muted-foreground text-center py-4">{emptyMsg || 'No data.'}</p>;

  return (
    <div className="space-y-3">
      {title && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>}
      {usage.map(u => (
        <div key={u.type} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={`px-2 py-0.5 rounded text-white text-xs font-bold ${getPitchBg(u.type)}`}>
              {getPitchFull(u.type)}
            </span>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>{u.total} pitches ({u.usagePct}%)</span>
              <span className={u.kPct >= 20 ? 'text-primary font-semibold' : ''}>{u.kPct}% K</span>
            </div>
          </div>
          {pctBar(u.usagePct, getPitchBg(u.type).replace('bg-', 'bg-'))}
        </div>
      ))}
    </div>
  );
}

function SequenceBreakdown({ pitches, title }) {
  const sequences = useMemo(() => {
    const m = {};
    for (let i = 0; i < pitches.length - 1; i++) {
      const cur = pitches[i];
      const next = pitches[i + 1];
      if (cur.at_bat_id !== next.at_bat_id) continue;
      const key = `${cur.pitch_type}→${next.pitch_type}`;
      if (!m[key]) m[key] = { from: cur.pitch_type, to: next.pitch_type, total: 0, outs: 0 };
      m[key].total++;
      if (isOut(next.result)) m[key].outs++;
    }
    return Object.values(m)
      .filter(s => s.total >= 2)
      .map(s => ({ ...s, pct: Math.round((s.outs / s.total) * 100) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [pitches]);

  if (!pitches.length || sequences.length === 0)
    return <p className="text-sm text-muted-foreground text-center py-4">Not enough data yet (min 2 uses per sequence).</p>;

  return (
    <div className="space-y-2">
      {title && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</p>}
      {sequences.map((s, i) => (
        <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground w-4">#{i + 1}</span>
            <span className={`px-2 py-0.5 rounded text-white text-xs font-bold ${getPitchBg(s.from)}`}>{getPitchFull(s.from)}</span>
            <span className="text-muted-foreground text-xs">→</span>
            <span className={`px-2 py-0.5 rounded text-white text-xs font-bold ${getPitchBg(s.to)}`}>{getPitchFull(s.to)}</span>
          </div>
          <div className="text-right">
            <p className={`text-sm font-bold ${s.pct >= 60 ? 'text-primary' : s.pct >= 35 ? 'text-accent' : 'text-destructive'}`}>{s.pct}%</p>
            <p className="text-xs text-muted-foreground">{s.outs}/{s.total}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PitcherScoutingReport({ pitcherName, open, onClose }) {
  const [tab, setTab] = useState('overview');

  const { data: allPitches = [], isLoading: loadingPitches } = useQuery({
    queryKey: ['pitches-all', pitcherName],
    queryFn: () => base44.entities.Pitch.filter({ pitcher_name: pitcherName }, '-created_date', 1000),
    enabled: open && !!pitcherName,
  });

  const { data: atBats = [] } = useQuery({
    queryKey: ['atbats-for-pitcher', pitcherName],
    queryFn: async () => {
      const ids = [...new Set(allPitches.map(p => p.at_bat_id).filter(Boolean))];
      if (!ids.length) return [];
      // Fetch all at-bats — filter client-side
      const all = await base44.entities.AtBat.list('-created_date', 1000);
      return all.filter(ab => ids.includes(ab.id));
    },
    enabled: open && allPitches.length > 0,
  });

  // Build a map: at_bat_id → batter handedness
  const atBatHandMap = useMemo(() => {
    const m = {};
    atBats.forEach(ab => { m[ab.id] = ab.bats || 'R'; });
    return m;
  }, [atBats]);

  const rhhPitches = useMemo(() => allPitches.filter(p => {
    const hand = atBatHandMap[p.at_bat_id];
    return hand === 'R' || hand === undefined; // default to RHH if unknown
  }), [allPitches, atBatHandMap]);

  const lhhPitches = useMemo(() => allPitches.filter(p => {
    const hand = atBatHandMap[p.at_bat_id];
    return hand === 'L';
  }), [allPitches, atBatHandMap]);

  const totalOut = allPitches.filter(p => isOut(p.result)).length;
  const totalK = allPitches.filter(p => isStrikeout(p.result)).length;
  const outPct = allPitches.length ? Math.round((totalOut / allPitches.length) * 100) : 0;
  const kPct = allPitches.length ? Math.round((totalK / allPitches.length) * 100) : 0;
  const pitchTypes = new Set(allPitches.map(p => p.pitch_type)).size;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl px-0">
        <SheetHeader className="px-4 pb-2 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            {pitcherName} — Pitcher Report
          </SheetTitle>
          <p className="text-xs text-muted-foreground">{allPitches.length} pitches tracked</p>
        </SheetHeader>

        {loadingPitches ? (
          <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : allPitches.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No pitch data found for this pitcher.</div>
        ) : (
          <div className="px-4 py-3 space-y-4">
            {/* Overview stats */}
            <div className="grid grid-cols-4 gap-2">
              <StatBox label="Total" value={allPitches.length} />
              <StatBox label="Out %" value={`${outPct}%`} color={outPct >= 40 ? 'text-primary' : 'text-accent'} />
              <StatBox label="K Rate" value={`${kPct}%`} color={kPct >= 20 ? 'text-primary' : ''} />
              <StatBox label="Pitch Mix" value={pitchTypes} sub="types" />
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full grid grid-cols-4 text-xs">
                <TabsTrigger value="overview"><Zap className="w-3 h-3" /></TabsTrigger>
                <TabsTrigger value="vs-rhh">vs RHH</TabsTrigger>
                <TabsTrigger value="vs-lhh">vs LHH</TabsTrigger>
                <TabsTrigger value="sequences"><TrendingUp className="w-3 h-3" /></TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-3 space-y-4">
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm">Pitch Arsenal</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <PitchBreakdown pitches={allPitches} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm">Best Sequences (All Batters)</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <SequenceBreakdown pitches={allPitches} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="vs-rhh" className="mt-3 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs">RHH — {rhhPitches.length} pitches</Badge>
                  {rhhPitches.length > 0 && (
                    <Badge className="text-xs bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary">
                      {Math.round((rhhPitches.filter(p => isOut(p.result)).length / rhhPitches.length) * 100)}% out rate
                    </Badge>
                  )}
                </div>
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Usage vs RHH</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-4">
                    <PitchBreakdown pitches={rhhPitches} emptyMsg="No data vs right-handed hitters." />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Best Sequences vs RHH</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-4">
                    <SequenceBreakdown pitches={rhhPitches} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="vs-lhh" className="mt-3 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs">LHH — {lhhPitches.length} pitches</Badge>
                  {lhhPitches.length > 0 && (
                    <Badge className="text-xs bg-accent/10 text-accent dark:bg-accent/20 dark:text-accent">
                      {Math.round((lhhPitches.filter(p => isOut(p.result)).length / lhhPitches.length) * 100)}% out rate
                    </Badge>
                  )}
                </div>
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Usage vs LHH</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-4">
                    <PitchBreakdown pitches={lhhPitches} emptyMsg="No data vs left-handed hitters." />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Best Sequences vs LHH</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-4">
                    <SequenceBreakdown pitches={lhhPitches} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sequences" className="mt-3">
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      All Sequences Ranked
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-4">
                    <SequenceBreakdown pitches={allPitches} title="Overall" />
                    {rhhPitches.length > 0 && <SequenceBreakdown pitches={rhhPitches} title="vs Right-Handed Hitters" />}
                    {lhhPitches.length > 0 && <SequenceBreakdown pitches={lhhPitches} title="vs Left-Handed Hitters" />}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}