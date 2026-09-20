// Penyimpanan berkas di R2, menggantikan tiga bucket Supabase Storage.
//
// Perbedaan paling besar dari sebelumnya: tidak ada lagi signed URL. Dulu setiap avatar
// diakses lewat URL bertanda tangan yang harus dirotasi, dan setiap rotasi mengubah URL-nya
// sehingga cache peramban meleset dan seluruh avatar terunduh ulang. Itu salah satu dari
// dua sebab kuota egress Supabase jebol.
//
// Di sini URL-nya tetap: /api/files/<awalan>/<path>. Yang berubah bukan alamatnya
// melainkan siapa yang boleh mengambilnya, dan itu diputuskan per permintaan dari cookie
// sesi. Peramban boleh menyimpan hasilnya lama-lama karena alamatnya tidak pernah berubah.
//
// Satu bucket, tiga awalan, tiga aturan:
//   avatars/        foto santri dan guru. Perlu sesi. Menulis: admin, atau pemilik foto itu.
//   website-assets/ gambar dan berkas situs. Terbuka untuk umum. Menulis: admin.
//   music-files/    audio pemutar musik. Terbuka untuk umum. Menulis: admin.

import { createAuthContext, currentUserRole } from '../auth/predicates.js';
import { readSessionCookie, verifySession } from '../auth/session.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const AVATAR_PREFIX = 'avatars';
export const WEBSITE_ASSET_PREFIX = 'website-assets';
export const MUSIC_PREFIX = 'music-files';

const PREFIXES = new Set([AVATAR_PREFIX, WEBSITE_ASSET_PREFIX, MUSIC_PREFIX]);

// Batasnya mengikuti yang sudah ditegakkan di sisi klien, dan diulang di sini karena
// pemeriksaan di peramban bisa dilewati begitu saja.
const MAX_SIZE = {
  [AVATAR_PREFIX]: 2 * 1024 * 1024,
  [WEBSITE_ASSET_PREFIX]: 20 * 1024 * 1024,
  [MUSIC_PREFIX]: 20 * 1024 * 1024,
};

const ALLOWED_TYPES = {
  [AVATAR_PREFIX]: new Set(['image/jpeg', 'image/png', 'image/webp']),
  [WEBSITE_ASSET_PREFIX]: new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  [MUSIC_PREFIX]: new Set(['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4', 'audio/aac']),
};

// Menolak path yang keluar dari awalannya sendiri. Tanpa ini, "avatars/../website-assets/x"
// akan menulis ke wilayah yang aturannya berbeda.
const isSafePath = (path) => (
  typeof path === 'string'
  && path.length > 0
  && path.length <= 512
  && !path.startsWith('/')
  && !path.includes('//')
  && !path.split('/').some((part) => part === '' || part === '.' || part === '..')
  && /^[A-Za-z0-9._/-]+$/.test(path)
);

const splitKey = (key) => {
  const slash = key.indexOf('/');
  if (slash < 0) return { prefix: null, rest: null };
  return { prefix: key.slice(0, slash), rest: key.slice(slash + 1) };
};

const callerRole = async (env, request) => {
  const payload = await verifySession(env.SESSION_SECRET, readSessionCookie(request));
  if (!payload) return { userId: null, role: null };
  const ctx = createAuthContext(env.DB, payload.sub);
  return { userId: payload.sub, role: await currentUserRole(ctx) };
};

// Avatar tersimpan di avatars/<santri|guru>/<id pemilik>/profile.webp, jadi pemiliknya
// bisa dikenali dari path-nya sendiri tanpa membaca tabel apa pun.
const avatarOwnerId = (rest) => {
  const parts = String(rest || '').split('/');
  return parts.length >= 2 ? parts[1] : null;
};

const canWrite = (prefix, rest, caller) => {
  if (!caller.userId) return false;
  if (caller.role === 'admin') return true;
  // Selain admin, seseorang hanya boleh mengganti fotonya sendiri.
  return prefix === AVATAR_PREFIX && avatarOwnerId(rest) === caller.userId;
};

const canRead = async (prefix, env, request) => {
  if (prefix !== AVATAR_PREFIX) return true;
  // Foto orang hanya untuk yang sudah masuk. Perannya tidak dipersoalkan: dulu pun siapa
  // pun yang memegang signed URL bisa melihatnya.
  const payload = await verifySession(env.SESSION_SECRET, readSessionCookie(request));
  return Boolean(payload);
};

