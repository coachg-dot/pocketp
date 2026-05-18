import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, TrendingUp, BarChart3, User, ChevronDown, ChevronUp, Download, Edit2, Check, X, FileDown } from 'lucide-react';
import { createPageUrl } from '@/utils';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import PitcherCompare from '@/components/PitcherCompare';
import MatchupsView from '@/components/MatchupsView';

// ── helpers ─────────────────────────────────────────────────────────────────
const HIT_RESULTS  = ['single','double','triple','home_run','bunt_single'];
const OUT_RESULTS  = ['strikeout_swinging','strikeout_looking','groundout','flyout','lineout',
                      'popout','rbi_groundout','fielders_choice','error','sac_fly','sac_bunt',
                      'bunt_out','in_play_out','double_play','triple_play'];
const GB_RESULTS   = ['groundout','rbi_groundout','double_play','triple_play','bunt_out','fielders_choice'];
const STRIKE_P     = ['called_strike','swinging_strike','foul','foul_tip','in_play_out','in_play_hit'];
const SWING_P      = ['swinging_strike','foul','in_play_out','in_play_hit'];

const PITCH_META = {
  '4seam':'#ef4444','2seam':'#f97316','fastball':'#ef4444','sinker':'#f59e0b',
  'cutter':'#84cc16','slider':'#a855f7','sweeper':'#7c3aed','slurve':'#8b5cf6',
  'curveball':'#3b82f6','knuckle_curve':'#60a5fa','changeup':'#22c55e',
  'splitter':'#10b981','knuckleball':'#64748b','eephus':'#ec4899',
};
const PITCH_LABEL = {
  '4seam':'4-Seam','2seam':'2-Seam','fastball':'FB','sinker':'Sinker',
  'cutter':'Cutter','slider':'SL','sweeper':'SWP','slurve':'Slurve',
  'curveball':'CB','knuckle_curve':'KC','changeup':'CH',
  'splitter':'SPL','knuckleball':'KN','eephus':'EEP',
};

