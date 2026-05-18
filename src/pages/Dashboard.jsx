import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Activity, TrendingUp, Target, Users, Zap, Calendar } from 'lucide-react';
import { format, subDays, parseISO, startOfDay } from 'date-fns';

const RESULT_COLORS = {
  hit: '#22c55e',
  out: '#ef4444',
  walk: '#3b82f6',
  strikeout: '#f97316',
  other: '#a855f7',
};

const PITCH_COLORS = [
  '#3b82f6','#22c55e','#f97316','#ef4444','#a855f7',
  '#06b6d4','#eab308','#ec4899','#14b8a6','#6366f1',
];

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }) {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border">
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: games = [] } = useQuery({
    queryKey: ['games-dashboard'],
    queryFn: () => base44.entities.Game.list('-date', 200),
  });
  const { data: atBats = [] } = useQuery({
    queryKey: ['atbats-dashboard'],
    queryFn: () => base44.entities.AtBat.list('-created_date', 500),
  });
  const { data: pitches = [] } = useQuery({
    queryKey: ['pitches-dashboard'],
    queryFn: () => base44.entities.Pitch.list('-created_date', 500),
  });
  const { data: players = [] } = useQuery({
    queryKey: ['players-dashboard'],
    queryFn: () => base44.entities.Player.list('name', 200),
  });

  // ── Derived stats ──────────────────────────────────────────────
  const totalGames = games.length;
  const finalGames = games.filter(g => g.status === 'final').length;
  const totalPitches = pitches.length;
  const totalAtBats = atBats.length;

  // Activity over last 14 days (by created_date)
  const activityData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = subDays(new Date(), 13 - i);
      return { date: format(d, 'MMM d'), key: format(d, 'yyyy-MM-dd'), pitches: 0, atBats: 0 };
    });
    pitches.forEach(p => {
      if (!p.created_date) return;
      const key = format(startOfDay(parseISO(p.created_date)), 'yyyy-MM-dd');
      const day = days.find(d => d.key === key);
      if (day) day.pitches++;
    });
    atBats.forEach(ab => {
      if (!ab.created_date) return;
      const key = format(startOfDay(parseISO(ab.created_date)), 'yyyy-MM-dd');
      const day = days.find(d => d.key === key);
      if (day) day.atBats++;
    });
    return days;
  }, [pitches, atBats]);

  // Game outcomes (wins by run differential — not stored, so use finalGames vs in_progress)
  const gameStatusData = useMemo(() => [
    { name: 'Final', value: finalGames },
    { name: 'In Progress', value: totalGames - finalGames },
  ].filter(d => d.value > 0), [finalGames, totalGames]);

  // Pitch type distribution
  const pitchTypeData = useMemo(() => {
    const counts = {};
    pitches.forEach(p => {
      if (!p.pitch_type) return;
      counts[p.pitch_type] = (counts[p.pitch_type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [pitches]);

  // At-bat result grouping
  const resultData = useMemo(() => {
    const hits = new Set(['single','double','triple','home_run','bunt_single']);
    const walks = new Set(['walk','hbp']);
    const ks = new Set(['strikeout_swinging','strikeout_looking']);
    const counts = { Hit: 0, Out: 0, Walk: 0, Strikeout: 0, Other: 0 };
    atBats.forEach(ab => {
      if (!ab.result) return;
      if (hits.has(ab.result)) counts.Hit++;
      else if (walks.has(ab.result)) counts.Walk++;
      else if (ks.has(ab.result)) counts.Strikeout++;
      else if (['groundout','flyout','lineout','popout','double_play','bunt_out','rbi_groundout'].includes(ab.result)) counts.Out++;
      else counts.Other++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [atBats]);

  // Games per week (last 8 weeks)
  const gamesPerWeek = useMemo(() => {
    const weeks = Array.from({ length: 8 }, (_, i) => ({
      label: `W${8 - i}`,
      games: 0,
    }));
    games.forEach(g => {
      if (!g.date) return;
      try {
        const daysAgo = Math.floor((Date.now() - new Date(g.date).getTime()) / 86400000);
        const weekIdx = Math.floor(daysAgo / 7);
        if (weekIdx >= 0 && weekIdx < 8) weeks[7 - weekIdx].games++;
      } catch {}
    });
    return weeks;
  }, [games]);

  // Recent game activity
  const recentGames = useMemo(() =>
    [...games]
      .filter(g => g.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5),
    [games]
  );

  const avgPitchesPerGame = totalGames > 0 ? Math.round(totalPitches / totalGames) : 0;
  const avgAtBatsPerGame  = totalGames > 0 ? Math.round(totalAtBats / totalGames) : 0;

  return (
    <div className="min-h-screen pb-safe-nav px-4 pt-4 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Season performance overview</p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Calendar}   label="Total Games"    value={totalGames}       sub={`${finalGames} final`} />
        <StatCard icon={Users}      label="Players"        value={players.length}   sub="on roster" />
        <StatCard icon={Target}     label="Total Pitches"  value={totalPitches.toLocaleString()} sub={`~${avgPitchesPerGame}/game`} />
        <StatCard icon={Activity}   label="Total At-Bats"  value={totalAtBats.toLocaleString()}  sub={`~${avgAtBatsPerGame}/game`} />
      </div>

      {/* ── Activity trend (14 days) ── */}
      <Card className="bg-card/80 backdrop-blur-sm border-border">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Activity — Last 14 Days
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={activityData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="abGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="pitches" name="Pitches" stroke="#3b82f6" fill="url(#pitchGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="atBats"  name="At-Bats" stroke="#22c55e" fill="url(#abGrad)"   strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Games per week ── */}
      <Card className="bg-card/80 backdrop-blur-sm border-border">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Games per Week
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={gamesPerWeek} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
              />
              <Bar dataKey="games" name="Games" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── At-bat results + Pitch types ── */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold">At-Bat Results</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {resultData.length === 0 ? (
              <div className="h-28 flex items-center justify-center text-muted-foreground text-xs">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={resultData} cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={2} dataKey="value">
                    {resultData.map((entry, i) => (
                      <Cell key={i} fill={Object.values(RESULT_COLORS)[i % 5]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 10 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="mt-1 space-y-0.5">
              {resultData.slice(0, 4).map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: Object.values(RESULT_COLORS)[i % 5] }} />
                    {d.name}
                  </span>
                  <span className="font-semibold text-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold">Pitch Arsenal</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {pitchTypeData.length === 0 ? (
              <div className="h-28 flex items-center justify-center text-muted-foreground text-xs">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={pitchTypeData} cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={2} dataKey="value">
                    {pitchTypeData.map((_, i) => (
                      <Cell key={i} fill={PITCH_COLORS[i % PITCH_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 10 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="mt-1 space-y-0.5">
              {pitchTypeData.slice(0, 4).map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: PITCH_COLORS[i] }} />
                    {d.name}
                  </span>
                  <span className="font-semibold text-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent games ── */}
      <Card className="bg-card/80 backdrop-blur-sm border-border">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Recent Games
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {recentGames.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No games recorded yet</p>
          ) : (
            recentGames.map(g => (
              <div key={g.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">vs {g.opponent}</p>
                  <p className="text-xs text-muted-foreground">{g.date ? format(parseISO(g.date), 'MMM d, yyyy') : '—'} · {g.location || ''}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  g.status === 'final' ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'
                }`}>
                  {g.status === 'final' ? 'Final' : 'Live'}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}