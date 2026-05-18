import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { TeamAPI, TeamPlayerAPI, TeamPitcherAPI } from '@/lib/teamApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Upload, CheckCircle2, AlertCircle, FileText, Trash2, ChevronDown, ChevronUp, Globe, Loader2, Users } from 'lucide-react';

const TEAM_FIELDS = ['name', 'location', 'notes'];
// team_name is a convenience field — we resolve it to team_id at import time
const PLAYER_FIELDS = ['name', 'number', 'position', 'bats', 'throws', 'team_name', 'team_id', 'notes'];

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = [];
    let cur = '', inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    values.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] || '').replace(/^"|"$/g, ''); });
    return obj;
  });
}

function parseJSON(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  // Try common wrapper keys
  for (const key of ['players', 'teams', 'roster', 'data', 'items', 'records']) {
    if (Array.isArray(data[key])) return data[key];
  }
  // Single object that looks like a roster row (has a name/title field)
  if (typeof data === 'object' && !Array.isArray(data)) {
    // Check if it looks like an API spec or non-roster object — if values are objects/arrays, skip
    const values = Object.values(data);
    const isFlat = values.every(v => v === null || typeof v !== 'object');
    if (isFlat) return [data];
  }
  return [];
}

function autoMap(cols, fields) {
  const auto = {};
  fields.forEach(field => {
    // exact match first
    const exact = cols.find(c => c.toLowerCase() === field.toLowerCase());
    if (exact) { auto[field] = exact; return; }
    // fuzzy: strip underscores/spaces
    const fuzzy = cols.find(c =>
      c.toLowerCase().replace(/[^a-z0-9]/g, '') === field.replace(/[^a-z0-9]/g, '')
    );
    if (fuzzy) auto[field] = fuzzy;
  });
  return auto;
}