function fmt(n, dec = 2) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—';
  return Number(n).toFixed(dec);
}
function pct(n, d) { return (!d) ? '—' : Math.round((n / d) * 100) + '%'; }
function ipFmt(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

function calcStats(pitches, atBats) {
  const totalPitches = pitches.length;
  const strikes  = pitches.filter(p => STRIKE_P.includes(p.result)).length;
  const swings   = pitches.filter(p => SWING_P.includes(p.result)).length;
  const whiffs   = pitches.filter(p => p.result === 'swinging_strike').length;
  const fps      = pitches.filter(p => p.pitch_number === 1 && STRIKE_P.includes(p.result)).length;
  const fpsBF    = pitches.filter(p => p.pitch_number === 1).length;
  const bf       = atBats.length;
  const ks       = atBats.filter(ab => ab.result === 'strikeout_swinging' || ab.result === 'strikeout_looking').length;
  const bbs      = atBats.filter(ab => ab.result === 'walk').length;
  const hbp      = atBats.filter(ab => ab.result === 'hbp').length;
  const hitsAllowed = atBats.filter(ab => HIT_RESULTS.includes(ab.result)).length;
  const hrs      = atBats.filter(ab => ab.result === 'home_run').length;
  const doubles  = atBats.filter(ab => ab.result === 'double').length;
  const triples  = atBats.filter(ab => ab.result === 'triple').length;
  const singles  = atBats.filter(ab => ab.result === 'single').length;

  const totalOuts = atBats.reduce((acc, ab) => {
    if (ab.result === 'double_play') return acc + 2;
    if (ab.result === 'triple_play') return acc + 3;
    if (OUT_RESULTS.includes(ab.result)) return acc + 1;
    return acc;
  }, 0);
  const gbOuts = atBats.filter(ab => GB_RESULTS.includes(ab.result)).length;
  const bip    = gbOuts + atBats.filter(ab => ['flyout','sac_fly','popout'].includes(ab.result)).length +
                 atBats.filter(ab => ab.result === 'lineout').length;
  const ipDec  = Math.floor(totalOuts / 3) + (totalOuts % 3) / 3;
  const whip   = ipDec > 0 ? (bbs + hbp + hitsAllowed) / ipDec : null;
  const fip    = ipDec > 0 ? ((13 * hrs) + (3 * (bbs + hbp)) - (2 * ks)) / ipDec + 3.2 : null;
  const kPer9  = ipDec > 0 ? (ks / ipDec) * 9 : null;
  const bbPer9 = ipDec > 0 ? (bbs / ipDec) * 9 : null;
  const kbb    = bbs > 0 ? ks / bbs : null;
  const tbAllowed = singles + (2*doubles) + (3*triples) + (4*hrs);
  const abOpp  = atBats.filter(ab => ab.result !== 'walk' && ab.result !== 'hbp').length;
  const slgAg  = abOpp > 0 ? tbAllowed / abOpp : null;
  const obpAg  = bf > 0 ? (hitsAllowed + bbs + hbp) / bf : null;
  // BABIP = (H - HR) / (AB - K - HR + SF). Use standard denominator: BF - BB - HBP - K - HR
  const babipDenom = bf - bbs - hbp - ks - hrs;
  const babip  = babipDenom > 0 ? (hitsAllowed - hrs) / babipDenom : null;
  const baa    = abOpp > 0 ? hitsAllowed / abOpp : null; // Batting Average Against

  // Weak%: infield balls in play / total balls in play (with tracked location)
  const ballsInPlay = atBats.filter(ab =>
    ab.result !== 'walk' && ab.result !== 'hbp' &&
    ab.result !== 'strikeout_swinging' && ab.result !== 'strikeout_looking' &&
    ab.hit_location_x != null && ab.hit_location_y != null
  );
  const infieldBalls = ballsInPlay.filter(ab => {
    const dx = ab.hit_location_x - 50;
    const dy = ab.hit_location_y - 100;
    return Math.sqrt(dx * dx + dy * dy) < 52;
  });
  const weakPct = ballsInPlay.length > 0 ? (infieldBalls.length / ballsInPlay.length) * 100 : null;
  const kPct   = bf > 0 ? (ks / bf) * 100 : null;
  const bbPct  = bf > 0 ? (bbs / bf) * 100 : null;
  const strikePct = totalPitches > 0 ? (strikes / totalPitches) * 100 : null;
  const whiffPct  = swings > 0 ? (whiffs / swings) * 100 : null;

  // Earned runs: AtBat.earned_runs is the single source of truth.
  // Use AB-level data if ANY AB has earned_runs set (including 0 = unearned plays recorded).
  const erFromABs = atBats.reduce((sum, ab) => sum + (ab.earned_runs || 0), 0);
  const erFromPitches = pitches.reduce((sum, p) => sum + (p.earned_runs || 0), 0);
  const hasABLevelER = atBats.some(ab => ab.earned_runs != null); // includes 0
  const earnedRuns = hasABLevelER ? erFromABs : erFromPitches;

  return {
    totalPitches, strikes, swings, whiffs, fps, fpsBF, bf, ks, bbs, hbp,
    hitsAllowed, hrs, totalOuts, gbOuts, bip, ipDec, ip: ipFmt(totalOuts),
    earnedRuns, whip, fip, kPer9, bbPer9, kbb, slgAg, obpAg, babip, baa, kPct, bbPct, strikePct, whiffPct, weakPct,
  };
}

// ── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, highlight }) {
  return (
    <div className={`rounded-xl p-3 text-center ${highlight ? 'bg-primary/10' : 'bg-muted/50'}`}>
      <p className={`text-base font-bold ${highlight ? 'text-primary' : ''}`}>{value ?? '—'}</p>
      <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
      {sub && <p className="text-[9px] text-muted-foreground/60">{sub}</p>}
    </div>
  );
}

// ── Trend chart for a single metric ─────────────────────────────────────────
function TrendChart({ data, metricKey, label, color, formatter }) {
  if (!data || data.length < 2) return null;
  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="gameLabel" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip
            formatter={(v) => formatter ? formatter(v) : fmt(v)}
            labelFormatter={(l) => l}
            contentStyle={{ fontSize: 11 }}
          />
          <Line type="monotone" dataKey={metricKey} stroke={color} strokeWidth={2}
            dot={{ r: 3, fill: color }} name={label} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Pitch usage bar chart ────────────────────────────────────────────────────
function PitchUsageChart({ pitches }) {
  const data = useMemo(() => {
    const m = {};
    pitches.forEach(p => {
      if (!p.pitch_type) return;
      m[p.pitch_type] = (m[p.pitch_type] || 0) + 1;
    });
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        name: PITCH_LABEL[type] || type,
        pct: Math.round((count / pitches.length) * 100),
        color: PITCH_META[type] || '#94a3b8',
      }));
  }, [pitches]);

  if (!data.length) return null;
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 9 }} unit="%" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={42} />
          <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 11 }} />
          <Bar dataKey="pct" radius={4}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Comparison table row ─────────────────────────────────────────────────────
