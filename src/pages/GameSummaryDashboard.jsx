import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Trophy, Zap, Target, TrendingUp } from 'lucide-react';
import { jsPDF } from 'jspdf';

const HIT_RESULTS = ['single', 'double', 'triple', 'home_run', 'bunt_single'];
const OUT_RESULTS = ['strikeout_swinging','strikeout_looking','groundout','flyout','lineout','popout','bunt_out','rbi_groundout','sac_fly','sac_bunt','fielders_choice','in_play_out','double_play','triple_play'];
const RISP_SITUATIONS = ['second','third','first_second','first_third','second_third','bases_loaded'];

function StatBox({ label, value, sub, highlight }) {
  return (
    <div className={`rounded-xl p-3 text-center ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
      <p className={`text-xl font-bold leading-none ${highlight ? 'text-primary' : ''}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 mt-1">{children}</h2>
  );
}

export default function GameSummaryDashboard() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get('id');

  const { data: game } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => base44.entities.Game.filter({ id: gameId }).then(r => r[0] || null),
    enabled: !!gameId,
  });

  const { data: gameData = {}, isLoading } = useQuery({
    queryKey: ['gameData', gameId],
    queryFn: async () => {
      const [pitchesByGame, atBats] = await Promise.all([
        base44.entities.Pitch.filter({ game_id: gameId }),
        base44.entities.AtBat.filter({ game_id: gameId }),
      ]);

      let pitches = pitchesByGame;

      // If no pitches found by game_id, try two fallback strategies:
      // 1. Match via real at_bat_id (pitch.at_bat_id === atBat.id)
      // 2. Match via temp at_bat_id pattern ("ab-TIMESTAMP") cross-referenced with created_date
      //    (pitches share the same temp atBatId as the at-bat session)
      if (pitches.length === 0 && atBats.length > 0) {
        const pitcherNames = [...new Set(atBats.map(ab => ab.pitcher_name).filter(Boolean))];
        if (pitcherNames.length > 0) {
          const pitchesByPitchers = await Promise.all(
            pitcherNames.map(name => base44.entities.Pitch.filter({ pitcher_name: name }))
          );
          const candidatePitches = pitchesByPitchers.flat();

          // Strategy 1: real at_bat_id linkage
          const realAtBatIds = new Set(atBats.map(ab => ab.id).filter(Boolean));
          const linkedByRealId = candidatePitches.filter(p => realAtBatIds.has(p.at_bat_id));

          if (linkedByRealId.length > 0) {
            pitches = linkedByRealId;
          } else {
            // Strategy 2: temp at_bat_id linkage — pitches saved with "ab-TIMESTAMP" temp IDs
            // Group at-bats by their temp at_bat_id values stored in pitch records
            const tempAtBatIds = new Set(
              candidatePitches.map(p => p.at_bat_id).filter(id => id && id.startsWith('ab-'))
            );
            // Find which of those temp IDs correspond to this game by checking
            // that the at-bats were created around the same time as this game's at-bats
            if (tempAtBatIds.size > 0 && atBats.length > 0) {
              // Use the earliest and latest at-bat created_date as the time window
              const abDates = atBats.map(ab => new Date(ab.created_date).getTime()).filter(Boolean);
              const minDate = Math.min(...abDates) - 24 * 60 * 60 * 1000; // 1 day buffer
              const maxDate = Math.max(...abDates) + 24 * 60 * 60 * 1000;
              const linkedByTime = candidatePitches.filter(p => {
                if (!p.at_bat_id?.startsWith('ab-')) return false;
                const pDate = new Date(p.created_date).getTime();
                return pDate >= minDate && pDate <= maxDate;
              });
              if (linkedByTime.length > 0) {
                pitches = linkedByTime;
              }
            }
          }
        }
      }

      return { pitches, atBats };
    },
    enabled: !!gameId,
  });

  const atBats = gameData.atBats || [];
  const pitches = gameData.pitches || [];
  // Exclude synthetic runner-advancement records from batting stats.
  // These are created when runs score on wild pitches, balks, passed balls, etc.
  const battingABs = atBats.filter(ab => ab.player_id !== 'ADVANCEMENT' && ab.player_name !== 'ADVANCEMENT');

  const stats = useMemo(() => {
    const totalABs = battingABs.length;
    const hits = battingABs.filter(ab => HIT_RESULTS.includes(ab.result)).length;
    const singles = battingABs.filter(ab => ab.result === 'single' || ab.result === 'bunt_single').length;
    const doubles = battingABs.filter(ab => ab.result === 'double').length;
    const triples = battingABs.filter(ab => ab.result === 'triple').length;
    const hrs = battingABs.filter(ab => ab.result === 'home_run').length;
    const walks = battingABs.filter(ab => ab.result === 'walk').length;
    const hbp = battingABs.filter(ab => ab.result === 'hbp').length;
    const ks = battingABs.filter(ab => ab.result?.includes('strikeout')).length;
    const sacFlies = battingABs.filter(ab => ab.result === 'sac_fly').length;
    const sacBunts = battingABs.filter(ab => ab.result === 'sac_bunt').length;
    const errors = battingABs.filter(ab => ab.result === 'error').length;
    const dps = battingABs.filter(ab => ab.result === 'double_play').length;

    // Official AB (exclude walks, HBP, sac fly, sac bunt)
    const officialABs = totalABs - walks - hbp - sacFlies - sacBunts;
    const avg = officialABs > 0 ? hits / officialABs : 0;
    const obp = (officialABs + walks + hbp + sacFlies) > 0 ? (hits + walks + hbp) / (officialABs + walks + hbp + sacFlies) : 0;
    const tbases = singles + doubles * 2 + triples * 3 + hrs * 4;
    const slg = officialABs > 0 ? tbases / officialABs : 0;
    const ops = obp + slg;

    // Runs scored = sum of rbis across ALL at-bats including advancement records
    const runsScored = atBats.reduce((sum, ab) => sum + (ab.rbis || 0), 0);

    // RISP — batting ABs only
    const rispABs = battingABs.filter(ab => RISP_SITUATIONS.includes(ab.runners_on_base));
    const rispHitsCount = rispABs.filter(ab => HIT_RESULTS.includes(ab.result)).length;
    const rispOfficialABs = rispABs.filter(ab => !['walk','hbp','sac_fly','sac_bunt'].includes(ab.result)).length;
    const rispAvg = rispOfficialABs > 0 ? rispHitsCount / rispOfficialABs : null;

    // LOB — batting ABs only (advancement records have no meaningful runners_on_base)
    const lob = battingABs.reduce((sum, ab) => {
      if (!OUT_RESULTS.includes(ab.result) && ab.result !== 'double_play' && ab.result !== 'triple_play') return sum;
      const bases = ab.runners_on_base || 'none';
      if (bases === 'none') return sum;
      if (bases === 'first' || bases === 'second' || bases === 'third') return sum + 1;
      if (bases === 'first_second' || bases === 'first_third' || bases === 'second_third') return sum + 2;
      if (bases === 'bases_loaded') return sum + 3;
      return sum;
    }, 0);

    // ── Pitching stats ──
    // totalPitches from DB pitch records; will be reconciled after pitcherStats are built.
    const dbTotalPitches = pitches.length;
    const strikes = pitches.filter(p => ['called_strike','swinging_strike','foul','foul_tip','in_play_out','in_play_hit'].includes(p.result)).length;
    const strikeRate = dbTotalPitches > 0 ? strikes / dbTotalPitches : 0;
    const pitcherNames = [...new Set(pitches.map(p => p.pitcher_name).filter(Boolean))];

    // Per-pitcher summary — derive names from pitch records AND at-bat records (all ABs incl. advancement)
    const atBatToPitcher = {};
    pitches.forEach(p => { if (p.at_bat_id && p.pitcher_name) atBatToPitcher[p.at_bat_id] = p.pitcher_name; });
    const pitcherNamesFromABs = [...new Set(atBats.map(ab => ab.pitcher_name).filter(Boolean))];
    const allPitcherNames = [...new Set([...pitcherNames, ...pitcherNamesFromABs])];
    const getABsForPitcher = (name) => {
      const seen = new Set();
      return atBats.filter(ab => {
        const match = atBatToPitcher[ab.id] === name || ab.pitcher_name === name;
        if (!match || seen.has(ab.id)) return false;
        seen.add(ab.id); return true;
      });
    };

    const pitcherStats = allPitcherNames.map(name => {
      const pp = pitches.filter(p => p.pitcher_name === name);
      const pab = getABsForPitcher(name);
      // For IP/K/BB/H stats: exclude synthetic advancement records
      const pBattingABs = pab.filter(ab => ab.player_id !== 'ADVANCEMENT' && ab.player_name !== 'ADVANCEMENT');
      const pOuts = pBattingABs.reduce((acc, ab) => {
        if (ab.result === 'double_play') return acc + 2;
        if (ab.result === 'triple_play') return acc + 3;
        return OUT_RESULTS.includes(ab.result) ? acc + 1 : acc;
      }, 0);
      const pK = pBattingABs.filter(ab => ab.result?.includes('strikeout')).length;
      const pBB = pBattingABs.filter(ab => ab.result === 'walk').length;
      const pHits = pBattingABs.filter(ab => HIT_RESULTS.includes(ab.result)).length;
      // Runs allowed: include ALL ABs (batting + advancement) since advancement ABs carry rbis
      const pRunsAllowed = pab.reduce((s, ab) => s + (ab.rbis || 0), 0);

      // ER: AtBat.earned_runs is the single source of truth (from all ABs including advancement).
      const erFromABs = pab.reduce((s, ab) => s + (ab.earned_runs || 0), 0);
      const erFromPitches = pp.reduce((s, p) => s + (p.earned_runs || 0), 0);
      const hasABLevelER = pab.some(ab => ab.earned_runs != null); // includes 0
      const pER = hasABLevelER ? erFromABs : erFromPitches;
      const pUER = Math.max(0, pRunsAllowed - pER);

      const ip = `${Math.floor(pOuts / 3)}.${pOuts % 3}`;
      const pBF = pBattingABs.length;

      // Pitch count: prefer DB pitch records (most accurate).
      // Fallback: sum balls+strikes from at-bat records for pitchers tracked via the At-Bat tab
      // (where individual pitches weren't logged but the count was still incremented per pitch).
      // This prevents PC showing 0 for pitchers who have at-bat data but no linked pitch records.
      let pc = pp.length;
      if (pc === 0 && pBattingABs.length > 0) {
        pc = pBattingABs.reduce((sum, ab) => sum + (ab.balls || 0) + (ab.strikes || 0), 0);
      }

      return { name, pc, ip, k: pK, bb: pBB, h: pHits, er: pER, uer: pUER, r: pRunsAllowed, bf: pBF };
    });

    // ── Per-inning — use battingABs for H/K, all atBats for R ──
    const innMap = {};
    battingABs.forEach(ab => {
      const inn = ab.inning || 1;
      if (!innMap[inn]) innMap[inn] = { hits: 0, runs: 0, ks: 0 };
      if (HIT_RESULTS.includes(ab.result)) innMap[inn].hits++;
      if (ab.result?.includes('strikeout')) innMap[inn].ks++;
    });
    // Add runs from all ABs (including advancement records)
    atBats.forEach(ab => {
      const inn = ab.inning || 1;
      if (!innMap[inn]) innMap[inn] = { hits: 0, runs: 0, ks: 0 };
      innMap[inn].runs += (ab.rbis || 0);
    });
    const inningRows = Object.entries(innMap)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([inn, d]) => ({ inn: Number(inn), ...d }));

    // Total earned/unearned across all pitchers
    const totalER = pitcherStats.reduce((s, p) => s + p.er, 0);
    const totalUER = pitcherStats.reduce((s, p) => s + p.uer, 0);
    // Use sum of per-pitcher PC (which falls back to balls+strikes) so totalPitches
    // is always consistent with the per-pitcher rows — never shows 0 when pitches exist.
    const totalPitches = pitcherStats.length > 0
      ? pitcherStats.reduce((s, p) => s + p.pc, 0)
      : dbTotalPitches;

    return {
      totalABs, hits, singles, doubles, triples, hrs, walks, hbp, ks,
      avg, obp, slg, ops, runsScored, rispAvg, rispHits: rispHitsCount, lob, errors, dps,
      totalPitches, strikeRate, pitcherStats, inningRows, totalER, totalUER,
    };
  }, [atBats, pitches]);

  const handleExportPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const PAD = 15;
    const contentW = pageW - PAD * 2;
    const dateStr = game?.date ? new Date(game.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const fmt3 = n => (n == null || isNaN(n) || !isFinite(n)) ? '.000' : n.toFixed(3).replace(/^0/, '');

    // ── Header ──────────────────────────────────────────────────
    doc.setFillColor(22, 101, 52);
    doc.rect(0, 0, pageW, 38, 'F');
    doc.setFillColor(20, 83, 45);
    doc.rect(0, 34, pageW, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text(`vs ${(game?.opponent || '').toUpperCase()}`, PAD, 17);

    doc.setTextColor(134, 239, 172);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    const subInfo = [dateStr, game?.location, game?.status === 'final' ? 'FINAL' : 'In Progress'].filter(Boolean).join('  ·  ');
    doc.text(subInfo, PAD, 27);

    doc.setTextColor(134, 239, 172);
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text("POCKET PITCHER '27", pageW - PAD, 15, { align: 'right' });
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    doc.text('Game Summary', pageW - PAD, 22, { align: 'right' });

    const statBox = (x, y, w, h, label, value, hl = false, vColor = [31,41,55]) => {
      doc.setFillColor(...(hl ? [220,252,231] : [243,244,246]));
      doc.roundedRect(x, y, w, h, 3, 3, 'F');
      doc.setTextColor(...vColor);
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.text(String(value), x + w / 2, y + h / 2 - 0.5, { align: 'center', baseline: 'middle' });
      doc.setTextColor(107,114,128);
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.text(label, x + w / 2, y + h - 3, { align: 'center' });
    };

    const secTitle = (x, y, title) => {
      doc.setTextColor(107,114,128);
      doc.setFontSize(7.5);
      doc.setFont(undefined, 'bold');
      doc.text(title.toUpperCase(), x, y);
      doc.setDrawColor(107,114,128);
      doc.setLineWidth(0.3);
      doc.line(x + doc.getTextWidth(title.toUpperCase()) + 3, y - 1, 195, y - 1);
    };

    let y = 48;

    // ── Team Batting ─────────────────────────────────────────────
    secTitle(PAD, y, 'Team Batting');
    y += 5;

    const heroW = (contentW - 9) / 4;
    const heroVals = [
      { label: 'AVG', value: fmt3(stats.avg), hl: true, c: [22,101,52] },
      { label: 'OBP', value: fmt3(stats.obp), c: [37,99,235] },
      { label: 'SLG', value: fmt3(stats.slg), c: [37,99,235] },
      { label: 'OPS', value: (stats.ops ?? 0).toFixed(3).replace(/^0/,''), c: [31,41,55] },
    ];
    heroVals.forEach(({ label, value, hl, c }, i) => {
      statBox(PAD + i * (heroW + 3), y, heroW, 18, label, value, hl, c);
    });
    y += 22;

    const countW = (contentW - 8 * 2) / 9;
    const countVals = [
      { label: 'Runs', value: stats.runsScored, hl: true },
      { label: 'Hits', value: stats.hits },
      { label: '2B',   value: stats.doubles },
      { label: '3B',   value: stats.triples },
      { label: 'HR',   value: stats.hrs, c: [220,38,38] },
      { label: 'BB',   value: stats.walks },
      { label: 'K',    value: stats.ks, c: [220,38,38] },
      { label: 'HBP',  value: stats.hbp },
      { label: 'LOB',  value: stats.lob },
    ];
    countVals.forEach(({ label, value, hl, c }, i) => {
      statBox(PAD + i * (countW + 2), y, countW, 14, label, value, hl, c || [31,41,55]);
    });
    y += 20;

    // ── Pitching ─────────────────────────────────────────────────
    secTitle(PAD, y, 'Pitching');
    y += 5;

    const pitchTopW = (contentW - 2) / 3;
    [
      { label: 'Total Pitches', value: stats.totalPitches },
      { label: 'Strike%', value: stats.totalPitches > 0 ? Math.round(stats.strikeRate * 100) + '%' : '—' },
      { label: 'Pitchers Used', value: stats.pitcherStats.length },
    ].forEach(({ label, value }, i) => {
      statBox(PAD + i * (pitchTopW + 1), y, pitchTopW, 14, label, value);
    });
    y += 18;

    if (stats.pitcherStats.length > 0) {
      // Table header
      doc.setFillColor(22, 101, 52);
      doc.rect(PAD, y, contentW, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      const cols = ['PITCHER', 'IP', 'PC', 'K', 'BB', 'H', 'R', 'ER', 'UER'];
      const cxs  = [PAD + 2, PAD + 46, PAD + 60, PAD + 74, PAD + 88, PAD + 102, PAD + 116, PAD + 130, PAD + 145];
      cols.forEach((c, i) => doc.text(c, cxs[i], y + 4.5));
      y += 8;

      stats.pitcherStats.forEach((p, idx) => {
        if (idx % 2 === 0) { doc.setFillColor(249, 250, 251); doc.rect(PAD, y, contentW, 7, 'F'); }
        doc.setTextColor(31, 41, 55);
        doc.setFont(undefined, idx === 0 ? 'bold' : 'normal');
        doc.setFontSize(8);
        doc.text(p.name.toUpperCase().slice(0, 16), cxs[0], y + 5);
        [p.ip, p.pc, p.k, p.bb, p.h, p.r, p.er, p.uer > 0 ? p.uer : '—'].forEach((v, i) => {
          // K=green, BB/H/ER=red, UER=amber
          const isK = i === 2, isBad = i === 3 || i === 4 || i === 6, isUER = i === 7;
          doc.setTextColor(
            isK ? 22 : isBad ? 220 : isUER ? 180 : 31,
            isK ? 101 : isBad ? 38 : isUER ? 120 : 41,
            isK ? 52 : isBad ? 38 : isUER ? 0 : 55
          );
          doc.text(String(v ?? 0), cxs[i + 1], y + 5);
        });
        y += 7;
      });
      y += 4;
    }

    // ── By Inning ────────────────────────────────────────────────
    if (stats.inningRows.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      secTitle(PAD, y, 'By Inning');
      y += 5;
      doc.setFillColor(22, 101, 52);
      doc.rect(PAD, y, contentW, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      ['INN', 'H', 'R', 'K'].forEach((h, i) => doc.text(h, PAD + 2 + i * 20, y + 4.5));
      y += 8;
      stats.inningRows.forEach((r, idx) => {
        if (idx % 2 === 0) { doc.setFillColor(249, 250, 251); doc.rect(PAD, y, contentW, 7, 'F'); }
        doc.setTextColor(31, 41, 55);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        [r.inn, r.hits, r.runs, r.ks].forEach((v, i) => doc.text(String(v), PAD + 2 + i * 20, y + 5));
        y += 7;
      });
      y += 4;
    }

    // ── Footer ────────────────────────────────────────────────────
    doc.setFillColor(22, 101, 52);
    doc.rect(0, 285, pageW, 12, 'F');
    doc.setTextColor(134, 239, 172);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text("Pocket Pitcher '27  ·  Baseball Stats & Analytics", PAD, 292.5);
    doc.text(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), pageW - PAD, 292.5, { align: 'right' });

    const safeName = (game?.opponent || 'opponent').replace(/[^a-z0-9]/gi, '_');
    doc.save(`GameSummary_vs${safeName}_${game?.date || 'date'}.pdf`);
  };

  if (!gameId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No game selected.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const fmt3 = n => (n == null || isNaN(n)) ? '.000' : n.toFixed(3).replace(/^0/, '');
  const dateStr = game?.date ? new Date(game.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate uppercase">vs {game?.opponent}</p>
          <p className="text-xs text-muted-foreground">{dateStr}{game?.location ? ` · ${game.location}` : ''}</p>
        </div>
        {game?.status === 'final' && (
          <Badge className="bg-green-100 text-green-700 border-green-300">Final</Badge>
        )}
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleExportPDF}>
          <Download className="w-3.5 h-3.5" />
          PDF
        </Button>
      </div>

      <div className="px-4 py-4 space-y-5 pb-10">

        {/* Hero headline */}
        <div className="flex items-center gap-3 bg-primary/5 rounded-2xl p-4 border border-primary/10">
          <Trophy className="w-8 h-8 text-accent shrink-0" />
          <div>
            <p className="text-lg font-bold uppercase">vs {game?.opponent}</p>
            <p className="text-sm text-muted-foreground">{dateStr} · {battingABs.length} at-bats · {pitches.length} pitches recorded</p>
          </div>
        </div>

        {/* ── Team Batting ── */}
        <section>
          <SectionTitle>Team Batting</SectionTitle>
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <StatBox label="AVG"  value={fmt3(stats.avg)}  highlight />
                <StatBox label="OBP"  value={fmt3(stats.obp)} />
                <StatBox label="SLG"  value={fmt3(stats.slg)} />
                <StatBox label="OPS"  value={(stats.ops ?? 0).toFixed(3).replace(/^0/,'')} />
              </div>
              <div className="grid grid-cols-5 gap-2">
                <StatBox label="Runs" value={stats.runsScored} highlight />
                <StatBox label="Hits" value={stats.hits} />
                <StatBox label="2B"   value={stats.doubles} />
                <StatBox label="3B"   value={stats.triples} />
                <StatBox label="HR"   value={stats.hrs} />
              </div>
              <div className="grid grid-cols-5 gap-2">
                <StatBox label="BB"   value={stats.walks} />
                <StatBox label="K"    value={stats.ks} />
                <StatBox label="HBP"  value={stats.hbp} />
                <StatBox label="E"    value={stats.errors} />
                <StatBox label="LOB"  value={stats.lob} />
              </div>
              {stats.rispAvg !== null && (
                <div className="grid grid-cols-2 gap-2">
                  <StatBox label="RISP AVG" value={fmt3(stats.rispAvg)} sub="runners in scoring position" highlight />
                  <StatBox label="DP"       value={stats.dps} sub="double plays hit into" />
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Pitching ── */}
        {(stats.totalPitches > 0 || stats.pitcherStats.length > 0 || atBats.length > 0) && (
          <section>
            <SectionTitle>Pitching</SectionTitle>
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <StatBox label="Total Pitches" value={stats.totalPitches} highlight />
                  <StatBox label="Strike%" value={stats.totalPitches > 0 ? Math.round(stats.strikeRate * 100) + '%' : '—'} />
                </div>
                {stats.pitcherStats.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Per Pitcher</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b">
                            <th className="text-left pb-2 pr-2">Pitcher</th>
                            <th className="text-center pb-2 px-1">IP</th>
                            <th className="text-center pb-2 px-1">PC</th>
                            <th className="text-center pb-2 px-1">K</th>
                            <th className="text-center pb-2 px-1">BB</th>
                            <th className="text-center pb-2 px-1">H</th>
                            <th className="text-center pb-2 px-1">R</th>
                            <th className="text-center pb-2 px-1">ER</th>
                            <th className="text-center pb-2 px-1">UER</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.pitcherStats.map(p => (
                            <tr key={p.name} className="border-b border-muted/30 last:border-0">
                              <td className="py-2 pr-2 font-semibold truncate max-w-[80px]">{p.name.toUpperCase()}</td>
                              <td className="py-2 px-1 text-center">{p.ip}</td>
                              <td className="py-2 px-1 text-center font-semibold">{p.pc}</td>
                              <td className="py-2 px-1 text-center text-primary font-semibold">{p.k}</td>
                              <td className="py-2 px-1 text-center">{p.bb}</td>
                              <td className="py-2 px-1 text-center text-destructive">{p.h}</td>
                              <td className="py-2 px-1 text-center font-semibold">{p.r}</td>
                              <td className="py-2 px-1 text-center text-destructive font-semibold">{p.er}</td>
                              <td className="py-2 px-1 text-center text-amber-600">{p.uer > 0 ? p.uer : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {stats.totalUER > 0 && (
                      <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        ⚠ {stats.totalUER} unearned run{stats.totalUER !== 1 ? 's' : ''} — scored due to error or reach-on-error. Shown in R column but excluded from ER and ERA.
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">R = Runs allowed · ER = Earned runs · UER = Unearned runs</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Situational Stats ── */}
        <section>
          <SectionTitle>Situational Stats</SectionTitle>
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-muted/30">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium">With RISP</span>
                  </div>
                  <span className="font-bold text-sm">{stats.rispAvg !== null ? `${stats.rispHits ?? stats.hits} H · .${Math.round(stats.rispAvg * 1000).toString().padStart(3,'0')} AVG` : '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-muted/30">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-sm font-medium">Extra-Base Hits</span>
                  </div>
                  <span className="font-bold text-sm">{stats.doubles + stats.triples + stats.hrs} ({stats.doubles} 2B · {stats.triples} 3B · {stats.hrs} HR)</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-muted/30">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="text-sm font-medium">Walks / Strikeouts</span>
                  </div>
                  <span className="font-bold text-sm">{stats.walks} BB · {stats.ks} K ({stats.totalABs > 0 ? Math.round((stats.ks / stats.totalABs) * 100) : 0}% K rate)</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏃</span>
                    <span className="text-sm font-medium">Left on Base</span>
                  </div>
                  <span className="font-bold text-sm">{stats.lob} runners</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Per-Inning ── */}
        {stats.inningRows.length > 0 && (
          <section>
            <SectionTitle>By Inning</SectionTitle>
            <Card>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="text-left pb-2 pr-3">Inn</th>
                        <th className="text-center pb-2 px-2">H</th>
                        <th className="text-center pb-2 px-2">R</th>
                        <th className="text-center pb-2 px-2">K</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.inningRows.map(row => (
                        <tr key={row.inn} className="border-b border-muted/30 last:border-0">
                          <td className="py-2 pr-3 font-semibold">Inning {row.inn}</td>
                          <td className="py-2 px-2 text-center">{row.hits}</td>
                          <td className="py-2 px-2 text-center font-semibold text-primary">{row.runs}</td>
                          <td className="py-2 px-2 text-center">{row.ks}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/30 font-bold">
                        <td className="py-2 pr-3">TOTAL</td>
                        <td className="py-2 px-2 text-center">{stats.hits}</td>
                        <td className="py-2 px-2 text-center text-primary">{stats.runsScored}</td>
                        <td className="py-2 px-2 text-center">{stats.ks}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Export button at bottom */}
        <Button className="w-full h-12 text-base font-semibold gap-2" onClick={handleExportPDF}>
          <Download className="w-5 h-5" />
          Export Full Summary as PDF
        </Button>

      </div>
    </div>
  );
}