export default function ImportRosters({ embedded = false, preselectedTeamId = '', preselectedTeamName = '' }) {
  const [importMode, setImportMode] = useState('file'); // 'file' | 'web'
  const [mode, setMode] = useState('players'); // 'teams' | 'players'
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [columnMap, setColumnMap] = useState({});
  const [detectedColumns, setDetectedColumns] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  // Web fetch state
  const [rosterUrl, setRosterUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchElapsed, setFetchElapsed] = useState(0);
  const fetchTimerRef = useRef(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(preselectedTeamId);
  const [newTeamName, setNewTeamName] = useState('');
  const [teamMode, setTeamMode] = useState(preselectedTeamId ? 'existing' : 'existing'); // 'existing' | 'new'

  const handleWebFetch = async () => {
    if (!rosterUrl.trim()) return;
    setFetching(true);
    setFetchElapsed(0);
    setError(null);
    setResults(null);
    setRows([]);
    fetchTimerRef.current = setInterval(() => setFetchElapsed(s => s + 1), 1000);

    // Always lowercase — the global CSS text-transform:uppercase rule causes the browser
    // to store the uppercased string in input state, breaking URL validation and fetching.
    const normalizedUrl = rosterUrl.trim().toLowerCase();

    // Validate URL — accept anything starting with http:// or https://
    if (!/^https?:\/\/.+\..+/.test(normalizedUrl)) {
      setError('Please enter a valid URL starting with https:// (e.g. https://athletics.school.edu/sports/baseball/roster)');
      clearInterval(fetchTimerRef.current);
      setFetching(false);
      return;
    }

    try {
      // base44.functions.invoke has a permanent platform-level middleware bug (500 Python error)
      // for this app. Call the function endpoint directly via raw fetch to bypass it entirely.
      const token = localStorage.getItem('base44_access_token') || appParams.token || '';
      const appId = appParams.appId || '';
      const fnUrl = `${window.location.origin}/api/apps/${appId}/functions/fetchNcaaRoster`;

      const directRes = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ roster_url: normalizedUrl }),
      });

      // Load teams separately so it doesn't block or fail the roster fetch
      TeamAPI.list().then(t => setTeams(t || [])).catch(() => {});

      const data = await directRes.json();

      if (data?.error) {
        setError(data.error);
        return;
      }

      const players = data?.players || [];
      if (!players.length) {
        setError('Could not parse roster from that URL. Try a different URL or use CSV import.');
        return;
      }

      setRows(players);
      let hostname = normalizedUrl;
      try { hostname = new URL(normalizedUrl).hostname; } catch {}
      setFileName(`${players.length} players from ${hostname}`);
    } catch (err) {
      console.error('[ImportRosters] handleWebFetch error:', err);
      setError('Could not fetch roster. Check the URL and try again.');
    } finally {
      clearInterval(fetchTimerRef.current);
      setFetching(false);
    }
  };

  // Detect if a position string indicates a pitcher (primary or secondary)
  const isPitcherPosition = (pos) => {
    if (!pos) return false;
    const p = pos.toUpperCase().trim();
    // Match: standalone P, RHP, LHP, SP, RP, PITCHER, or P as part of multi-position (P/OF, P/1B, etc.)
    return /(?:^|[/\s,])P(?:[/\s,]|$)|RHP|LHP|\bSP\b|\bRP\b|PITCHER/.test(p);
  };

  // Detect if a position string indicates a field player (has non-pitcher positions)
  const isFieldPlayerPosition = (pos) => {
    if (!pos) return true; // unknown = treat as field player
    const p = pos.toUpperCase().trim();
    // Has any field position component
    return /\b(C|1B|2B|3B|SS|LF|CF|RF|OF|IF|DH|UT|INF|OUT|CATCHER|INFIELD|OUTFIELD|UTILITY)\b/.test(p);
  };

  // Two-way player: has BOTH pitcher and field player indicators
  const isTwoWayPlayer = (pos) => isPitcherPosition(pos) && isFieldPlayerPosition(pos);

  // Normalize name for dedup comparison
  const normName = (n) => (n || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  const handleWebImport = async () => {
    setImporting(true);
    setResults(null);
    setError(null);

    try {
      const token = localStorage.getItem('base44_access_token') || appParams.token || '';
      const appId = appParams.appId || '';
      const fnUrl = `${window.location.origin}/api/apps/${appId}/functions/saveRosterToDb`;

      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          team_id: teamMode === 'existing' ? selectedTeamId || null : null,
          team_name: teamMode === 'new' ? newTeamName.trim() : null,
          players: rows,
        }),
      });

      const data = await res.json();
      if (data?.error) throw new Error(data.error);

      setResults({
        successPlayers: data.successPlayers || 0,
        successPitchers: data.successPitchers || 0,
        skipped: data.skipped || 0,
        failed: data.failed || 0,
        errors: data.errors || [],
      });
    } catch (err) {
      console.error('[ImportRosters] handleWebImport error:', err);
      setError(err?.message || 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const targetFields = mode === 'teams' ? TEAM_FIELDS : PLAYER_FIELDS;

  const handleFile = (file) => {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    setResults(null);
    setRows([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        let parsed = [];
        if (file.name.toLowerCase().endsWith('.json')) {
          parsed = parseJSON(text);
        } else {
          parsed = parseCSV(text);
        }
        if (!parsed.length) {
          setError('No roster data found in this file. Make sure it\'s a flat array of player/team objects (not an API spec or nested data structure).');
          return;
        }
        setRows(parsed);
        const cols = Object.keys(parsed[0]);
        setDetectedColumns(cols);
        setColumnMap(autoMap(cols, targetFields));
      } catch (err) {
        setError(`Parse error: ${err.message}`);
      }
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    setImporting(true);
    setResults(null);
    setError(null);

    try {
      // If importing players and team_name is mapped, pre-fetch all teams for name→id resolution
      let teamsByName = {};
      if (mode === 'players' && columnMap['team_name']) {
        const allTeams = await TeamAPI.list();
        allTeams.forEach(t => { teamsByName[t.name.toLowerCase()] = t.id; });
      }

      // Pre-build set of existing names per team for dedup
      const existingPlayersByTeam = {};
      const existingPitchersByTeam = {};
      const getExistingPlayerSet = async (teamId) => {
        if (!teamId) return null;
        if (!existingPlayersByTeam[teamId]) {
          const existing = await TeamPlayerAPI.filter(teamId);
          existingPlayersByTeam[teamId] = new Set(existing.map(p => normName(p.name)));
        }
        return existingPlayersByTeam[teamId];
      };
      const getExistingPitcherSet = async (teamId) => {
        if (!teamId) return null;
        if (!existingPitchersByTeam[teamId]) {
          const existing = await TeamPitcherAPI.filter(teamId);
          existingPitchersByTeam[teamId] = new Set(existing.map(p => normName(p.name)));
        }
        return existingPitchersByTeam[teamId];
      };

      // Build records
      const toCreatePlayers = [];
      const toCreatePitchers = [];
      let skipped = 0;
      const errors = [];

      for (const row of rows) {
        if (mode === 'teams') {
          const record = {};
          targetFields.forEach(field => {
            const col = columnMap[field];
            if (col && row[col] !== undefined && row[col] !== '') record[field] = row[col];
          });
          if (record.name) record.name = record.name.toUpperCase();
          if (!record.name) { errors.push('Skipped row with no name'); continue; }
          toCreatePlayers.push(record);
          continue;
        }

        // Players mode — detect pitcher vs hitter
        const record = {};
        targetFields.forEach(field => {
          if (field === 'team_name') return;
          const col = columnMap[field];
          if (col && row[col] !== undefined && row[col] !== '') record[field] = row[col];
        });

        if (columnMap['team_name']) {
          const rawTeam = row[columnMap['team_name']] || '';
          const resolvedId = teamsByName[rawTeam.toLowerCase()];
          if (resolvedId && !record.team_id) record.team_id = resolvedId;
        }
        if (!record.team_id && preselectedTeamId) record.team_id = preselectedTeamId;
        if (record.name) record.name = record.name.toUpperCase();
        if (!record.name) { errors.push('Skipped row with no name'); continue; }

        const key = normName(record.name);
        const pos = record.position || '';
        const pitcher = isPitcherPosition(pos);
        const fieldPlayer = isFieldPlayerPosition(pos);

        if (pitcher) {
          const pitcherSet = await getExistingPitcherSet(record.team_id);
          if (!pitcherSet || !pitcherSet.has(key)) {
            toCreatePitchers.push(record);
            if (pitcherSet) pitcherSet.add(key);
          } else { skipped++; }
        }

        if (fieldPlayer || !pitcher) {
          const playerSet = await getExistingPlayerSet(record.team_id);
          if (!playerSet || !playerSet.has(key)) {
            toCreatePlayers.push(record);
            if (playerSet) playerSet.add(key);
          } else { skipped++; }
        }
      }

      // Parallel batch create
      let success = 0, successPitchers = 0, failed = 0;
      if (mode === 'teams') {
        const settled = await Promise.allSettled(toCreatePlayers.map(r => TeamAPI.create(r)));
        settled.forEach((r, i) => {
          if (r.status === 'fulfilled') success++;
          else { failed++; errors.push(`${toCreatePlayers[i].name}: ${r.reason?.message || 'failed'}`); }
        });
        setResults({ success, skipped, failed, errors });
      } else {
        const [playerSettled, pitcherSettled] = await Promise.all([
          Promise.allSettled(toCreatePlayers.map(r => TeamPlayerAPI.create(r))),
          Promise.allSettled(toCreatePitchers.map(r => TeamPitcherAPI.create(r))),
        ]);
        playerSettled.forEach((r, i) => {
          if (r.status === 'fulfilled') success++;
          else { failed++; errors.push(`${toCreatePlayers[i].name}: ${r.reason?.message || 'failed'}`); }
        });
        pitcherSettled.forEach((r, i) => {
          if (r.status === 'fulfilled') successPitchers++;
          else { failed++; errors.push(`${toCreatePitchers[i].name}: ${r.reason?.message || 'failed'}`); }
        });
        setResults({ successPlayers: success, successPitchers, skipped, failed, errors });
      }
    } catch (err) {
      console.error('[ImportRosters] handleImport error:', err);
      setError(err?.message || 'Import failed unexpectedly. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setRows([]);
    setFileName('');
    setColumnMap({});
    setDetectedColumns([]);
    setResults(null);
    setShowPreview(false);
    setError(null);
    setSelectedTeamId(preselectedTeamId || '');
    setNewTeamName('');
    setTeamMode('existing');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className={embedded ? "p-0" : "min-h-screen p-4 max-w-2xl mx-auto"}>
      {!embedded && (
        <div className="pt-4 pb-2">
          <h1 className="text-2xl font-bold text-white">Import Rosters</h1>
          <p className="text-sm text-white/60 mt-1">Upload a CSV or JSON file to bulk-import teams or players</p>
        </div>
      )}
      {embedded && preselectedTeamName && (
        <div className="mb-3 flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-xs">
          <Users className="w-3.5 h-3.5 text-primary" />
          <span>Importing into: <span className="font-semibold text-primary">{preselectedTeamName.toUpperCase()}</span></span>
        </div>
      )}

      {/* Source toggle */}
      <div className="flex gap-2 mb-4">
        <Button variant={importMode === 'file' ? 'default' : 'outline'} size="sm" className="flex-1 gap-1.5" onClick={() => { setImportMode('file'); reset(); }}>
          <Upload className="w-3.5 h-3.5" /> CSV / File
        </Button>
        <Button variant={importMode === 'web' ? 'default' : 'outline'} size="sm" className="flex-1 gap-1.5" onClick={() => { setImportMode('web'); reset(); }}>
          <Globe className="w-3.5 h-3.5" /> Fetch from Website
        </Button>
      </div>

      {/* Web fetch panel */}
      {importMode === 'web' && !rows.length && (
        <Card className="mb-4">
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste your opponent's baseball roster URL (e.g. <span className="font-mono text-xs">athletics.thomas.edu/sports/baseball/roster</span>). Works with most college athletics sites.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://athletics.school.edu/sports/baseball/roster"
                value={rosterUrl}
                onChange={e => setRosterUrl(e.target.value.toLowerCase())}
                onKeyDown={e => e.key === 'Enter' && handleWebFetch()}
                className="flex-1 text-xs"
                style={{ textTransform: 'none' }}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <Button onClick={handleWebFetch} disabled={fetching || !rosterUrl.trim()} className="shrink-0">
                {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
              </Button>
            </div>
            {fetching && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Fetching roster… {fetchElapsed > 0 && <span className="tabular-nums">{fetchElapsed}s</span>}
                </p>
                {fetchElapsed >= 10 && fetchElapsed < 30 && (
                  <p className="text-xs text-muted-foreground/70">Parsing page structure…</p>
                )}
                {fetchElapsed >= 30 && fetchElapsed < 55 && (
                  <p className="text-xs text-muted-foreground/70">This site uses JavaScript rendering — using AI to extract roster…</p>
                )}
                {fetchElapsed >= 55 && (
                  <p className="text-xs text-amber-500/80">Almost done — finalizing player list…</p>
                )}
              </div>
            )}
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mode toggle (players/teams) — only for file mode */}
      {importMode === 'file' && (
        <div className="flex gap-2 mb-4">
          <Button variant={mode === 'players' ? 'default' : 'outline'} className="flex-1" onClick={() => { setMode('players'); reset(); }}>
            Import Players
          </Button>
          <Button variant={mode === 'teams' ? 'default' : 'outline'} className="flex-1" onClick={() => { setMode('teams'); reset(); }}>
            Import Teams
          </Button>
        </div>
      )}

      {/* Format guide — file mode only */}
      {importMode === 'file' && <Card className="mb-4 bg-muted/30 border-border/50">
        <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground text-sm">Fields for {mode === 'teams' ? 'Teams' : 'Players'}:</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {targetFields.map(f => (
              <Badge key={f} variant="secondary" className="font-mono text-[11px]">{f}</Badge>
            ))}
          </div>
          {mode === 'players' && (
            <p className="mt-2">Use <span className="font-mono">team_name</span> to group by team — it will be matched to existing teams automatically.</p>
          )}
        </CardContent>
      </Card>}

      {/* Drop zone / file picker */}
      {importMode === 'file' && !rows.length && !error && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-border rounded-xl p-10 text-center"
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium text-foreground mb-3">Drop a CSV or JSON file here</p>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Browse File
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,application/json,text/csv"
            className="hidden"
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
          />
        </div>
      )}

      {/* Error state (file mode only) */}
      {importMode === 'file' && error && !rows.length && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">File Error</span>
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={reset}>Try Again</Button>
          </CardContent>
        </Card>
      )}

      {/* Web fetch: team assignment step */}
      {/* Web mode import error (shown after fetch succeeds but import fails) */}
      {importMode === 'web' && error && rows.length > 0 && !results && (
        <div className="mb-3 flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {importMode === 'web' && rows.length > 0 && !results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <Badge variant="secondary">{rows.length} total</Badge>
              {rows.filter(p => isPitcherPosition(p.position)).length > 0 && (
                <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">
                  ⚾ {rows.filter(p => isPitcherPosition(p.position)).length} pitchers
                </Badge>
              )}
              {rows.filter(p => isTwoWayPlayer(p.position)).length > 0 && (
                <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30">
                  🔄 {rows.filter(p => isTwoWayPlayer(p.position)).length} two-way
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset}>
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Team assignment */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">Assign All Players to a Team</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-3">
              <div className="flex gap-2">
                <Button size="sm" variant={teamMode === 'existing' ? 'default' : 'outline'} onClick={() => setTeamMode('existing')} className="flex-1">
                  Existing Team
                </Button>
                <Button size="sm" variant={teamMode === 'new' ? 'default' : 'outline'} onClick={() => setTeamMode('new')} className="flex-1">
                  Create New Team
                </Button>
              </div>

              {teamMode === 'existing' ? (
                <select
                  value={selectedTeamId}
                  onChange={e => setSelectedTeamId(e.target.value)}
                  className="w-full h-9 px-2 rounded border border-input bg-background text-sm"
                >
                  <option value="">(No team — import without team)</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder="New team name (e.g. Thomas College)"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                />
              )}
            </CardContent>
          </Card>

          {/* Preview toggle */}
          <button
            onClick={() => setShowPreview(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
          >
            {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showPreview ? 'Hide' : 'Show'} all {rows.length} players
          </button>

          {showPreview && (
            <div className="overflow-x-auto rounded-lg border border-border text-xs max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted">
                  <tr className="bg-muted/40">
                    {['#', 'Name', 'Position', 'Bats', 'Throws', 'Type'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, i) => {
                    const pitcher = isPitcherPosition(p.position);
                    const twoWay = isTwoWayPlayer(p.position);
                    return (
                      <tr key={i} className={`border-t border-border ${twoWay ? 'bg-purple-500/5' : pitcher ? 'bg-blue-500/5' : ''}`}>
                        <td className="px-3 py-1.5">{p.number}</td>
                        <td className="px-3 py-1.5 font-medium">{p.name}</td>
                        <td className="px-3 py-1.5">{p.position}</td>
                        <td className="px-3 py-1.5">{p.bats}</td>
                        <td className="px-3 py-1.5">{p.throws}</td>
                        <td className="px-3 py-1.5">
                          <span className={`font-semibold ${twoWay ? 'text-purple-600' : pitcher ? 'text-blue-600' : 'text-muted-foreground'}`}>
                            {twoWay ? '🔄 Two-Way' : pitcher ? '⚾ Pitcher' : 'Player'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Button
            className="w-full h-12 text-base font-semibold"
            disabled={importing || (teamMode === 'new' && !newTeamName.trim())}
            onClick={handleWebImport}
          >
            {importing ? 'Importing…' : `Import ${rows.length} Players`}
          </Button>
        </div>
      )}

      {/* File loaded — mapping + preview (file mode only) */}
      {importMode === 'file' && rows.length > 0 && !results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <Badge variant="secondary">{rows.length} rows</Badge>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset}>
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Column mapping */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">Map Columns</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              {targetFields.map(field => (
                <div key={field} className="flex items-center gap-3">
                  <span className="font-mono text-xs w-28 text-muted-foreground shrink-0">{field}</span>
                  <select
                    value={columnMap[field] || ''}
                    onChange={e => setColumnMap(prev => ({ ...prev, [field]: e.target.value }))}
                    className="flex-1 h-8 px-2 rounded border border-input bg-background text-xs"
                  >
                    <option value="">(skip)</option>
                    {detectedColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Preview toggle */}
          <button
            onClick={() => setShowPreview(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
          >
            {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showPreview ? 'Hide' : 'Show'} preview (first 5 rows)
          </button>

          {showPreview && (
            <div className="overflow-x-auto rounded-lg border border-border text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40">
                    {detectedColumns.map(col => (
                      <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {detectedColumns.map(col => (
                        <td key={col} className="px-3 py-1.5 whitespace-nowrap">
                          {row[col] === null || row[col] === undefined ? '' : typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
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
            disabled={importing || !columnMap.name}
            onClick={handleImport}
          >
            {importing ? 'Importing…' : `Import ${rows.length} ${mode === 'teams' ? 'Teams' : 'Players'}`}
          </Button>
          {!columnMap.name && (
            <p className="text-xs text-center text-muted-foreground">Map the "name" field to enable import</p>
          )}
        </div>
      )}

      {/* Results */}
      {results && (
        <Card className={results.failed === 0 ? 'border-green-500/40' : 'border-amber-500/40'}>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              {results.failed === 0
                ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                : <AlertCircle className="w-5 h-5 text-amber-500" />}
              <span className="font-semibold">Import Complete</span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              {results.success != null && results.success > 0 && <span className="text-green-600 font-medium">✓ {results.success} imported</span>}
              {results.successPlayers != null && results.successPlayers > 0 && <span className="text-green-600 font-medium">✓ {results.successPlayers} players</span>}
              {results.successPitchers != null && results.successPitchers > 0 && <span className="text-blue-600 font-medium">⚾ {results.successPitchers} pitchers</span>}
              {results.skipped > 0 && <span className="text-muted-foreground font-medium">⟳ {results.skipped} already existed (skipped)</span>}
              {results.failed > 0 && <span className="text-destructive font-medium">✗ {results.failed} failed</span>}
              {(results.successPlayers === 0 && results.successPitchers === 0 && results.success === 0 && results.skipped > 0) && (
                <p className="text-xs text-muted-foreground w-full">All players already in roster — no duplicates created.</p>
              )}
            </div>
            {results.errors.slice(0, 8).map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground font-mono">{e}</p>
            ))}
            <Button variant="outline" className="w-full mt-2" onClick={reset}>
              Import Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}