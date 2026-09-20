// Endpoint autentikasi.
//
// Pesan kegagalan sengaja seragam untuk semua sebab — akun tidak ada, password salah,
// peran tidak sesuai — supaya tidak ada yang bisa memakai endpoint ini untuk menebak
// akun mana yang terdaftar.

import { consumeRateLimit, loginSantri, loginStaff, recordLoginAttempt, sha256Hex } from '../auth/login.js';
import {
  clearedSessionCookie, issueSession, readSessionCookie, sessionCookie, verifySession,
} from '../auth/session.js';
import { rehashToPbkdf2, verifyPassword } from '../auth/password.js';

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

const INVALID_LOGIN = { error: 'invalid_login', message: 'Identitas atau kata sandi salah.' };

const readJson = async (request) => {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
};

const clientIp = (request) => request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'tanpa-ip';

// Percobaan dihitung per kombinasi IP dan identitas, sehingga satu santri yang salah ketik
// tidak memblokir seluruh jaringan sekolah yang memakai satu IP publik.
const guardRateLimit = async (env, request, identifier, purpose = 'login') => {
  const [ipHash, aliasHash] = await Promise.all([
    sha256Hex(clientIp(request)),
    sha256Hex(String(identifier ?? '').toLowerCase()),
  ]);
  return consumeRateLimit(env.DB, { purpose, ipHash, aliasHash });
};

const tooManyAttempts = (limit) =>
  json(
    { error: 'too_many_attempts', message: 'Terlalu banyak percobaan. Coba lagi nanti.', blocked_until: limit.blockedUntil },
    429,
    { 'retry-after': String(Math.max(1, Math.ceil((Date.parse(limit.blockedUntil) - Date.now()) / 1000))) },
  );

const succeed = async (env, request, { userId, role, usernameAttempt, device = null }) => {
  const { token, expiresAt } = await issueSession(env.SESSION_SECRET, { userId });
  await recordLoginAttempt(env.DB, { userId, role, usernameAttempt, status: 'success', device, request });
  return json(
    { user: { id: userId, role }, expires_at: expiresAt },
    200,
    { 'set-cookie': sessionCookie(token) },
  );
};

export const handleAuth = async (request, env, url) => {
  if (url.pathname === '/api/auth/login/santri' && request.method === 'POST') {
    const body = await readJson(request);
    const identifier = body?.identifier ?? body?.username ?? null;

    const limit = await guardRateLimit(env, request, identifier);
    if (!limit.allowed) return tooManyAttempts(limit);

    const result = await loginSantri(env.DB, { identifier, nomorInduk: body?.nomor_induk ?? body?.password });
    if (!result.ok) {
      await recordLoginAttempt(env.DB, { usernameAttempt: identifier, status: 'failed', device: body?.device, request });
      return json(INVALID_LOGIN, 401);
    }
    return succeed(env, request, {
      userId: result.userId, role: result.role, usernameAttempt: identifier, device: body?.device,
    });
  }

  if (url.pathname === '/api/auth/login/staff' && request.method === 'POST') {
    const body = await readJson(request);
    const email = body?.email ?? null;

    const limit = await guardRateLimit(env, request, email);
    if (!limit.allowed) return tooManyAttempts(limit);

    const result = await loginStaff(env.DB, { email, password: body?.password });
    if (!result.ok) {
      await recordLoginAttempt(env.DB, { usernameAttempt: email, status: 'failed', device: body?.device, request });
      return json(INVALID_LOGIN, 401);
    }
    return succeed(env, request, {
      userId: result.userId, role: result.role, usernameAttempt: email, device: body?.device,
    });
  }

  // Mengganti password sendiri. Berbeda dari /api/reset-user-password, yang hanya boleh
  // dipakai admin terhadap akun orang lain: yang ini hanya bisa mengubah akun pemanggil,
  // dan menuntut password lama.
  //
  // Password lama diminta karena cookie sesi saja bukan bukti yang cukup untuk mengganti
  // kredensial. Tanpa itu, satu sesi yang bocor cukup untuk mengambil alih akun secara
  // permanen; dengan itu, penyerang tetap harus tahu password aslinya.
  if (url.pathname === '/api/auth/change-password' && request.method === 'POST') {
    const payload = await verifySession(env.SESSION_SECRET, readSessionCookie(request));
    if (!payload) return json({ error: 'unauthorized', message: 'Sesi diperlukan.' }, 401);

    const body = await readJson(request);
    const currentPassword = typeof body?.current_password === 'string' ? body.current_password : '';
    const newPassword = typeof body?.new_password === 'string' ? body.new_password : '';

    if (newPassword.length < 8) {
      return json({ error: 'weak_password', message: 'Password baru minimal 8 karakter.' }, 400);
    }

    // Dibatasi seperti login. Tanpa ini endpoint-nya bisa dipakai menebak password lama
    // berulang kali dari satu sesi yang sudah dipegang.
    const limit = await guardRateLimit(env, request, payload.sub, 'change_password');
    if (!limit.allowed) return tooManyAttempts(limit);

    const account = await env.DB
      .prepare('select "id", "encrypted_password", "password_algorithm" from "users" where "id" = ? and "deleted_at" is null limit 1')
      .bind(payload.sub)
      .first();
    if (!account) return json({ error: 'unauthorized', message: 'Sesi diperlukan.' }, 401);

    const verified = await verifyPassword(currentPassword, account.encrypted_password, account.password_algorithm);
    if (!verified.valid) {
      return json({ error: 'invalid_password', message: 'Password saat ini salah.' }, 401);
    }

    await rehashToPbkdf2(env.DB, account.id, newPassword);
    return json({ ok: true });
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': clearedSessionCookie() });
  }

  // Peran dibaca ulang dari database, tidak dipercaya dari token, supaya pencabutan hak
  // berlaku seketika.
  if (url.pathname === '/api/auth/session' && request.method === 'GET') {
    const payload = await verifySession(env.SESSION_SECRET, readSessionCookie(request));
    if (!payload) return json({ user: null }, 200);

    const profile = await env.DB
      .prepare('select "id", "role", "status" from "user_profiles" where "id" = ? limit 1')
      .bind(payload.sub)
      .first();
    if (!profile || profile.status !== 'active') {
      return json({ user: null }, 200, { 'set-cookie': clearedSessionCookie() });
    }
    return json({ user: { id: profile.id, role: profile.role }, expires_at: new Date(payload.exp * 1000).toISOString() });
  }

  return null;
};
