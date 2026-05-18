import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    console.log('[importRosterPlayers] request received');
    const base44 = createClientFromRequest(req);
    console.log('[importRosterPlayers] client created');
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('[importRosterPlayers] user:', user?.email);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[importRosterPlayers] body keys:', Object.keys(body), 'players count:', body?.players?.length);
    const { team_name, team_id, players } = body;

    let teamId = team_id || null;

    // Create a new team if team_name provided but no team_id
    if (team_name && !teamId) {
      console.log('[importRosterPlayers] creating team:', team_name.toUpperCase());
      const created = await base44.entities.Team.create({ name: team_name.toUpperCase() });
      console.log('[importRosterPlayers] team created:', created?.id);
      teamId = created.id;
    }

    // Pre-fetch existing for dedup
    const [existingPlayers, existingPitchers] = await Promise.all([
      teamId ? base44.entities.TeamPlayer.filter({ team_id: teamId }) : Promise.resolve([]),
      teamId ? base44.entities.TeamPitcher.filter({ team_id: teamId }) : Promise.resolve([]),
    ]);

    const normName = (n) => (n || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const existingPlayerNames = new Set(existingPlayers.map(p => normName(p.name)));
    const existingPitcherNames = new Set(existingPitchers.map(p => normName(p.name)));

    const isPitcher = (pos) => {
      if (!pos) return false;
      const p = pos.toUpperCase().trim();
      return /(?:^|[/\s,])P(?:[/\s,]|$)|RHP|LHP|\bSP\b|\bRP\b|PITCHER/.test(p);
    };
    const isFieldPlayer = (pos) => {
      if (!pos) return true;
      const p = pos.toUpperCase().trim();
      return /\b(C|1B|2B|3B|SS|LF|CF|RF|OF|IF|DH|UT|INF|OUT|CATCHER|INFIELD|OUTFIELD|UTILITY)\b/.test(p);
    };

    const toCreatePlayers = [];
    const toCreatePitchers = [];
    let skipped = 0;

    for (const player of players) {
      const name = (player.name || '').toUpperCase();
      if (!name) continue;
      const key = normName(name);
      const pos = player.position || '';
      const pitcherRole = isPitcher(pos);
      const fieldRole = isFieldPlayer(pos) || !pitcherRole;

      if (pitcherRole) {
        if (!existingPitcherNames.has(key)) {
          const rec = { name, team_id: teamId };
          if (player.number) rec.number = player.number;
          if (player.throws) rec.throws = player.throws;
          toCreatePitchers.push(rec);
          existingPitcherNames.add(key);
        } else {
          if (!fieldRole || existingPlayerNames.has(key)) skipped++;
        }
      }
      if (fieldRole && !pitcherRole) {
        if (!existingPlayerNames.has(key)) {
          const rec = { name, team_id: teamId };
          if (player.number) rec.number = player.number;
          if (pos) rec.position = pos;
          if (player.bats) rec.bats = player.bats;
          if (player.throws) rec.throws = player.throws;
          toCreatePlayers.push(rec);
          existingPlayerNames.add(key);
        } else {
          skipped++;
        }
      } else if (fieldRole && pitcherRole) {
        if (!existingPlayerNames.has(key)) {
          const fieldPos = pos.replace(/(?:^|[/\s,])(RHP|LHP|SP|RP|\bP\b)/g, '').replace(/^[\/\s,]+|[\/\s,]+$/g, '').trim() || pos;
          const rec = { name, team_id: teamId };
          if (player.number) rec.number = player.number;
          if (fieldPos) rec.position = fieldPos;
          if (player.bats) rec.bats = player.bats;
          if (player.throws) rec.throws = player.throws;
          toCreatePlayers.push(rec);
          existingPlayerNames.add(key);
        }
      }
    }

    console.log('[importRosterPlayers] creating', toCreatePlayers.length, 'players,', toCreatePitchers.length, 'pitchers');

    let successPlayers = 0, successPitchers = 0, failed = 0;
    const errors = [];

    if (toCreatePlayers.length > 0) {
      try {
        await base44.entities.TeamPlayer.bulkCreate(toCreatePlayers);
        successPlayers = toCreatePlayers.length;
      } catch (e) {
        console.error('[importRosterPlayers] bulkCreate players failed:', e.message);
        // Fall back to individual creates
        const results = await Promise.allSettled(toCreatePlayers.map(p => base44.entities.TeamPlayer.create(p)));
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') successPlayers++;
          else { failed++; errors.push(`${toCreatePlayers[i].name}: ${r.reason?.message || 'failed'}`); }
        });
      }
    }

    if (toCreatePitchers.length > 0) {
      try {
        await base44.entities.TeamPitcher.bulkCreate(toCreatePitchers);
        successPitchers = toCreatePitchers.length;
      } catch (e) {
        console.error('[importRosterPlayers] bulkCreate pitchers failed:', e.message);
        const results = await Promise.allSettled(toCreatePitchers.map(p => base44.entities.TeamPitcher.create(p)));
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') successPitchers++;
          else { failed++; errors.push(`${toCreatePitchers[i].name}: ${r.reason?.message || 'failed'}`); }
        });
      }
    }

    return Response.json({ successPlayers, successPitchers, skipped, failed, errors, teamId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});