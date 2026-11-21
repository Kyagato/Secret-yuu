import { getConnectionString } from '@netlify/database';
import pg from 'pg';
import api from '../../worker/api.js';
import { accountApi } from '../../account-api.mjs';

let pool;
// Reuse the same validated API as the local SQLite app.
function prepare(sql, values = []) {
  let parameter = 0;
  const query = sql.replace(/\?/g, () => '$' + (++parameter));
  const execute = () => pool.query(query, values);
  return {
    bind: (...args) => prepare(sql, args),
    async first() { return (await execute()).rows[0]; },
    async all() {
      const { rows } = await execute();
      for (const row of rows) if ('replies' in row) row.replies = Number(row.replies);
      return { results: rows };
    },
    run: execute
  };
}

export default async function conversations(request, context) {
  pool ??= new pg.Pool({ connectionString: getConnectionString(), max: 2 });
  if (new URL(request.url).pathname.startsWith('/api/account/')) return accountApi(request, { prepare }, context.ip, context.waitUntil?.bind(context));
  return api.fetch(request, { DB: { prepare } });
}

export const config = { path: '/api/*' };
