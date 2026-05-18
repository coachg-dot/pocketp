import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const email = user.email;
    const sr = base44.asServiceRole;

    // Fetch all owned records for each entity in parallel
    const [teams, teamPlayers, teamPitchers, games, scheduledGames] = await Promise.all([
      sr.entities.Team.filter({ owner_email: email }),
      sr.entities.TeamPlayer.filter({ owner_email: email }),
      sr.entities.TeamPitcher.filter({ owner_email: email }),
      sr.entities.Game.filter({ created_by: email }),
      sr.entities.ScheduledGame.filter({ created_by: email }),
    ]);

    // For each game, fetch pitches and at-bats
    const gameIds = games.map(g => g.id);
    let pitches = [], atBats = [];
    for (const gid of gameIds) {
      const [p, a] = await Promise.all([
        sr.entities.Pitch.filter({ game_id: gid }),
        sr.entities.AtBat.filter({ game_id: gid }),
      ]);
      pitches.push(...p);
      atBats.push(...a);
    }

    // Delete everything in parallel batches
    await Promise.all([
      ...teams.map(r => sr.entities.Team.delete(r.id)),
      ...teamPlayers.map(r => sr.entities.TeamPlayer.delete(r.id)),
      ...teamPitchers.map(r => sr.entities.TeamPitcher.delete(r.id)),
      ...games.map(r => sr.entities.Game.delete(r.id)),
      ...scheduledGames.map(r => sr.entities.ScheduledGame.delete(r.id)),
      ...pitches.map(r => sr.entities.Pitch.delete(r.id)),
      ...atBats.map(r => sr.entities.AtBat.delete(r.id)),
    ]);

    console.log(`[clearMyData] ${email}: deleted ${teams.length} teams, ${teamPlayers.length} players, ${teamPitchers.length} pitchers, ${games.length} games, ${scheduledGames.length} scheduled, ${pitches.length} pitches, ${atBats.length} at-bats`);

    return Response.json({
      deleted: {
        teams: teams.length,
        teamPlayers: teamPlayers.length,
        teamPitchers: teamPitchers.length,
        games: games.length,
        scheduledGames: scheduledGames.length,
        pitches: pitches.length,
        atBats: atBats.length,
      }
    });
  } catch (error) {
    console.error('[clearMyData] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});