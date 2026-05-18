import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Globe, Loader2, AlertCircle, CheckCircle2, Trash2, ChevronDown, ChevronUp, Users } from 'lucide-react';

const STAT_LABELS = {
  avg: 'AVG', obp: 'OBP', slg: 'SLG', ops: 'OPS',
  ab: 'AB', r: 'R', h: 'H', '2b': '2B', '3b': '3B',
  hr: 'HR', rbi: 'RBI', bb: 'BB', so: 'SO', sb: 'SB', gp: 'GP',
};

// Normalize: uppercase, letters/digits only
function norm(n) {
  return (n || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Handle "Last, First" or "First Last" formats — returns [firstName, lastName]
function parseName(raw) {
  const s = (raw || '').trim();
  if (s.includes(',')) {
    const [last, first] = s.split(',').map(p => p.trim());
    return { first: first || '', last: last || '', full: `${first} ${last}`.trim() };
  }
  const parts = s.split(/\s+/);
  return { first: parts[0] || '', last: parts[parts.length - 1] || '', full: s };
}

function matchPlayer(scrapedName, rosterPlayers) {
  const sp = parseName(scrapedName);

  // 1. Exact full name match (normalized)
  let match = rosterPlayers.find(p => norm(p.name) === norm(sp.full));
  if (match) return match;

  // 2. Last name exact + first initial match
  match = rosterPlayers.find(p => {
    const rp = parseName(p.name);
    return norm(rp.last) === norm(sp.last) &&
      sp.first && rp.first &&
      norm(rp.first)[0] === norm(sp.first)[0];
  });
  if (match) return match;

  // 3. Last name only match (fallback)
  match = rosterPlayers.find(p => {
    const rp = parseName(p.name);
    return norm(rp.last) === norm(sp.last) && norm(rp.last).length > 3;
  });
  return match || null;
}

export default function ImportStats({ embedded = false }) {
  const [statsUrl, setStatsUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [scraped, setScraped] = useState([]);
  const [matched, setMatched] = useState([]); // [{scraped, roster, include, overrideId}]
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [manualPickIdx, setManualPickIdx] = useState(null); // index being manually assigned

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list('name'),
  });

  // Always fetch all players so matching works reliably
  const { data: allPlayers = [], isLoading: playersLoading } = useQuery({
    queryKey: ['teamPlayers-all'],
    queryFn: () => base44.entities.TeamPlayer.list('name'),
  });

  const rosterPool = selectedTeamId
    ? allPlayers.filter(p => p.team_id === selectedTeamId)
    : allPlayers;

  const [fetchElapsed, setFetchElapsed] = useState(0);
  const fetchTimerRef = useRef(null);

  const handleFetch = async () => {
    if (!statsUrl.trim()) return;
    setFetching(true);
    setFetchElapsed(0);
    setError(null);
    setScraped([]);
    setMatched([]);
    setResults(null);
    setManualPickIdx(null);
    fetchTimerRef.current = setInterval(() => setFetchElapsed(s => s + 1), 1000);

    try {
      let players = null;

      // First try: backend HTML parser (fast, works for static sites)
      try {
        const res = await base44.functions.invoke('fetchBattingStats', { stats_url: statsUrl.trim() });
        if (res.data?.players?.length) {
          players = res.data.players;
        }
      } catch (backendErr) {
        console.log('Backend fetch failed, trying LLM fallback:', backendErr.message);
      }

      // Fallback: LLM with internet (for JS-rendered Sidearm/PrestoSports sites)
      if (!players) {
        const result = await base44.integrations.Core.InvokeLLM({
          model: 'gemini_3_flash',
          prompt: `Go to this URL and list every player's batting statistics from the stats page: ${statsUrl.trim()}

For each player output one line in this exact format:
NUMBER|NAME|AVG|AB|R|H|2B|3B|HR|RBI|BB|SO|SB|OBP|SLG|OPS|GP

Rules:
- NUMBER: jersey number, or blank
- NAME: full name exactly as shown
- All stat values: numeric only (e.g. .312, 45, 12) or blank if not shown
- One player per line, no header line, no extra text
- Do NOT invent players — only list what's on the page
- Skip totals/team rows`,
          add_context_from_internet: true,
        });

        const lines = (typeof result === 'string' ? result : '').split('\n').map(l => l.trim()).filter(l => l.includes('|'));
        players = [];
        for (const line of lines) {
          const parts = line.split('|');
          if (parts.length < 2) continue;
          const name = (parts[1] || '').trim();
          if (!name || name.length < 2) continue;
          const parseNum = (v) => { const n = parseFloat((v||'').replace(/[^0-9.\-]/g,'')); return isNaN(n) ? null : n; };
          players.push({
            name: name.toUpperCase(),
            number: (parts[0] || '').trim(),
            avg:  parseNum(parts[2]),
            ab:   parseNum(parts[3]),
            r:    parseNum(parts[4]),
            h:    parseNum(parts[5]),
            '2b': parseNum(parts[6]),
            '3b': parseNum(parts[7]),
            hr:   parseNum(parts[8]),
            rbi:  parseNum(parts[9]),
            bb:   parseNum(parts[10]),
            so:   parseNum(parts[11]),
            sb:   parseNum(parts[12]),
            obp:  parseNum(parts[13]),
            slg:  parseNum(parts[14]),
            ops:  parseNum(parts[15]),
            gp:   parseNum(parts[16]),
          });
        }
      }

      if (!players?.length) {
        setError('Could not find batting stats on this page. The site may block automated access or the URL may be incorrect.');
        return;
      }

      setScraped(players);
      setMatched(players.map(sp => ({
        scraped: sp,
        roster: matchPlayer(sp.name, rosterPool),
        include: true,
        overrideId: null,
      })));
    } catch (err) {
      setError(err.message || 'Failed to fetch stats. Check the URL and try again.');
    } finally {
      clearInterval(fetchTimerRef.current);
      setFetching(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setResults(null);
    const today = new Date().toISOString().split('T')[0];
    let success = 0, failed = 0, skipped = 0, errors = [];

    const toUpdate = [];
    for (const row of matched) {
      if (!row.include) { skipped++; continue; }
      const targetPlayer = row.overrideId
        ? allPlayers.find(p => p.id === row.overrideId)
        : row.roster;
      if (!targetPlayer) { failed++; errors.push(`No roster match for: ${row.scraped.name}`); continue; }

      const sp = row.scraped;
      const update = { stats_source_url: statsUrl.trim(), stats_updated: today };
      if (sp.avg   != null) update.stats_avg  = sp.avg;
      if (sp.obp   != null) update.stats_obp  = sp.obp;
      if (sp.slg   != null) update.stats_slg  = sp.slg;
      if (sp.ops   != null) update.stats_ops  = sp.ops;
      if (sp.ab    != null) update.stats_ab   = sp.ab;
      if (sp.r     != null) update.stats_r    = sp.r;
      if (sp.h     != null) update.stats_h    = sp.h;
      if (sp['2b'] != null) update.stats_2b   = sp['2b'];
      if (sp['3b'] != null) update.stats_3b   = sp['3b'];
      if (sp.hr    != null) update.stats_hr   = sp.hr;
      if (sp.rbi   != null) update.stats_rbi  = sp.rbi;
      if (sp.bb    != null) update.stats_bb   = sp.bb;
      if (sp.so    != null) update.stats_so   = sp.so;
      if (sp.sb    != null) update.stats_sb   = sp.sb;
      if (sp.gp    != null) update.stats_gp   = sp.gp;
      toUpdate.push({ id: targetPlayer.id, update, name: row.scraped.name });
    }

    // Parallel batch update
    const settled = await Promise.allSettled(
      toUpdate.map(({ id, update }) => base44.entities.TeamPlayer.update(id, update))
    );
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') success++;
      else { failed++; errors.push(`${toUpdate[i].name}: ${r.reason?.message || 'failed'}`); }
    });

    setResults({ success, failed, skipped, errors });
    setImporting(false);
  };

  const toggleRow = (i) => {
    setMatched(prev => prev.map((r, idx) => idx === i ? { ...r, include: !r.include } : r));
  };

  const assignOverride = (rowIdx, playerId) => {
    setMatched(prev => prev.map((r, idx) =>
      idx === rowIdx ? { ...r, overrideId: playerId, include: true } : r
    ));
    setManualPickIdx(null);
  };

  const reset = () => {
    setStatsUrl('');
    setScraped([]);
    setMatched([]);
    setError(null);
    setResults(null);
    setShowPreview(false);
    setManualPickIdx(null);
  };

  const getEffectiveRoster = (row) =>
    row.overrideId ? allPlayers.find(p => p.id === row.overrideId) : row.roster;

  const matchedCount = matched.filter(r => (r.roster || r.overrideId) && r.include).length;
  const unmatchedCount = matched.filter(r => !r.roster && !r.overrideId).length;

  return (
    <div className={embedded ? 'p-0' : 'min-h-screen p-4 max-w-2xl mx-auto'}>
      {!embedded && (
        <div className="pt-4 pb-2">
          <h1 className="text-2xl font-bold text-white">Import Batting Stats</h1>
          <p className="text-sm text-white/60 mt-1">Scrape batting stats from a school website and pair them with your roster players</p>
        </div>
      )}

      {/* Step 1: Team filter */}
      {!scraped.length && !results && (
        <Card className="mb-4">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> Which team are you importing stats for?
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-2">
            <p className="text-xs text-muted-foreground">Narrows the player pool for matching. Leave blank to search all teams.</p>
            <select
              value={selectedTeamId}
              onChange={e => setSelectedTeamId(e.target.value)}
              className="w-full h-9 px-2 rounded border border-input bg-background text-sm"
            >
              <option value="">(All teams — {allPlayers.length} players)</option>
              {teams.map(t => {
                const count = allPlayers.filter(p => p.team_id === t.id).length;
                return <option key={t.id} value={t.id}>{t.name} ({count} players)</option>;
              })}
            </select>
          </CardContent>
        </Card>
      )}

      {/* Step 2: URL input */}
      {!scraped.length && !results && (
        <Card className="mb-4">
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste the URL of the batting stats page from the opponent's athletics website.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://athletics.school.edu/sports/baseball/stats"
                value={statsUrl}
                onChange={e => setStatsUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFetch()}
                className="flex-1 text-xs"
              />
              <Button onClick={handleFetch} disabled={fetching || !statsUrl.trim() || playersLoading} className="shrink-0">
                {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Globe className="w-4 h-4 mr-1" />Fetch</>}
              </Button>
            </div>
            {fetching && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Fetching stats… {fetchElapsed > 0 && <span className="tabular-nums">{fetchElapsed}s</span>}
                </p>
                {fetchElapsed >= 10 && fetchElapsed < 30 && (
                  <p className="text-xs text-muted-foreground/70">Parsing page structure…</p>
                )}
                {fetchElapsed >= 30 && (
                  <p className="text-xs text-muted-foreground/70">JS-rendered site — using AI to extract stats…</p>
                )}
              </div>
            )}
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review matches */}
      {scraped.length > 0 && !results && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="font-medium">{scraped.length} players scraped</span>
              <Badge variant="secondary" className="text-primary">{matchedCount} matched</Badge>
              {unmatchedCount > 0 && <Badge variant="destructive">{unmatchedCount} unmatched</Badge>}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset}>
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Match review list */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">Player Matching — tap a row to toggle / assign</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 space-y-1.5 max-h-96 overflow-y-auto">
              {matched.map((row, i) => {
                const effective = getEffectiveRoster(row);
                return (
                  <div key={i} className="space-y-1">
                    <button
                      onClick={() => effective ? toggleRow(i) : setManualPickIdx(i === manualPickIdx ? null : i)}
                      className={`w-full text-left flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
                        !row.include ? 'opacity-40 bg-muted/20' :
                        effective ? 'bg-primary/10' : 'bg-destructive/10 border border-destructive/30'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-semibold">{row.scraped.name}</span>
                        {effective ? (
                          <span className="text-muted-foreground ml-2">
                            → <span className="text-primary font-medium">{effective.name}</span>
                            {effective.number && <span className="text-muted-foreground"> #{effective.number}</span>}
                            {row.overrideId && <span className="text-amber-500 ml-1">(manual)</span>}
                          </span>
                        ) : (
                          <span className="text-destructive ml-2 font-medium">⚠ No match — tap to assign</span>
                        )}
                      </div>
                      <div className="flex gap-2 text-muted-foreground shrink-0 ml-2">
                        {row.scraped.avg != null && <span>.{String(Math.round(row.scraped.avg * 1000)).padStart(3, '0')}</span>}
                        {row.scraped.hr  != null && <span>{row.scraped.hr}HR</span>}
                        {row.scraped.rbi != null && <span>{row.scraped.rbi}RBI</span>}
                      </div>
                    </button>

                    {/* Manual picker dropdown */}
                    {manualPickIdx === i && (
                      <div className="ml-3 rounded-lg border border-border bg-card shadow-md overflow-hidden max-h-48 overflow-y-auto">
                        <p className="px-3 py-2 text-xs text-muted-foreground border-b border-border">Assign to roster player:</p>
                        {rosterPool.length === 0 && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">No players in selected team</p>
                        )}
                        {rosterPool.map(p => (
                          <button
                            key={p.id}
                            onClick={() => assignOverride(i, p.id)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 flex items-center justify-between"
                          >
                            <span className="font-medium">{p.name}</span>
                            {p.number && <span className="text-muted-foreground">#{p.number}</span>}
                          </button>
                        ))}
                        <button
                          onClick={() => setManualPickIdx(null)}
                          className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 border-t border-border"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Stat preview toggle */}
          <button
            onClick={() => setShowPreview(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
          >
            {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showPreview ? 'Hide' : 'Show'} full stat preview (first 5)
          </button>

          {showPreview && (
            <div className="overflow-x-auto rounded-lg border border-border text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Player</th>
                    {Object.keys(STAT_LABELS).map(k => (
                      <th key={k} className="px-2 py-1.5 text-center font-medium text-muted-foreground">{STAT_LABELS[k]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scraped.slice(0, 5).map((p, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1.5 font-medium whitespace-nowrap">{p.name}</td>
                      {Object.keys(STAT_LABELS).map(k => (
                        <td key={k} className="px-2 py-1.5 text-center text-muted-foreground">
                          {p[k] != null ? (['avg','obp','slg','ops'].includes(k) ? p[k].toFixed(3) : p[k]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Button
            className="w-full h-12 text-base font-semibold"
            disabled={importing || matchedCount === 0}
            onClick={handleImport}
          >
            {importing
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Updating…</>
              : `Save Stats for ${matchedCount} Player${matchedCount !== 1 ? 's' : ''}`}
          </Button>
          {matchedCount === 0 && (
            <p className="text-xs text-center text-muted-foreground">No matched players — use the picker to manually assign unmatched rows</p>
          )}
        </div>
      )}

      {/* Results */}
      {results && (
        <Card className={results.failed === 0 ? 'border-primary/40' : 'border-amber-500/40'}>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              {results.failed === 0
                ? <CheckCircle2 className="w-5 h-5 text-primary" />
                : <AlertCircle className="w-5 h-5 text-amber-500" />}
              <span className="font-semibold">Import Complete</span>
            </div>
            <div className="flex gap-4 text-sm flex-wrap">
              <span className="text-primary font-medium">✓ {results.success} updated</span>
              {results.skipped > 0 && <span className="text-muted-foreground">— {results.skipped} skipped</span>}
              {results.failed > 0 && <span className="text-destructive font-medium">✗ {results.failed} failed</span>}
            </div>
            {results.errors.slice(0, 8).map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground font-mono">{e}</p>
            ))}
            <Button variant="outline" className="w-full mt-2" onClick={reset}>Import Another</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}