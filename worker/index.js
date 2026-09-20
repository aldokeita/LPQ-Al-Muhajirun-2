// Worker yang melayani frontend Vite sekaligus API di satu origin.
//
// Rute /api/* ditangani di sini; selebihnya diteruskan ke aset statis, dengan
// penanganan SPA yang memulangkan index.html untuk path yang tidak dikenal.
//
// Setiap endpoint data melewati lapisan otorisasi di worker/auth. RLS tidak lagi menjaga
// apa pun setelah lepas dari Postgres, jadi query yang menembus langsung ke env.DB sama
// dengan kebijakan yang hilang — tidak ada jaring pengaman di belakangnya.

import { handleAuth } from './routes/auth.js';
import { handleData } from './routes/data.js';
import { handleRpc } from './routes/rpc.js';
import { handleManageUser, handleResetPassword } from './routes/manage-user.js';

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

  if (url.pathname.startsWith('/api/data/')) {
    const response = await handleData(request, env, url);
    if (response) return response;
  }

  if (url.pathname.startsWith('/api/rpc/')) {
    const response = await handleRpc(request, env, url);
    if (response) return response;
  }

  if (url.pathname === '/api/reset-user-password') {
    const response = await handleResetPassword(request, env, url);
    if (response) return response;
  }

  if (url.pathname === '/api/manage-user') {
    const response = await handleManageUser(request, env, url);
    if (response) return response;
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