function CompareRow({ name, s, gamesPlayed, isSelected, onClick, onRename }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(name);

  const handleSave = () => {
    const trimmed = editVal.trim().toUpperCase();
    if (trimmed && trimmed !== name) {
      onRename(name, trimmed);
    }
    setEditing(false);
  };

  return (
    <div className={`rounded-xl border p-3 transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
          {editing ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                autoFocus
                value={editVal}
                onChange={e => setEditVal(e.target.value.toUpperCase())}
                className="h-7 text-xs px-2"
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
              />
              <button onClick={handleSave} className="p-1 text-primary hover:text-primary/80 flex-shrink-0">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setEditVal(name); setEditing(false); }} className="p-1 text-muted-foreground hover:text-foreground flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <button
                className="font-semibold text-sm text-left hover:text-primary transition-colors truncate"
                onClick={onClick}
              >
                {name.toUpperCase()}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setEditVal(name); setEditing(true); }}
                className="p-1 text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0"
                title="Rename pitcher"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
        {!editing && <Badge variant="outline" className="text-[10px] flex-shrink-0">{gamesPlayed}G</Badge>}
      </div>
      <button className="w-full text-left" onClick={onClick}>
        <div className="grid grid-cols-5 gap-1">
          {[
            ['K', s.ks],
            ['WHIP', fmt(s.whip)],
            ['FIP', fmt(s.fip)],
            ['K%', s.kPct != null ? Math.round(s.kPct)+'%' : '—'],
            ['IP', s.ip],
          ].map(([l,v]) => (
            <div key={l} className="text-center">
              <p className="text-xs font-bold">{v}</p>
              <p className="text-[9px] text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </button>
    </div>
  );
}

function exportPitcherCSV(name, s, gameData) {
  const rows = [
    ['Pitcher','Games','IP','PC','K','BB','H','HR','HBP','WHIP','FIP','BAA','K%','BB%','K/9','BB/9','K/BB','Strike%','Whiff%','BABIP','Weak%'],
    [
      name, gameData.length, s.ip, s.totalPitches, s.ks, s.bbs, s.hitsAllowed, s.hrs, s.hbp,
      s.whip?.toFixed(2) ?? '', s.fip?.toFixed(2) ?? '',
      s.baa?.toFixed(3) ?? '',
      s.kPct  != null ? Math.round(s.kPct)+'%'  : '',
      s.bbPct != null ? Math.round(s.bbPct)+'%' : '',
      s.kPer9?.toFixed(1) ?? '', s.bbPer9?.toFixed(1) ?? '',
      s.kbb?.toFixed(2) ?? '',
      s.strikePct != null ? Math.round(s.strikePct)+'%' : '',
      s.whiffPct  != null ? Math.round(s.whiffPct)+'%'  : '',
      s.babip?.toFixed(3) ?? '',
      s.weakPct != null ? Math.round(s.weakPct)+'%' : '',
    ],
  ];
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${name}_stats.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Game box score row ──────────────────────────────────────────────────────
function GameBoxRow({ gd, onClick }) {
  const s = useMemo(() => calcStats(gd.pitches, gd.atBats), [gd]);
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border bg-card p-3 hover:border-primary/60 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-semibold text-sm">vs {gd.game?.opponent || 'Unknown'}</p>
          <p className="text-xs text-muted-foreground">{gd.game?.date || ''}{gd.game?.location ? ` · ${gd.game.location}` : ''}</p>
        </div>
        <Badge className={gd.game?.status === 'final' ? 'bg-green-100 text-green-700 text-xs' : 'bg-yellow-100 text-yellow-700 text-xs'}>
          {gd.game?.status === 'final' ? 'Final' : 'In Progress'}
        </Badge>
      </div>
      <div className="grid grid-cols-6 gap-1 text-center">
        {[['IP', s.ip], ['PC', s.totalPitches], ['K', s.ks], ['BB', s.bbs], ['H', s.hitsAllowed], ['ER', s.earnedRuns]].map(([l, v]) => (
          <div key={l}>
            <p className="text-sm font-bold">{v}</p>
            <p className="text-[10px] text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
    </button>
  );
}

// ── Single game detail (box score + rate stats) ──────────────────────────────
function GameBoxDetail({ gd, onBack }) {
  const s = useMemo(() => calcStats(gd.pitches, gd.atBats), [gd]);
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-1 -ml-1" onClick={onBack}>← Back to games</Button>
      <div>
        <p className="font-bold text-lg">vs {gd.game?.opponent || 'Unknown'}</p>
        <p className="text-sm text-muted-foreground">{gd.game?.date || ''}{gd.game?.location ? ` · ${gd.game.location}` : ''}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[['IP', s.ip, 'text-primary'], ['ER', s.earnedRuns, 'text-destructive'], ['K', s.ks, 'text-primary'], ['BB', s.bbs, '']].map(([l, v, c]) => (
          <div key={l} className="bg-muted/50 rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${c}`}>{v}</p>
            <p className="text-xs text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[['H', s.hitsAllowed, 'text-destructive'], ['PC', s.totalPitches, ''], ['BF', s.bf, ''], ['HBP', s.hbp, '']].map(([l, v, c]) => (
          <div key={l} className="bg-muted/30 rounded-xl p-2.5 text-center">
            <p className={`text-lg font-bold ${c}`}>{v}</p>
            <p className="text-xs text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      {s.totalPitches > 0 && (
        <Card>
          <CardHeader className="pb-1 pt-3"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate Stats</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            {[
              ['Strike%', s.strikePct != null ? Math.round(s.strikePct)+'%' : '—'],
              ['Whiff%', s.whiffPct != null ? Math.round(s.whiffPct)+'%' : '—'],
              ['K%', s.kPct != null ? Math.round(s.kPct)+'%' : '—'],
              ['BB%', s.bbPct != null ? Math.round(s.bbPct)+'%' : '—'],
              ['WHIP', s.whip != null ? fmt(s.whip) : '—'],
              ['FIP', s.fip != null ? fmt(s.fip) : '—'],
            ].map(([l, v]) => (
              <div key={l} className="bg-muted/40 rounded-lg p-2 text-center">
                <p className="text-sm font-bold">{v}</p>
                <p className="text-[10px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Pitcher detail panel ─────────────────────────────────────────────────────
function PitcherDetail({ name, pitches, atBats, gameData }) {
  const [showAllTrends, setShowAllTrends] = useState(false);
  const [detailView, setDetailView] = useState('career'); // 'career' | 'gamelog' | { gameId }
  const s = useMemo(() => calcStats(pitches, atBats), [pitches, atBats]);

  // Per-game trend data
  const trendData = useMemo(() => {
    return gameData
      .map(gd => {
        const gs = calcStats(gd.pitches, gd.atBats);
        return {
          gameLabel: gd.game?.opponent ? `vs ${gd.game.opponent.slice(0,8)}` : gd.gameId.slice(0,6),
          date: gd.game?.date || '',
          whip: gs.whip != null ? parseFloat(fmt(gs.whip)) : null,
          fip:  gs.fip  != null ? parseFloat(fmt(gs.fip))  : null,
          ks:   gs.ks,
          bbs:  gs.bbs,
          pitches: gs.totalPitches,
          kPct: gs.kPct != null ? parseFloat(gs.kPct.toFixed(1)) : null,
          strikePct: gs.strikePct != null ? parseFloat(gs.strikePct.toFixed(1)) : null,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [gameData]);

  // If a game detail is open, show it
  if (typeof detailView === 'object' && detailView.gameId) {
    const gd = gameData.find(g => g.gameId === detailView.gameId);
    return <GameBoxDetail gd={gd || { game: null, pitches: [], atBats: [] }} onBack={() => setDetailView('gamelog')} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold">{name.toUpperCase()}</p>
          <p className="text-xs text-muted-foreground">Career · {gameData.length} game{gameData.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => exportPitcherCSV(name, s, gameData)}>
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      {/* Career / Game Log tabs */}
      <div className="flex gap-2">
        <Button size="sm" variant={detailView === 'career' ? 'default' : 'outline'} className="flex-1" onClick={() => setDetailView('career')}>
          Career Stats
        </Button>
        <Button size="sm" variant={detailView === 'gamelog' ? 'default' : 'outline'} className="flex-1" onClick={() => setDetailView('gamelog')}>
          Game Log
        </Button>
      </div>

      {/* Game Log view */}
      {detailView === 'gamelog' && (
        <div className="space-y-2">
          {gameData.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No game data found.</p>}
          {[...gameData].sort((a, b) => (b.game?.date || '').localeCompare(a.game?.date || '')).map(gd => (
            <GameBoxRow key={gd.gameId} gd={gd} onClick={() => setDetailView({ gameId: gd.gameId })} />
          ))}
        </div>
      )}

      {detailView !== 'gamelog' && <>
      {/* Career summary tiles */}
      <div className="grid grid-cols-4 gap-2">
        <StatTile label="K" value={s.ks} highlight />
        <StatTile label="IP" value={s.ip} />
        <StatTile label="BF" value={s.bf} />
        <StatTile label="PC" value={s.totalPitches} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <StatTile label="BB" value={s.bbs} />
        <StatTile label="H" value={s.hitsAllowed} />
        <StatTile label="HR" value={s.hrs} />
        <StatTile label="HBP" value={s.hbp} />
      </div>

      {/* Key sabermetrics */}
      <Card>
        <CardHeader className="pb-1 pt-3">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {[
            { label: 'BAA',      value: s.baa != null ? fmt(s.baa, 3) : '—', desc: 'Batting avg against', lowerBetter: true },
            { label: 'WHIP',     value: fmt(s.whip),     desc: '(H+BB+HBP)/IP', lowerBetter: true },
            { label: 'FIP',      value: fmt(s.fip),      desc: 'Fielding Indep. Pitching', lowerBetter: true },
            { label: 'K%',       value: s.kPct != null ? Math.round(s.kPct)+'%' : '—', desc: 'Strikeout rate / BF' },
            { label: 'BB%',      value: s.bbPct != null ? Math.round(s.bbPct)+'%' : '—', desc: 'Walk rate / BF', lowerBetter: true },
            { label: 'K/BB',     value: s.kbb != null ? fmt(s.kbb,2) : '—', desc: 'K-to-BB ratio' },
            { label: 'K/9',      value: fmt(s.kPer9, 1), desc: 'Ks per 9 innings' },
            { label: 'Strike%',  value: s.strikePct != null ? Math.round(s.strikePct)+'%' : '—', desc: 'Overall strike rate' },
            { label: 'Whiff%',   value: s.whiffPct != null ? Math.round(s.whiffPct)+'%' : '—', desc: 'Whiffs / swings' },
            { label: 'BABIP',    value: fmt(s.babip, 3), desc: 'Batting avg on BIP', lowerBetter: true },
            { label: 'Weak%',    value: s.weakPct != null ? Math.round(s.weakPct)+'%' : '—', desc: 'Infield BIP / total BIP' },
          ].map(({ label, value, desc, lowerBetter }) => (
            <div key={label} className={`rounded-xl p-3 ${lowerBetter ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-muted/40'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                <span className={`text-sm font-bold ${lowerBetter ? 'text-blue-600 dark:text-blue-400' : ''}`}>{value}</span>
              </div>
              <p className="text-[9px] text-muted-foreground/60 mt-0.5">{desc}{lowerBetter ? ' ↓ lower = better' : ''}</p>
            </div>
          ))}
        </CardContent>
        <div className="px-4 pb-3">
          <p className="text-[10px] text-muted-foreground/60">ERA unavailable — runs scored not tracked. FIP uses cFIP=3.20.</p>
        </div>
      </Card>

      {/* Pitch Arsenal */}
      {pitches.length > 0 && (
        <Card>
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pitch Arsenal Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <PitchUsageChart pitches={pitches} />
          </CardContent>
        </Card>
      )}

      {/* Performance trends */}
      {trendData.length >= 2 && (
        <Card>
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Performance Trends
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">WHIP per Game</p>
              <TrendChart data={trendData} metricKey="whip" label="WHIP" color="hsl(var(--primary))" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Strikeouts per Game</p>
              <TrendChart data={trendData} metricKey="ks" label="K" color="#d4a017" formatter={(v) => v} />
            </div>
            {showAllTrends && (
              <>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">FIP per Game</p>
                  <TrendChart data={trendData} metricKey="fip" label="FIP" color="#3b6fd4" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">K% per Game</p>
                  <TrendChart data={trendData} metricKey="kPct" label="K%" color="#8b5cf6" formatter={(v) => v+'%'} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">Pitch Count per Game</p>
                  <TrendChart data={trendData} metricKey="pitches" label="Pitches" color="#8ca0c0" formatter={(v) => v} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">Strike% per Game</p>
                  <TrendChart data={trendData} metricKey="strikePct" label="Strike%" color="#e05c6e" formatter={(v) => v+'%'} />
                </div>
              </>
            )}
            <button
              onClick={() => setShowAllTrends(v => !v)}
              className="flex items-center gap-1 text-xs text-primary font-medium mx-auto"
            >
              {showAllTrends ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> More trends</>}
            </button>
          </CardContent>
        </Card>
      )}
      </>}
    </div>
  );
}

// ── Sortable comparison table ────────────────────────────────────────────────
const COMPARE_COLS = [
  { key: 'name',    label: 'Pitcher', getValue: pd => pd.name, numeric: false, lowerBetter: false },
  { key: 'ks',      label: 'K',       getValue: pd => pd.stats.ks ?? -Infinity, numeric: true, lowerBetter: false },
  { key: 'whip',    label: 'WHIP',    getValue: pd => pd.stats.whip ?? Infinity, numeric: true, lowerBetter: true },
  { key: 'fip',     label: 'FIP',     getValue: pd => pd.stats.fip ?? Infinity, numeric: true, lowerBetter: true },
  { key: 'baa',     label: 'BAA',     getValue: pd => pd.stats.baa ?? Infinity, numeric: true, lowerBetter: true },
  { key: 'kPct',    label: 'K%',      getValue: pd => pd.stats.kPct ?? -Infinity, numeric: true, lowerBetter: false },
  { key: 'bbPct',   label: 'BB%',     getValue: pd => pd.stats.bbPct ?? -Infinity, numeric: true, lowerBetter: true },
  { key: 'babip',   label: 'BABIP',   getValue: pd => pd.stats.babip ?? Infinity, numeric: true, lowerBetter: true },
  { key: 'ip',      label: 'IP',      getValue: pd => pd.stats.ipDec ?? -Infinity, numeric: true, lowerBetter: false },
];

function exportCompareCSV(pitcherData) {
  const rows = [
    ['Pitcher','Games','K','WHIP','FIP','BAA','K%','BB%','BABIP','IP'],
    ...pitcherData.map(pd => {
      const s = pd.stats;
      return [
        pd.name, pd.gameData.length, s.ks,
        s.whip?.toFixed(2)??'', s.fip?.toFixed(2)??'',
        s.baa?.toFixed(3)??'',
        s.kPct!=null?Math.round(s.kPct)+'%':'',
        s.bbPct!=null?Math.round(s.bbPct)+'%':'',
        s.babip?.toFixed(3)??'', s.ip,
      ];
    }),
  ];
  const csv = rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='pitcher_comparison.csv'; a.click();
  URL.revokeObjectURL(url);
}

function CompareTable({ pitcherData }) {
  const [sortKey, setSortKey] = useState('ks');
  const [sortDir, setSortDir] = useState('desc');

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    const col = COMPARE_COLS.find(c => c.key === sortKey);
    if (!col) return pitcherData;
    return [...pitcherData].sort((a, b) => {
      const av = col.getValue(a);
      const bv = col.getValue(b);
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [pitcherData, sortKey, sortDir]);

  return (
    <Card>
      <CardHeader className="pb-1 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Side-by-Side Comparison
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => exportCompareCSV(pitcherData)}>
            <Download className="w-3 h-3" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b">
                {COMPARE_COLS.map(col => {
                  const active = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      className={`pb-2 ${col.key === 'name' ? 'text-left pr-2' : 'text-center px-1'} font-medium cursor-pointer select-none`}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className={`inline-flex items-center gap-0.5 ${active ? 'text-primary' : 'hover:text-foreground'} transition-colors`}>
                        {col.label}
                        {active
                          ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                          : <span className="w-3 h-3 opacity-30 inline-flex items-center"><ChevronDown className="w-3 h-3" /></span>
                        }
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map(pd => {
                const s = pd.stats;
                const cells = [
                  { key: 'name',  val: pd.name.toUpperCase(), lb: false },
                  { key: 'ks',    val: s.ks, lb: false },
                  { key: 'whip',  val: fmt(s.whip), lb: true },
                  { key: 'fip',   val: fmt(s.fip),  lb: true },
                  { key: 'baa',   val: s.baa != null ? fmt(s.baa, 3) : '—', lb: true },
                  { key: 'kPct',  val: s.kPct  != null ? Math.round(s.kPct)+'%'  : '—', lb: false },
                  { key: 'bbPct', val: s.bbPct != null ? Math.round(s.bbPct)+'%' : '—', lb: true },
                  { key: 'babip', val: fmt(s.babip, 3), lb: true },
                  { key: 'ip',    val: s.ip, lb: false },
                ];
                return (
                  <tr key={pd.name} className="border-b border-muted/30 last:border-0">
                    {cells.map(({ key, val, lb }, i) => (
                      <td key={key} className={`py-2 ${i === 0 ? 'pr-2 font-semibold truncate max-w-[70px]' : 'px-1 text-center'} ${lb ? 'text-blue-600 dark:text-blue-400' : i === 1 ? 'font-semibold text-primary' : ''}`}>
                        {val}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Analytics() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedPitcher, setSelectedPitcher] = useState(null);
  const [view, setView] = useState('overview'); // 'overview' | 'compare'
  const renamePitcher = useMutation({
    mutationFn: async ({ oldName, newName }) => {
      const allPitches = await base44.entities.Pitch.filter({ pitcher_name: oldName });
      await Promise.all(allPitches.map(p => base44.entities.Pitch.update(p.id, { pitcher_name: newName })));
      const allAtBats = await base44.entities.AtBat.filter({ pitcher_name: oldName });
      await Promise.all(allAtBats.map(ab => base44.entities.AtBat.update(ab.id, { pitcher_name: newName })));
    },
    onSuccess: (_, { newName }) => {
      queryClient.invalidateQueries({ queryKey: ['pitches-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['atBats-analytics'] });
      if (selectedPitcher) setSelectedPitcher(newName);
    }
  });

  const { data: pitches = [], isLoading } = useQuery({
    queryKey: ['pitches-analytics'],
    queryFn: () => base44.entities.Pitch.list('-created_date', 5000),
  });
  const { data: atBats = [] } = useQuery({
    queryKey: ['atBats-analytics'],
    queryFn: () => base44.entities.AtBat.list('-created_date', 5000),
  });
  const { data: games = [] } = useQuery({
    queryKey: ['games-analytics'],
    queryFn: () => base44.entities.Game.list('-date', 200),
  });

  const gameMap = useMemo(() => {
    const m = {};
    games.forEach(g => { m[g.id] = g; });
    return m;
  }, [games]);

  // Aggregate per-pitcher data
  const pitcherList = useMemo(() => {
    const nameMap = {};
    pitches.forEach(p => {
      if (!p.pitcher_name) return;
      const n = p.pitcher_name.trim();
      if (!nameMap[n]) nameMap[n] = [];
      nameMap[n].push(p);
    });
    return Object.entries(nameMap)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, pList]) => ({ name, pitches: pList }));
  }, [pitches]);

  // Build per-pitcher atBats and per-game breakdowns
  // Attribution: first try pitch→at_bat_id linkage; fall back to AtBat.pitcher_name field
  const pitcherData = useMemo(() => {
    // Collect all pitcher names: from pitches AND from atBats with pitcher_name
    const nameSet = new Set(pitcherList.map(p => p.name));
    atBats.forEach(ab => { if (ab.pitcher_name) nameSet.add(ab.pitcher_name.trim()); });

    return [...nameSet].map(name => {
      const pList = pitches.filter(p => p.pitcher_name?.trim() === name);
      // At-bats linked via pitch records
      const linkedAbIds = new Set(pList.map(p => p.at_bat_id).filter(Boolean));
      // At-bats directly stamped with pitcher_name (includes those entered without pitch tracking)
      const pitcherAtBats = atBats.filter(ab =>
        linkedAbIds.has(ab.id) || ab.pitcher_name?.trim() === name
      );
      // Deduplicate
      const seenIds = new Set();
      const uniqueAtBats = pitcherAtBats.filter(ab => {
        if (seenIds.has(ab.id)) return false;
        seenIds.add(ab.id);
        return true;
      });

      const gameIds = [...new Set([
        ...pList.map(p => p.game_id),
        ...uniqueAtBats.map(ab => ab.game_id),
      ].filter(Boolean))];

      const gameData = gameIds.map(gid => {
        const gp = pList.filter(p => p.game_id === gid);
        const gAbIds = new Set(gp.map(p => p.at_bat_id).filter(Boolean));
        const gAtBats = uniqueAtBats.filter(ab =>
          ab.game_id === gid && (gAbIds.has(ab.id) || ab.pitcher_name?.trim() === name)
        );
        const seenG = new Set();
        const uniqueGAtBats = gAtBats.filter(ab => {
          if (seenG.has(ab.id)) return false;
          seenG.add(ab.id);
          return true;
        });
        const battingUniqueGAtBats = uniqueGAtBats.filter(ab => ab.player_id !== 'ADVANCEMENT' && ab.player_name !== 'ADVANCEMENT');
        return { gameId: gid, game: gameMap[gid], pitches: gp, atBats: battingUniqueGAtBats };
      }).sort((a, b) => (a.game?.date || '').localeCompare(b.game?.date || ''));

      // Exclude synthetic ADVANCEMENT records from batting stat calculations
      const battingUniqueAtBats = uniqueAtBats.filter(ab => ab.player_id !== 'ADVANCEMENT' && ab.player_name !== 'ADVANCEMENT');
      return { name, pitches: pList, atBats: battingUniqueAtBats, gameData, stats: calcStats(pList, battingUniqueAtBats) };
    }).sort((a, b) => b.pitches.length - a.pitches.length);
  }, [pitcherList, atBats, gameMap, pitches]);

  const selected = pitcherData.find(p => p.name === selectedPitcher);

  function exportCSV() {
    const rows = [
      ['Pitcher','Games','IP','BF','PC','K','BB','H','HR','HBP','WHIP','FIP','K%','BB%','K/9','BB/9','K/BB','Strike%','Whiff%','BABIP','Weak%'],
      ...pitcherData.map(pd => {
        const s = pd.stats;
        const r = v => (v == null || isNaN(v) || !isFinite(v)) ? '' : v;
        const p1 = v => v != null ? Math.round(v) : '';
        return [
          pd.name, pd.gameData.length, s.ip, r(s.bf), r(s.totalPitches),
          r(s.ks), r(s.bbs), r(s.hitsAllowed), r(s.hrs), r(s.hbp),
          r(s.whip != null ? s.whip.toFixed(2) : null),
          r(s.fip  != null ? s.fip.toFixed(2)  : null),
          p1(s.kPct)  !== '' ? p1(s.kPct)+'%'  : '',
          p1(s.bbPct) !== '' ? p1(s.bbPct)+'%' : '',
          r(s.kPer9  != null ? s.kPer9.toFixed(1)  : null),
          r(s.bbPer9 != null ? s.bbPer9.toFixed(1) : null),
          r(s.kbb    != null ? s.kbb.toFixed(2)    : null),
          p1(s.strikePct) !== '' ? p1(s.strikePct)+'%' : '',
          p1(s.whiffPct)  !== '' ? p1(s.whiffPct)+'%'  : '',
          r(s.babip  != null ? s.babip.toFixed(3)  : null),
          p1(s.weakPct)   !== '' ? p1(s.weakPct)+'%'   : '',
        ];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'pitcher_stats.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10 -ml-2"
            onClick={() => navigate(createPageUrl('Home'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <p className="font-semibold text-sm">Pitcher Analytics</p>
            <p className="text-xs opacity-75">Career stats &amp; trends</p>
          </div>
          {selected ? (
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10 text-xs"
              onClick={() => setSelectedPitcher(null)}>
              All Pitchers
            </Button>
          ) : (
            <div className="flex rounded-lg overflow-hidden border border-white/20">
              {['overview', 'compare', 'matchups'].map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1 text-xs font-medium capitalize transition-colors ${view === v ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white/80'}`}>
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
        ) : pitcherData.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground space-y-3">
            <BarChart3 className="w-12 h-12 mx-auto opacity-20" />
            <p className="font-medium">No pitcher data yet</p>
            <p className="text-xs max-w-[220px] mx-auto">Assign a pitcher in the game tracker and log pitches to see analytics here.</p>
          </div>
        ) : selected ? (
          <PitcherDetail
            name={selected.name}
            pitches={selected.pitches}
            atBats={selected.atBats}
            gameData={selected.gameData}
          />
        ) : view === 'compare' ? (
          <PitcherCompare pitcherData={pitcherData} />
        ) : view === 'matchups' ? (
          <MatchupsView pitches={pitches} atBats={atBats} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">
                {pitcherData.length} pitcher{pitcherData.length !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={exportCSV}>
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </Button>
              </div>
            </div>
            {pitcherData.map(pd => (
              <CompareRow
                key={pd.name}
                name={pd.name}
                s={pd.stats}
                gamesPlayed={pd.gameData.length}
                isSelected={selectedPitcher === pd.name}
                onClick={() => setSelectedPitcher(pd.name)}
                onRename={(oldName, newName) => renamePitcher.mutate({ oldName, newName })}
              />
            ))}

            {/* Quick comparison table for 2+ pitchers */}
            {pitcherData.length >= 2 && (
              <CompareTable pitcherData={pitcherData} />
            )}
          </>
        )}
      </div>


    </div>
  );
}