import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseSidearmRoster(html) {
  const players = [];

  // Strategy 1: Table <tbody> rows with scope="row"
  const trBlocks = html.split(/<tr[\s>]/i);
  for (const block of trBlocks) {
    if (!block.includes('/bios/') && !block.includes('aria-label=')) continue;
    if (!block.includes('scope="row"') && !block.includes("scope='row'")) continue;

    const jerseyMatch = block.match(/class="number"[^>]*>[\s\S]*?(\d{1,3})[\s\S]*?<\/td>/i);
    const jersey = jerseyMatch ? jerseyMatch[1].trim() : '';

    let name = '';
    const ariaMatch = block.match(/aria-label="([^:]+):/i);
    if (ariaMatch) {
      name = ariaMatch[1].trim();
    } else {
      const thMatch = block.match(/scope="row"[^>]*class="name"[^>]*>([\s\S]*?)<\/th>/i)
        || block.match(/class="name"[^>]*scope="row"[^>]*>([\s\S]*?)<\/th>/i);
      if (thMatch) name = stripTags(thMatch[1]);
    }
    name = name.replace(/\s+/g, ' ').trim();
    if (!name || name.length < 2) continue;

    const plainTds = [];
    const tdRe = /<td(?!\s[^>]*class="number")[^>]*>([\s\S]*?)<\/td>/gi;
    let m;
    while ((m = tdRe.exec(block)) !== null) {
      const text = stripTags(m[1]).replace(/^[A-Za-z \.\/]+:\s*/,'').trim();
      if (text) plainTds.push(text);
    }

    const posCell = plainTds[0] || '';
    const btCell  = plainTds[1] || '';
    const btMatch = btCell.match(/([LRS])\/([LR])/);

    players.push({
      name: name.toUpperCase(),
      number: jersey,
      position: posCell.toUpperCase(),
      bats: btMatch?.[1] || '',
      throws: btMatch?.[2] || '',
    });
  }

  if (players.length > 0) return players;

  // Strategy 2: List items (<li>)
  const liBlocks = html.split(/<li\b[^>]*>/i);
  for (const block of liBlocks) {
    if (!block.includes('/roster/') && !block.includes('roster-player')) continue;
    if (block.includes('coaching') || block.includes('Coaching')) continue;

    const nameMatch = block.match(/<h[23][^>]*>\s*<a[^>]*>([^<]+)<\/a>/i)
      || block.match(/alt="([^"]+)"[^>]*class="[^"]*headshot/i);
    const name = (nameMatch?.[1] || '').replace(/\s+/g, ' ').trim();
    if (!name || name.length < 2 || name.toLowerCase().includes('view full')) continue;

    const jerseyMatch = block.match(/class="[^"]*jersey[^"]*"[^>]*>\s*(\d{1,3})|>\s*(\d{1,3})\s*<\/(?:td|span|div|strong)>/i);
    const jersey = (jerseyMatch?.[1] || jerseyMatch?.[2] || '').trim();

    const posMatch = block.match(/<abbr[^>]*title="([^"]+)"[^>]*>([^<]+)<\/abbr>/i)
      || block.match(/class="[^"]*position[^"]*"[^>]*>\s*([^<\s][^<]*?)\s*<\//i);
    const pos = (posMatch?.[2] || posMatch?.[1] || '').trim().toUpperCase();

    const btMatch = block.match(/([LRS])\/([LR])/);
    players.push({
      name: name.toUpperCase(),
      number: jersey,
      position: pos,
      bats: btMatch?.[1] || '',
      throws: btMatch?.[2] || '',
    });
  }

  // Strategy 2b: PrestoSports / WordPress card-based roster
  // Pattern: roster card with number, name heading, position span
  if (players.length === 0) {
    // Look for player cards — each has a jersey number + h3 name + position class
    const cardBlocks = html.split(/class="[^"]*(?:roster-player|player-card|s-person-card|roster-card)[^"]*"/i);
    if (cardBlocks.length > 2) {
      for (const block of cardBlocks.slice(1)) {
        const nameMatch = block.match(/<h[23][^>]*>([^<]+)<\/h[23]>/i)
          || block.match(/<a[^>]*class="[^"]*player-name[^"]*"[^>]*>([^<]+)<\/a>/i)
          || block.match(/class="[^"]*(?:s-person-details__name|athlete-name|full-name)[^"]*"[^>]*>([^<]+)<\//i);
        if (!nameMatch) continue;
        const name = nameMatch[1].replace(/\s+/g, ' ').trim();
        if (!name || name.length < 2) continue;

        const numMatch = block.match(/class="[^"]*(?:jersey|number|s-person-details__number)[^"]*"[^>]*>(?:<[^>]+>)*\s*(\d{1,3})/i)
          || block.match(/>(\d{1,3})<\/(?:span|div|td)/i);
        const posMatch = block.match(/class="[^"]*(?:position|pos|s-person-details__position)[^"]*"[^>]*>(?:<[^>]+>)*\s*([^<]{1,20})<\//i);
        const btMatch = block.match(/([LRS])\/([LR])/);

        players.push({
          name: name.toUpperCase(),
          number: (numMatch?.[1] || '').trim(),
          position: stripTags(posMatch?.[1] || '').toUpperCase().trim(),
          bats: btMatch?.[1] || '',
          throws: btMatch?.[2] || '',
        });
      }
    }
  }

  // Strategy 2c: Number + Name in sequential heading structure (PrestoSports list view)
  // Matches patterns like: <td>1</td> ... <th ...>Joshua Ferando</th> ... <td>IF</td>
  if (players.length === 0) {
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRe.exec(html)) !== null) {
      const row = rowMatch[1];
      const cells = [];
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cm;
      while ((cm = cellRe.exec(row)) !== null) {
        cells.push(stripTags(cm[1]).trim());
      }
      if (cells.length < 2) continue;
      // Must have a numeric cell and a name-like cell
      const numCell = cells.find(c => /^\d{1,3}$/.test(c));
      const nameCell = cells.find(c => /^[A-Za-z][a-z]+\s+[A-Za-z]/.test(c) && c.length > 4 && c.length < 60);
      if (!numCell || !nameCell) continue;
      const posCell = cells.find(c => c !== nameCell && /^(RHP|LHP|INF|OF|C|P|DH|UTL|1B|2B|3B|SS|CF|LF|RF|SP|RP|MIF|CIF|UTIL|IF|RF|LF|HP)/i.test(c));
      const btCell = cells.find(c => /^[LRS]\/[LR]$/.test(c));
      const btMatch = btCell ? btCell.match(/([LRS])\/([LR])/) : null;
      players.push({
        name: nameCell.toUpperCase(),
        number: numCell,
        position: (posCell || '').toUpperCase(),
        bats: btMatch?.[1] || '',
        throws: btMatch?.[2] || '',
      });
    }
    // Deduplicate
    if (players.length > 0) {
      const seen = new Set();
      const deduped = [];
      for (const p of players) {
        if (!seen.has(p.name)) { seen.add(p.name); deduped.push(p); }
      }
      players.length = 0;
      players.push(...deduped);
    }
  }

  // Strategy 3: Generic table rows
  if (players.length === 0) {
    const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi) || [];
    for (const table of tableMatch) {
      const rows = table.split(/<tr[\s>]/i).slice(1);
      const tablePlayers = [];
      for (const row of rows) {
        const cells = [];
        const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let cm;
        while ((cm = cellRe.exec(row)) !== null) {
          cells.push(stripTags(cm[1]).trim());
        }
        if (cells.length < 2) continue;
        const nameCell = cells.find(c => /^[A-Za-z]+ [A-Za-z]+/.test(c) && c.length > 4 && c.length < 60);
        if (!nameCell) continue;
        const numCell = cells.find(c => /^\d{1,3}$/.test(c.trim()));
        const posCell = cells.find(c => /^(RHP|LHP|INF|OF|C|P|DH|UTL|1B|2B|3B|SS|CF|LF|RF|SP|RP|MIF|CIF|UTIL|CATCHER|PITCHER|INFIELD|OUTFIELD)/i.test(c.trim()));
        const btCell = cells.find(c => /^[LRS]\/[LR]$/.test(c.trim()));
        const btMatch = btCell ? btCell.match(/([LRS])\/([LR])/) : null;
        tablePlayers.push({
          name: nameCell.toUpperCase(),
          number: numCell || '',
          position: (posCell || '').toUpperCase(),
          bats: btMatch?.[1] || '',
          throws: btMatch?.[2] || '',
        });
      }
      if (tablePlayers.length >= 5) {
        players.push(...tablePlayers);
        break;
      }
    }
  }

  return players;
}

