import { getConnectionString } from '@netlify/database';
import pg from 'pg';
import api from '../../worker/api.js';

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

export default async function conversations(request) {
  pool ??= new pg.Pool({ connectionString: getConnectionString(), max: 2 });
  return api.fetch(request, { DB: { prepare } });
}

export const config = { path: '/api/*' };
