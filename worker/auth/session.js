// Penerbitan dan pemeriksaan sesi.
//
// Token ditandatangani HMAC-SHA256 dan berisi identitas beserta masa berlaku, sehingga
// pemeriksaan tiap request tidak perlu menyentuh D1. Konsekuensinya token tidak bisa
// dicabut satu per satu sebelum kedaluwarsa; karena itu masa berlakunya pendek dan
// peran tidak ikut dipercaya dari token (lihat catatan di bawah).
//
// Peran sengaja TIDAK dibaca dari token saat otorisasi. Predikat selalu membaca peran
// dari user_profiles, supaya pencabutan atau penurunan hak berlaku seketika, bukan
// setelah token kedaluwarsa.

const encoder = new TextEncoder();

export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const toBase64Url = (bytes) => {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
};

const importKey = async (secret) => {
  if (!secret) throw new Error('SESSION_SECRET belum diset.');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
};

const sign = async (secret, data) => {
  const key = await importKey(secret);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
};

export const issueSession = async (secret, { userId, ttlSeconds = SESSION_TTL_SECONDS }) => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = { sub: userId, iat: issuedAt, exp: issuedAt + ttlSeconds };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = toBase64Url(await sign(secret, body));
  return { token: `${body}.${signature}`, expiresAt: new Date(payload.exp * 1000).toISOString() };
};

export const verifySession = async (secret, token) => {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  let expected;
  try {
    expected = await sign(secret, body);
  } catch {
    return null;
  }
  if (!timingSafeEqual(expected, fromBase64Url(signature))) return null;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
  } catch {
    return null;
  }
  if (typeof payload?.sub !== 'string' || typeof payload?.exp !== 'number') return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
};

// Cookie sesi: HttpOnly agar tidak terbaca skrip, Secure karena selalu di atas HTTPS,
// dan SameSite=Lax supaya tidak ikut terkirim pada permintaan lintas situs.
export const sessionCookie = (token, maxAgeSeconds = SESSION_TTL_SECONDS) =>
  `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;

export const clearedSessionCookie = () => 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';

export const readSessionCookie = (request) => {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'session') return rest.join('=');
  }
  return null;
};
