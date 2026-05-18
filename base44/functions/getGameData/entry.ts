import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { game_id } = await req.json();
    if (!game_id) return Response.json({ error: 'game_id required' }, { status: 400 });

    const [pitches, atBats] = await Promise.all([
      base44.asServiceRole.entities.Pitch.filter({ game_id }),
      base44.asServiceRole.entities.AtBat.filter({ game_id }),
    ]);

    return Response.json({ pitches, atBats });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});