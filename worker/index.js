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
import { handleFiles } from './routes/files.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const handleApi = async (request, env, url) => {
  // Endpoint kesehatan diperiksa lebih dulu, sebelum pagar rahasia sesi di bawah. Justru
  // ketika rahasianya hilang endpoint ini paling dibutuhkan, jadi ia tidak boleh ikut
  // tertahan oleh pagar yang melaporkan keadaan itu.
  if (url.pathname === '/api/health') {
    try {
      const row = await env.DB.prepare('select count(*) as tables from sqlite_master where type = ?')
        .bind('table')
        .first();
      // Keberadaan rahasia sesi ikut dilaporkan, bukan nilainya. Ini membuat hasil deploy
      // bisa diperiksa tanpa harus mencoba login lebih dulu.
      return json({
        status: env.SESSION_SECRET ? 'ok' : 'error',
        database: 'reachable',
        tables: row?.tables ?? null,
        session_secret: env.SESSION_SECRET ? 'configured' : 'missing',
      }, env.SESSION_SECRET ? 200 : 503);
    } catch (error) {
      return json({ status: 'error', database: 'unreachable', message: error.message }, 503);
    }
  }

  // Tanpa SESSION_SECRET tidak ada sesi yang bisa diterbitkan maupun diperiksa, jadi
  // seluruh aplikasi mati. Kegagalannya sendiri aman — penandatanganan melempar dan
  // pemeriksaan memulangkan null, sehingga tidak ada token yang bisa dipalsukan — tetapi
  // tanpa pemeriksaan di sini yang terlihat hanyalah 500 kosong saat mencoba login.
  // Menyebutkan sebabnya sekali di sini jauh lebih murah daripada menebaknya nanti.
  if (!env.SESSION_SECRET) {
    return json({
      error: 'session_secret_missing',
      message: 'SESSION_SECRET belum diset pada Worker. Jalankan: npx wrangler secret put SESSION_SECRET',
    }, 503);
  }

  if (url.pathname.startsWith('/api/auth/')) {
    const response = await handleAuth(request, env, url);
    if (response) return response;
    return json({ error: 'method_not_allowed', path: url.pathname }, 405);
  }

  if (url.pathname.startsWith('/api/files')) {
    const response = await handleFiles(request, env, url);
    if (response) return response;
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

  return json({ error: 'not_found', path: url.pathname }, 404);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);
    return env.ASSETS.fetch(request);
  },
};
