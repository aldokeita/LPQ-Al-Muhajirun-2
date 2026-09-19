// Worker yang melayani frontend Vite sekaligus API di satu origin.
//
// Rute /api/* ditangani di sini; selebihnya diteruskan ke aset statis, dengan
// penanganan SPA yang memulangkan index.html untuk path yang tidak dikenal.
//
// Lapisan otorisasi belum ada. Sampai sepuluh predikat di docs/51-d1-schema-mapping.md
// terpasang, tidak boleh ada endpoint di sini yang memulangkan data santri, wali, atau
// pembayaran. RLS tidak lagi menjaga apa pun setelah lepas dari Postgres.

import { handleAuth } from './routes/auth.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const handleApi = async (request, env, url) => {
  if (url.pathname.startsWith('/api/auth/')) {
    const response = await handleAuth(request, env, url);
    if (response) return response;
    return json({ error: 'method_not_allowed', path: url.pathname }, 405);
  }

  // Endpoint kesehatan: memastikan binding D1 benar-benar tersambung tanpa
  // membocorkan isi tabel apa pun.
  if (url.pathname === '/api/health') {
    try {
      const row = await env.DB.prepare('select count(*) as tables from sqlite_master where type = ?')
        .bind('table')
        .first();
      return json({ status: 'ok', database: 'reachable', tables: row?.tables ?? null });
    } catch (error) {
      return json({ status: 'error', database: 'unreachable', message: error.message }, 503);
    }
  }

  return json({ error: 'not_found', path: url.pathname }, 404);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);
    return env.ASSETS.fetch(request);
  },
};
