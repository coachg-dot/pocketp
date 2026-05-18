// Proxy client for Team / TeamPlayer / TeamPitcher
// Routes all calls through the teamData backend function (asServiceRole)
// to bypass the platform dict|str middleware bug on user-scoped entity calls.
import { base44 } from '@/api/base44Client';

async function call(payload) {
  const res = await base44.functions.invoke('teamData', payload);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data?.result;
}

export const TeamAPI = {
  list: () => call({ entity: 'Team', action: 'list' }),
  create: (data) => call({ entity: 'Team', action: 'create', data }),
  update: (id, data) => call({ entity: 'Team', action: 'update', id, data }),
  delete: (id) => call({ entity: 'Team', action: 'delete', id }),
};

export const TeamPlayerAPI = {
  list: () => call({ entity: 'TeamPlayer', action: 'list' }),
  filter: (teamId) => call({ entity: 'TeamPlayer', action: 'filter', filter_field: 'team_id', filter_value: teamId }),
  create: (data) => call({ entity: 'TeamPlayer', action: 'create', data }),
  update: (id, data) => call({ entity: 'TeamPlayer', action: 'update', id, data }),
  delete: (id) => call({ entity: 'TeamPlayer', action: 'delete', id }),
};

export const TeamPitcherAPI = {
  list: () => call({ entity: 'TeamPitcher', action: 'list' }),
  filter: (teamId) => call({ entity: 'TeamPitcher', action: 'filter', filter_field: 'team_id', filter_value: teamId }),
  create: (data) => call({ entity: 'TeamPitcher', action: 'create', data }),
  update: (id, data) => call({ entity: 'TeamPitcher', action: 'update', id, data }),
  delete: (id) => call({ entity: 'TeamPitcher', action: 'delete', id }),
};