// Berkas publik boleh disimpan lama oleh peramban maupun perantara. Avatar hanya boleh
// disimpan peramban yang bersangkutan, karena isinya tidak untuk umum.
const cacheControlFor = (prefix) => (
  prefix === AVATAR_PREFIX
    ? 'private, max-age=604800'
    : 'public, max-age=604800'
);

export const handleFiles = async (request, env, url) => {
  if (!url.pathname.startsWith('/api/files')) return null;
  if (!env.FILES) {
    return json({
      error: 'storage_unavailable',
      message: 'Binding R2 belum tersedia pada Worker ini.',
    }, 503);
  }

  // Mengambil berkas: /api/files/<awalan>/<path>
  if (request.method === 'GET' || request.method === 'HEAD') {
    const key = decodeURIComponent(url.pathname.slice('/api/files/'.length));
    const { prefix, rest } = splitKey(key);
    if (!PREFIXES.has(prefix) || !isSafePath(key)) return json({ error: 'not_found' }, 404);
    if (!(await canRead(prefix, env, request))) {
      return json({ error: 'unauthorized', message: 'Sesi diperlukan.' }, 401);
    }

    const object = await env.FILES.get(key);
    if (!object) return json({ error: 'not_found', message: 'Berkas tidak ditemukan.' }, 404);

    // ETag membuat muat ulang halaman menjawab 304 alih-alih mengirim ulang berkasnya.
    const etag = object.httpEtag;
    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { etag, 'cache-control': cacheControlFor(prefix) } });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', etag);
    headers.set('cache-control', cacheControlFor(prefix));
    if (!headers.has('content-type')) headers.set('content-type', 'application/octet-stream');
    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
  }

  // Mengunggah: PUT /api/files/<awalan>/<path>, isinya badan permintaan apa adanya.
  // Tidak memakai multipart supaya tidak ada yang perlu diurai di Worker.
  if (request.method === 'PUT') {
    const key = decodeURIComponent(url.pathname.slice('/api/files/'.length));
    const { prefix, rest } = splitKey(key);
    if (!PREFIXES.has(prefix) || !isSafePath(key)) {
      return json({ error: 'invalid_path', message: 'Lokasi berkas tidak valid.' }, 400);
    }

    const caller = await callerRole(env, request);
    if (!canWrite(prefix, rest, caller)) {
      return json({ error: 'forbidden', message: 'Tidak berhak mengunggah ke lokasi ini.' }, 403);
    }

    const contentType = (request.headers.get('content-type') || '').split(';')[0].trim();
    if (!ALLOWED_TYPES[prefix].has(contentType)) {
      return json({ error: 'unsupported_type', message: `Tipe berkas ${contentType || 'tidak dikenal'} tidak diizinkan.` }, 415);
    }

    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_SIZE[prefix]) {
      return json({ error: 'too_large', message: 'Ukuran berkas melebihi batas.' }, 413);
    }

    // Badan permintaan dibaca utuh agar ukurannya bisa dipastikan, bukan sekadar dipercaya
    // dari header yang dikirim klien.
    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_SIZE[prefix]) {
      return json({ error: 'too_large', message: 'Ukuran berkas melebihi batas.' }, 413);
    }

    await env.FILES.put(key, body, { httpMetadata: { contentType } });
    return json({ path: key, url: `/api/files/${key}`, size: body.byteLength });
  }

  if (request.method === 'DELETE') {
    const key = decodeURIComponent(url.pathname.slice('/api/files/'.length));
    const { prefix, rest } = splitKey(key);
    if (!PREFIXES.has(prefix) || !isSafePath(key)) {
      return json({ error: 'invalid_path', message: 'Lokasi berkas tidak valid.' }, 400);
    }

    const caller = await callerRole(env, request);
    if (!canWrite(prefix, rest, caller)) {
      return json({ error: 'forbidden', message: 'Tidak berhak menghapus berkas ini.' }, 403);
    }

    await env.FILES.delete(key);
    return json({ deleted: true, path: key });
  }

  return json({ error: 'method_not_allowed' }, 405);
};