// Extract a compact plain-text version of the roster section from the HTML
function extractRosterText(html) {
  let section = html;

  // Remove noise
  section = section
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '');

  // Try to isolate the roster-specific section
  const rosterMatch = section.match(/(<(?:table|section|div|main)[^>]*(?:roster|player|athlete)[^>]*>[\s\S]{200,})/i);
  if (rosterMatch) section = rosterMatch[1];

  const text = stripTags(section).replace(/\s{2,}/g, ' ').trim();
  // 15000 chars — enough for a full roster
  return text.slice(0, 15000);
}

Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { roster_url } = body;
  if (!roster_url) return Response.json({ error: 'roster_url required' }, { status: 400 });

  console.log(`[fetchNcaaRoster] Fetching: ${roster_url}`);

  const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
  };

  // Try base URL and ?view=list variant
  const urlsToTry = [roster_url];
  if (!roster_url.includes('view=')) {
    const sep = roster_url.includes('?') ? '&' : '?';
    urlsToTry.push(roster_url + sep + 'view=list');
  }

  let bestHtml = null;
  let players = [];

  for (const url of urlsToTry) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const resp = await fetch(url, { signal: controller.signal, headers: FETCH_HEADERS });
      clearTimeout(timeout);
      if (resp.ok) {
        const html = await resp.text();
        console.log(`[fetchNcaaRoster] Fetched ${html.length} chars from ${url}`);
        const parsed = parseSidearmRoster(html);
        console.log(`[fetchNcaaRoster] Parsed ${parsed.length} players from HTML`);
        if (parsed.length > 0) {
          console.log(`[fetchNcaaRoster] Returning ${parsed.length} players from direct HTML parse`);
          return Response.json({ players: parsed, count: parsed.length, source: 'html' });
        }
        // Keep the best (first successful) HTML for LLM fallback
        if (!bestHtml) bestHtml = html;
      } else {
        console.log(`[fetchNcaaRoster] HTTP ${resp.status} from ${url}`);
      }
    } catch (e) {
      clearTimeout(timeout);
      console.log(`[fetchNcaaRoster] Fetch error for ${url}: ${e.message}`);
    }
  }

  // LLM fallback — pass extracted text from the HTML we already have (fast, no internet search)
  console.log(`[fetchNcaaRoster] Falling back to LLM for ${roster_url}`);

  const rosterText = bestHtml ? extractRosterText(bestHtml) : null;

  // First attempt: use extracted HTML text if available (fast, no internet needed)
  if (rosterText) {
    try {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'gemini_3_flash',
        prompt: `Extract the baseball roster from the following page content. Return ALL players listed.

PAGE CONTENT:
${rosterText}

For each player provide: name (full name), number (jersey number as string or ""), position (abbreviation: RHP/LHP/OF/IF/C/P/DH/1B/2B/3B/SS etc), bats (R/L/S or ""), throws (R/L or "").
Only return real players. Do not invent names.`,
        add_context_from_internet: false,
        response_json_schema: {
          type: 'object',
          properties: {
            players: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name:     { type: 'string' },
                  number:   { type: 'string' },
                  position: { type: 'string' },
                  bats:     { type: 'string' },
                  throws:   { type: 'string' },
                },
              },
            },
          },
        },
      });

      const llmPlayers = (result?.players || [])
        .filter(p => p.name && p.name.trim().length > 1)
        .map(p => ({
          name: (p.name || '').toUpperCase().trim(),
          number: String(p.number || '').trim(),
          position: (p.position || '').toUpperCase().trim(),
          bats: (p.bats || '').toUpperCase().trim(),
          throws: (p.throws || '').toUpperCase().trim(),
        }));

      console.log(`[fetchNcaaRoster] LLM (text) returned ${llmPlayers.length} players`);
      if (llmPlayers.length > 0) {
        return Response.json({ players: llmPlayers, count: llmPlayers.length, source: 'llm' });
      }
    } catch (e) {
      console.log(`[fetchNcaaRoster] LLM (text) failed: ${e.message}`);
    }
  }

  // Second attempt: LLM with internet access (JS-rendered sites)
  // MUST use gemini_3_flash — it's the only model that supports add_context_from_internet=true.
  // Using the default model (gpt-4o-mini) with add_context_from_internet causes a Python-level
  // type error in the integration layer: "unsupported operand type(s) for |: 'dict' and 'str'"
  console.log(`[fetchNcaaRoster] Trying LLM with internet for ${roster_url}`);
  try {
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      prompt: `Go to this URL and list every baseball player on the roster page: ${roster_url}

For each player output one line in this exact format:
NUMBER|NAME|POSITION|BATS|THROWS

Example:
12|John Smith|OF|R|R
5|Mike Jones|RHP||R
0|Alex Brown|C|L|R

Rules:
- NUMBER: jersey number digits only, or blank
- NAME: full name exactly as shown
- POSITION: abbreviation as shown (OF, IF, P, RHP, LHP, C, 1B, 2B, 3B, SS, DH, etc)
- BATS: R, L, S, or blank
- THROWS: R, L, or blank
- One player per line, no header line, no extra text
- Do NOT invent players — only list what's on the page`,
      add_context_from_internet: true,
    });

    // Parse the pipe-delimited text response.
    // If the LLM returns an object instead of a string (e.g. when response_json_schema is set
    // or the integration layer returns a dict), convert safely to avoid type errors.
    let resultStr = '';
    if (typeof result === 'string') {
      resultStr = result;
    } else if (result && typeof result === 'object') {
      // If it returned a players array directly, use it
      if (Array.isArray(result.players)) {
        const llmPlayersFromObj = result.players
          .filter(p => p && p.name && String(p.name).trim().length > 1)
          .map(p => ({
            name: String(p.name || '').toUpperCase().trim(),
            number: String(p.number || '').trim(),
            position: String(p.position || '').toUpperCase().trim(),
            bats: String(p.bats || '').toUpperCase().trim(),
            throws: String(p.throws || '').toUpperCase().trim(),
          }));
        console.log(`[fetchNcaaRoster] LLM (internet/obj) returned ${llmPlayersFromObj.length} players`);
        if (llmPlayersFromObj.length > 0) {
          return Response.json({ players: llmPlayersFromObj, count: llmPlayersFromObj.length, source: 'llm' });
        }
      }
      resultStr = JSON.stringify(result);
    }
    const lines = resultStr.split('\n').map(l => l.trim()).filter(l => l.includes('|'));
    const llmPlayers = [];
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 2) continue;
      const name = (parts[1] || '').trim();
      if (!name || name.length < 2) continue;
      llmPlayers.push({
        name: name.toUpperCase(),
        number: (parts[0] || '').trim(),
        position: (parts[2] || '').toUpperCase().trim(),
        bats: (parts[3] || '').toUpperCase().trim(),
        throws: (parts[4] || '').toUpperCase().trim(),
      });
    }

    console.log(`[fetchNcaaRoster] LLM (internet) returned ${llmPlayers.length} players`);
    if (llmPlayers.length > 0) {
      return Response.json({ players: llmPlayers, count: llmPlayers.length, source: 'llm' });
    }
  } catch (llmErr) {
    console.error(`[fetchNcaaRoster] LLM (internet) error: ${llmErr.message}`);
    // "unsupported operand type(s) for |: 'dict' and 'str'" is a Base44 integration layer
    // error that can bubble up — return gracefully instead of propagating as a 500
  }

  return Response.json({
    error: 'Could not extract players from that page. The site may block automated access or the roster URL may be incorrect.',
  }, { status: 422 });
  } catch (topErr) {
    console.error(`[fetchNcaaRoster] Top-level error: ${topErr.message}`);
    return Response.json({ error: 'Could not extract players from that page. Try a different URL or use CSV import.' }, { status: 422 });
  }
});