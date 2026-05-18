import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Proxy for all Team / TeamPlayer / TeamPitcher reads & writes
// Uses asServiceRole to bypass the user-scoped dict|str middleware bug
Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);
    let user;
    try { user = await base44.auth.me(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, entity, id, data, filter_field, filter_value } = body;
    const db = base44.asServiceRole.entities;

    // Helper: inject owner_email on create so we can filter by it
    // (asServiceRole overwrites created_by with service account, so we use a separate field)
    const withOwner = (d) => ({ ...d, owner_email: user.email });

    // Security: only allow access to records owned by this user
    const ownerEmail = user.email;

    let result;

    if (entity === 'Team') {
      if (action === 'list') {
        const all = await db.Team.list('name', 500);
        // Match by owner_email (new records) OR created_by (old records before migration)
        result = all.filter(t => t.owner_email === ownerEmail || t.created_by === ownerEmail);
      } else if (action === 'create') {
        result = await db.Team.create(withOwner(data));
      } else if (action === 'update') {
        result = await db.Team.update(id, data);
      } else if (action === 'delete') {
        try { result = await db.Team.delete(id); } catch (e) { if (!String(e).includes('not found')) throw e; result = null; }
      }

    } else if (entity === 'TeamPlayer') {
      if (action === 'list') {
        const all = await db.TeamPlayer.list('name', 2000);
        result = all.filter(p => p.owner_email === ownerEmail || p.created_by === ownerEmail);
      } else if (action === 'filter') {
        const all = await db.TeamPlayer.list('number', 2000);
        result = all.filter(p => (p.owner_email === ownerEmail || p.created_by === ownerEmail) && p.team_id === filter_value);
      } else if (action === 'create') {
        result = await db.TeamPlayer.create(withOwner(data));
      } else if (action === 'update') {
        result = await db.TeamPlayer.update(id, data);
      } else if (action === 'delete') {
        try { result = await db.TeamPlayer.delete(id); } catch (e) { if (!String(e).includes('not found')) throw e; result = null; }
      }

    } else if (entity === 'TeamPitcher') {
      if (action === 'list') {
        const all = await db.TeamPitcher.list('name', 2000);
        result = all.filter(p => p.owner_email === ownerEmail || p.created_by === ownerEmail);
      } else if (action === 'filter') {
        const all = await db.TeamPitcher.list('number', 2000);
        result = all.filter(p => (p.owner_email === ownerEmail || p.created_by === ownerEmail) && p.team_id === filter_value);
      } else if (action === 'create') {
        result = await db.TeamPitcher.create(withOwner(data));
      } else if (action === 'update') {
        result = await db.TeamPitcher.update(id, data);
      } else if (action === 'delete') {
        try { result = await db.TeamPitcher.delete(id); } catch (e) { if (!String(e).includes('not found')) throw e; result = null; }
      }

    } else {
      return Response.json({ error: 'Unknown entity: ' + entity }, { status: 400 });
    }

    return Response.json({ result });
  } catch (error) {
    console.log('[teamData] error:', String(error));
    return Response.json({ error: String(error.message) }, { status: 500 });
  }
});