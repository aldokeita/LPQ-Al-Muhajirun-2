// Endpoint baca data.
//
// Satu pintu untuk seluruh pembacaan, dilewatkan lapisan otorisasi yang sama. Permukaan
// query sengaja sempit: hanya tabel dan kolom yang ada di manifest, hanya operator yang
// terdaftar, dan selalu dibatasi jumlah barisnya.

import { AuthorizationError, createAuthorizer } from '../auth/authorize.js';
import { QueryError, runCount, runQuery } from '../data/query.js';
import { deleteRow, insertRow, updateRow, upsertRow } from '../data/mutate.js';
import { readSessionCookie, verifySession } from '../auth/session.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const ROUTES = {
  '/api/data/query': (db, authorizer, body) => runQuery(db, authorizer.ctx, authorizer, body),
  '/api/data/count': (db, authorizer, body) => runCount(db, authorizer.ctx, authorizer, body),
  '/api/data/insert': (db, authorizer, body) => insertRow(db, authorizer, body),
  '/api/data/update': (db, authorizer, body) => updateRow(db, authorizer, body),
  '/api/data/upsert': (db, authorizer, body) => upsertRow(db, authorizer, body),
  '/api/data/delete': (db, authorizer, body) => deleteRow(db, authorizer, body),
};

export const handleData = async (request, env, url) => {
  const handler = ROUTES[url.pathname];
  if (!handler) return null;
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body', message: 'Body harus berupa JSON.' }, 400);
  }

  const payload = await verifySession(env.SESSION_SECRET, readSessionCookie(request));
  const authorizer = createAuthorizer(env.DB, payload?.sub ?? null);

  // Penulisan menuntut sesi, kecuali tabel yang memang membuka penambahan untuk umum.
  // Hanya feedbacks yang begitu, dan itu memang perilaku lamanya: siapa pun boleh
  // mengirim masukan, hanya admin yang boleh membacanya.
  // Membaca dan menghitung boleh tanpa sesi; kebijakan per tabel yang menentukan
  // baris mana yang terlihat, dan hitungannya memakai klausa yang sama.
  const READ_ROUTES = new Set(['/api/data/query', '/api/data/count']);
  if (!payload && !READ_ROUTES.has(url.pathname)) {
    const publicInsert = url.pathname === '/api/data/insert' && authorizer.allowsPublicInsert(body?.table);
    if (!publicInsert) return json({ error: 'unauthorized', message: 'Sesi diperlukan.' }, 401);
  }

  try {
    const result = await handler(env.DB, authorizer, body);
    if (url.pathname === '/api/data/query') {
      return json({ data: result.rows, limit: result.limit, offset: result.offset });
    }
    if (url.pathname === '/api/data/count') return json({ data: result.count });
    return json({ data: result });
  } catch (error) {
    if (error instanceof QueryError) {
      return json({ error: error.status === 403 ? 'forbidden' : 'invalid_query', message: error.message }, error.status);
    }
    if (error instanceof AuthorizationError) {
      return json({ error: 'forbidden', message: 'Akses ditolak.' }, error.status ?? 403);
    }
    // Detail galat internal tidak dibocorkan ke pemanggil.
    console.error('[data] permintaan gagal:', error.message);
    return json({ error: 'request_failed', message: 'Permintaan tidak dapat diproses.' }, 500);
  }
};
