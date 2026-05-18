import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Parse a number from a string, returning null if invalid
function parseNum(val) {
  if (val === null || val === undefined || val === '' || val === '-') return null;
  const n = parseFloat(String(val).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

// Strip HTML tags from a string
function stripTags(s) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Clean a player name: remove embedded numbers, \r\n, and duplicated name text
function cleanName(raw) {
  // Remove \r\n and collapse whitespace
  let s = raw.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  // If the name appears duplicated (e.g. "DOE, JOHN  18 DOE, JOHN"), take the first occurrence
  // Pattern: text, optional number, then same-ish text again
  const dupMatch = s.match(/^(.+?)\s+\d+\s+\1\s*$/i);
  if (dupMatch) return dupMatch[1].trim();
  // Also strip trailing jersey numbers: "DOE, JOHN 18" → "DOE, JOHN"
  // Only strip if the suffix is purely digits preceded by whitespace
  return s.replace(/\s+\d+\s*$/, '').trim();
}

// Extract all table rows from HTML as arrays of cell text
function extractTables(html) {
  const tables = [];
  const tableMatches = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)];
  for (const tm of tableMatches) {
    const tableHtml = tm[0];
    const rows = [];
    const rowMatches = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
    for (const rm of rowMatches) {
      const cells = [...rm[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(c => stripTags(c[1]).toUpperCase());
      if (cells.length > 2) rows.push(cells);
    }
    if (rows.length > 1) tables.push(rows);
  }
  return tables;
}

// Identify which column index maps to each stat key
const STAT_ALIASES = {
  name:   ['name', 'player', 'batter', 'athlete'],
  avg:    ['avg', 'ba', 'batting avg', 'batting average'],
  obp:    ['obp', 'on-base%', 'on base pct', 'ob%'],
  slg:    ['slg', 'slg%', 'slug', 'slugging'],
  ops:    ['ops'],
  ab:     ['ab', 'at bats', 'atbats', 'at-bats'],
  r:      ['r', 'runs', 'r/g'],
  h:      ['h', 'hits'],
  '2b':   ['2b', 'doubles', 'dbl'],
  '3b':   ['3b', 'triples', 'tri'],
  hr:     ['hr', 'home runs', 'homeruns'],
  rbi:    ['rbi', 'rbis'],
  bb:     ['bb', 'walks', 'walk'],
  so:     ['so', 'k', 'ks', 'strikeouts', 'strikeout'],
  sb:     ['sb', 'stolen bases', 'steals'],
  gp:     ['gp', 'games played', 'games', 'g'],
  number: ['no', '#', 'num', 'jersey', 'number'],
};

function buildColumnMap(headerRow) {
  const map = {};
  headerRow.forEach((cell, idx) => {
    const normalized = cell.toLowerCase().trim();
    for (const [key, aliases] of Object.entries(STAT_ALIASES)) {
      // Exact match first, then "starts with" alias — avoids 'g' matching 'avg'
      if (aliases.some(a => normalized === a)) {
        if (!(key in map)) map[key] = idx;
        return;
      }
    }
    // Second pass: longer-alias substring matches only (min 3 chars to avoid false positives)
    for (const [key, aliases] of Object.entries(STAT_ALIASES)) {
      if (!(key in map) && aliases.some(a => a.length >= 3 && normalized.includes(a))) {
        map[key] = idx;
      }
    }
  });
  return map;
}

function parseTables(html) {
  const tables = extractTables(html);
  const results = [];

  for (const rows of tables) {
    if (rows.length < 3) continue;
    // Try each row as potential header
    for (let hi = 0; hi < Math.min(3, rows.length); hi++) {
      const colMap = buildColumnMap(rows[hi]);
      if (!('name' in colMap) && !('avg' in colMap)) continue;
      if (!('name' in colMap)) continue; // need at least a name column

      for (let ri = hi + 1; ri < rows.length; ri++) {
        const row = rows[ri];
        const rawName = row[colMap.name] || '';
        const name = cleanName(rawName);
        if (!name || name.length < 2 || name === 'TOTALS' || name === 'TEAM' || name === 'NAME') continue;

        const player = { name: name.toUpperCase() };
        if ('number' in colMap) player.number = row[colMap.number] || '';
        if ('avg' in colMap)  player.avg  = parseNum(row[colMap.avg]);
        if ('obp' in colMap)  player.obp  = parseNum(row[colMap.obp]);
        if ('slg' in colMap)  player.slg  = parseNum(row[colMap.slg]);
        if ('ops' in colMap)  player.ops  = parseNum(row[colMap.ops]);
        if ('ab' in colMap)   player.ab   = parseNum(row[colMap.ab]);
        if ('r' in colMap)    player.r    = parseNum(row[colMap.r]);
        if ('h' in colMap)    player.h    = parseNum(row[colMap.h]);
        if ('2b' in colMap)   player['2b'] = parseNum(row[colMap['2b']]);
        if ('3b' in colMap)   player['3b'] = parseNum(row[colMap['3b']]);
        if ('hr' in colMap)   player.hr   = parseNum(row[colMap.hr]);
        if ('rbi' in colMap)  player.rbi  = parseNum(row[colMap.rbi]);
        if ('bb' in colMap)   player.bb   = parseNum(row[colMap.bb]);
        if ('so' in colMap)   player.so   = parseNum(row[colMap.so]);
        if ('sb' in colMap)   player.sb   = parseNum(row[colMap.sb]);
        if ('gp' in colMap)   player.gp   = parseNum(row[colMap.gp]);
        results.push(player);
      }
      break; // found a valid header row in this table
    }
  }

  return results;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { stats_url } = await req.json();
  if (!stats_url) return Response.json({ error: 'stats_url required' }, { status: 400 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  let resp;
  try {
    resp = await fetch(stats_url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (fetchErr) {
    clearTimeout(timeout);
    const msg = fetchErr.name === 'AbortError'
      ? 'Request timed out — the site took too long to respond'
      : `Could not reach site: ${fetchErr.message}`;
    return Response.json({ error: msg }, { status: 504 });
  }
  clearTimeout(timeout);

  if (!resp.ok) {
    return Response.json({ error: `Site returned ${resp.status}` }, { status: 502 });
  }

  let html;
  try {
    html = await resp.text();
  } catch (textErr) {
    return Response.json({ error: `Failed to read response: ${textErr.message}` }, { status: 502 });
  }
  const players = parseTables(html);

  if (players.length > 0) {
    return Response.json({ players, count: players.length });
  }

  return Response.json({ error: 'Could not find a stats table on this page', snippet: html.slice(0, 3000) }, { status: 422 });
});