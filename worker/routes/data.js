// Endpoint baca data.
//
// Satu pintu untuk seluruh pembacaan, dilewatkan lapisan otorisasi yang sama. Permukaan
// query sengaja sempit: hanya tabel dan kolom yang ada di manifest, hanya operator yang
// terdaftar, dan selalu dibatasi jumlah barisnya.

import { createAuthorizer } from '../auth/authorize.js';
import { QueryError, runQuery } from '../data/query.js';
import { readSessionCookie, verifySession } from '../auth/session.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const handleData = async (request, env, url) => {
  if (url.pathname !== '/api/data/query') return null;
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body', message: 'Body harus berupa JSON.' }, 400);
  }

  const payload = await verifySession(env.SESSION_SECRET, readSessionCookie(request));
  const authorizer = createAuthorizer(env.DB, payload?.sub ?? null);

  try {
    const result = await runQuery(env.DB, authorizer.ctx, authorizer, body);
    return json({ data: result.rows, limit: result.limit, offset: result.offset });
  } catch (error) {
    if (error instanceof QueryError) {
      return json({ error: error.status === 403 ? 'forbidden' : 'invalid_query', message: error.message }, error.status);
    }
    // Detail galat internal tidak dibocorkan ke pemanggil.
    console.error('[data] query gagal:', error.message);
    return json({ error: 'query_failed', message: 'Permintaan tidak dapat diproses.' }, 500);
  }
};
