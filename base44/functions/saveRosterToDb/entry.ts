import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('[saveRosterToDb] request received');
  try {
    const base44 = createClientFromRequest(req);
    console.log('[saveRosterToDb] client created');

    let user = null;
    try {
      user = await base44.auth.me();
      console.log('[saveRosterToDb] user:', user?.email);
    } catch (authErr) {
      console.log('[saveRosterToDb] auth error:', String(authErr));
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const { team_name, team_id, players } = body;
    let teamId = team_id || null;

    console.log('[saveRosterToDb] team_name:', team_name, 'players count:', (players || []).length);

    if (team_name && !teamId) {
      try {
        const created = await base44.asServiceRole.entities.Team.create({ name: String(team_name).toUpperCase(), owner_email: user.email });
        teamId = created.id;
        console.log('[saveRosterToDb] created team:', teamId);
      } catch (e) {
        console.log('[saveRosterToDb] team create error:', String(e));
        return Response.json({ error: 'Team create failed: ' + String(e.message) }, { status: 500 });
      }
    }

    let existingPlayers = [], existingPitchers = [];
    if (teamId) {
      try {
        [existingPlayers, existingPitchers] = await Promise.all([
          base44.asServiceRole.entities.TeamPlayer.filter({ team_id: teamId }),
          base44.asServiceRole.entities.TeamPitcher.filter({ team_id: teamId }),
        ]);
      } catch (e) {
        console.log('[saveRosterToDb] filter error:', String(e));
      }
    }

    const normName = (n) => String(n || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const existingPlayerNames = new Set(existingPlayers.map(p => normName(p.name)));
    const existingPitcherNames = new Set(existingPitchers.map(p => normName(p.name)));

    const isPitcher = (pos) => {
      if (!pos) return false;
      return /(?:^|[/\s,])P(?=[/\s,]|$)|RHP|LHP|\bSP\b|\bRP\b|PITCHER/i.test(String(pos).trim());
    };
    const isFieldOnly = (pos) => {
      if (!pos) return true;
      return /\b(C|1B|2B|3B|SS|LF|CF|RF|OF|IF|DH|UT|INF|CATCHER|INFIELD|OUTFIELD|UTILITY)\b/i.test(String(pos).trim());
    };

    const toCreatePlayers = [];
    const toCreatePitchers = [];
    let skipped = 0;

    for (const player of (players || [])) {
      const name = String(player.name || '').toUpperCase().trim();
      if (!name) continue;
      const key = normName(name);
      const pos = String(player.position || '');
      const pitcher = isPitcher(pos);
      const field = isFieldOnly(pos);

      if (pitcher && !existingPitcherNames.has(key)) {
        const rec = { name, owner_email: user.email };
        if (teamId) rec.team_id = teamId;
        if (player.number) rec.number = String(player.number);
        if (player.throws) rec.throws = String(player.throws);
        toCreatePitchers.push(rec);
        existingPitcherNames.add(key);
      }

      if ((field || !pitcher) && !existingPlayerNames.has(key)) {
        const rec = { name, owner_email: user.email };
        if (teamId) rec.team_id = teamId;
        if (player.number) rec.number = String(player.number);
        if (pos) rec.position = pos;
        if (player.bats) rec.bats = String(player.bats);
        if (player.throws) rec.throws = String(player.throws);
        toCreatePlayers.push(rec);
        existingPlayerNames.add(key);
      } else if (pitcher && existingPlayerNames.has(key)) {
        skipped++;
      } else if (!pitcher && existingPlayerNames.has(key)) {
        skipped++;
      }
    }

    console.log('[saveRosterToDb] creating', toCreatePlayers.length, 'players,', toCreatePitchers.length, 'pitchers');

    const [playerResults, pitcherResults] = await Promise.all([
      Promise.allSettled(toCreatePlayers.map(p => base44.asServiceRole.entities.TeamPlayer.create(p))),
      Promise.allSettled(toCreatePitchers.map(p => base44.asServiceRole.entities.TeamPitcher.create(p))),
    ]);

    let successPlayers = 0, successPitchers = 0, failed = 0;
    const errors = [];
    playerResults.forEach((r, i) => {
      if (r.status === 'fulfilled') successPlayers++;
      else { failed++; errors.push(String(toCreatePlayers[i].name) + ': ' + String(r.reason?.message || 'failed')); }
    });
    pitcherResults.forEach((r, i) => {
      if (r.status === 'fulfilled') successPitchers++;
      else { failed++; errors.push(String(toCreatePitchers[i].name) + ': ' + String(r.reason?.message || 'failed')); }
    });

    console.log('[saveRosterToDb] done. players:', successPlayers, 'pitchers:', successPitchers, 'failed:', failed);
    return Response.json({ successPlayers, successPitchers, skipped, failed, errors, teamId });
  } catch (error) {
    console.log('[saveRosterToDb] unhandled error:', String(error));
    return Response.json({ error: String(error.message) }, { status: 500 });
  }
});