// Menguji penyimpanan berkas R2 lewat titik masuk Worker.
//
// Yang paling penting di sini bukan berkasnya tersimpan, melainkan siapa yang boleh
// menyentuhnya. Satu bucket menampung tiga wilayah dengan aturan berbeda, jadi path yang
// bisa keluar dari wilayahnya sendiri akan menembus aturan wilayah lain.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-worker-files.mjs <schema.sql> <data.sql>

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import worker from '../worker/index.js';
import { issueSession } from '../worker/auth/session.js';

const [, , schemaPath, dataPath] = process.argv;
if (!schemaPath || !dataPath) {
  console.error('Pemakaian: node --experimental-sqlite scripts/test-worker-files.mjs <schema.sql> <data.sql>');
  process.exit(1);
}

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync(schemaPath, 'utf8'));
sqlite.exec(fs.readFileSync(dataPath, 'utf8'));

const db = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    return {
      bind(...params) {
        return {
          first: async () => statement.get(...params) ?? null,
          all: async () => ({ results: statement.all(...params) }),
          run: async () => statement.run(...params),
        };
      },
    };
  },
};

// R2 tiruan secukupnya: yang dipakai rute hanya get, put, dan delete.
const buatR2 = () => {
  const isi = new Map();
  return {
    isi,
    async put(key, body, options) {
      isi.set(key, { body: new Uint8Array(body), contentType: options?.httpMetadata?.contentType ?? null });
    },
    async get(key) {
      const item = isi.get(key);
      if (!item) return null;
      const etag = `"${key.length}-${item.body.length}"`;
      return {
        body: item.body,
        httpEtag: etag,
        writeHttpMetadata(headers) {
          if (item.contentType) headers.set('content-type', item.contentType);
        },
      };
    },
    async delete(key) { isi.delete(key); },
  };
};

const SECRET = 'rahasia-uji-berkas';
let passed = 0;
let failed = 0;
const check = (label, actual, expected = true) => {
  const ok = actual === expected;
  if (ok) passed += 1; else failed += 1;
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${label}${ok ? '' : ` (dapat ${JSON.stringify(actual)}, harus ${JSON.stringify(expected)})`}`);
};

const run = async () => {
  const FILES = buatR2();
  const env = { DB: db, FILES, SESSION_SECRET: SECRET };

  const admin = sqlite.prepare("select id from user_profiles where role = 'admin' and status = 'active' limit 1").get();
  const santri = sqlite.prepare("select id from user_profiles where role = 'santri' and status = 'active' limit 1").get();
  const santriLain = sqlite.prepare("select id from user_profiles where role = 'santri' and status = 'active' and id <> ? limit 1").get(santri.id);

  const cookieUntuk = async (userId) => {
    const { token } = await issueSession(SECRET, { userId });
    return `session=${token}`;
  };
  const cookieAdmin = await cookieUntuk(admin.id);
  const cookieSantri = await cookieUntuk(santri.id);

  const call = (pathname, { method = 'GET', cookie = null, body = null, type = null, headers = {} } = {}) =>
    worker.fetch(new Request(`https://contoh.test${pathname}`, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(type ? { 'content-type': type } : {}),
        ...headers,
      },
      body,
    }), env);

  const gambar = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]);

  console.log('mengunggah:');
  const pathSantri = `avatars/santri/${santri.id}/profile.webp`;
  const unggahAdmin = await call(`/${''}api/files/${pathSantri}`, {
    method: 'PUT', cookie: cookieAdmin, body: gambar, type: 'image/webp',
  });
  check('admin boleh mengunggah avatar siapa pun', unggahAdmin.status, 200);
  check('berkasnya benar tersimpan', FILES.isi.has(pathSantri), true);

  const pathSendiri = `avatars/santri/${santri.id}/profile.webp`;
  check('santri boleh mengganti fotonya sendiri',
    (await call(`/api/files/${pathSendiri}`, { method: 'PUT', cookie: cookieSantri, body: gambar, type: 'image/webp' })).status, 200);

  if (santriLain) {
    const pathOrangLain = `avatars/santri/${santriLain.id}/profile.webp`;
    check('santri tidak boleh mengganti foto orang lain',
      (await call(`/api/files/${pathOrangLain}`, { method: 'PUT', cookie: cookieSantri, body: gambar, type: 'image/webp' })).status, 403);
  }

  check('tanpa sesi tidak boleh mengunggah',
    (await call(`/api/files/${pathSantri}`, { method: 'PUT', body: gambar, type: 'image/webp' })).status, 403);
  check('santri tidak boleh mengunggah aset situs',
    (await call('/api/files/website-assets/umum/x.webp', { method: 'PUT', cookie: cookieSantri, body: gambar, type: 'image/webp' })).status, 403);
  check('admin boleh mengunggah aset situs',
    (await call('/api/files/website-assets/umum/x.webp', { method: 'PUT', cookie: cookieAdmin, body: gambar, type: 'image/webp' })).status, 200);
  console.log('');

  console.log('tipe dan ukuran:');
  check('tipe yang tidak diizinkan ditolak',
    (await call(`/api/files/${pathSantri}`, { method: 'PUT', cookie: cookieAdmin, body: gambar, type: 'application/zip' })).status, 415);
  check('audio ditolak di wilayah avatar',
    (await call(`/api/files/${pathSantri}`, { method: 'PUT', cookie: cookieAdmin, body: gambar, type: 'audio/mpeg' })).status, 415);
  check('audio diterima di wilayah musik',
    (await call('/api/files/music-files/playlist/a.mp3', { method: 'PUT', cookie: cookieAdmin, body: gambar, type: 'audio/mpeg' })).status, 200);
  // Ukuran diperiksa dari isinya, bukan dari header yang dikirim klien.
  const terlaluBesar = new Uint8Array(3 * 1024 * 1024);
  check('berkas melebihi batas ditolak',
    (await call(`/api/files/${pathSantri}`, { method: 'PUT', cookie: cookieAdmin, body: terlaluBesar, type: 'image/webp' })).status, 413);
  console.log('');

  console.log('membaca:');
  const bacaSantri = await call(`/api/files/${pathSantri}`, { cookie: cookieSantri });
  check('yang sudah masuk boleh melihat avatar', bacaSantri.status, 200);
  check('tipe isinya ikut', bacaSantri.headers.get('content-type'), 'image/webp');
  check('avatar tidak boleh disimpan perantara',
    bacaSantri.headers.get('cache-control'), 'private, max-age=604800');

  // Inti pemindahan ini: alamatnya tetap, jadi peramban boleh menjawab dari cache-nya
  // sendiri alih-alih mengunduh ulang.
  const etag = bacaSantri.headers.get('etag');
  check('ada etag', typeof etag, 'string');
  const ulang = await call(`/api/files/${pathSantri}`, { cookie: cookieSantri, headers: { 'if-none-match': etag } });
  check('muat ulang menjawab 304, bukan mengirim ulang', ulang.status, 304);

  check('tanpa sesi tidak boleh melihat avatar',
    (await call(`/api/files/${pathSantri}`)).status, 401);
  const asetPublik = await call('/api/files/website-assets/umum/x.webp');
  check('aset situs terbuka tanpa sesi', asetPublik.status, 200);
  check('aset situs boleh disimpan perantara',
    asetPublik.headers.get('cache-control'), 'public, max-age=604800');
  check('musik terbuka tanpa sesi',
    (await call('/api/files/music-files/playlist/a.mp3')).status, 200);
  check('berkas tak dikenal memulangkan 404',
    (await call('/api/files/avatars/santri/tidak-ada/profile.webp', { cookie: cookieSantri })).status, 404);
  console.log('');

  console.log('path yang mencoba keluar wilayahnya:');
  // Tanpa penjagaan, path seperti ini menulis ke wilayah yang aturannya berbeda.
  for (const jahat of [
    'avatars/../website-assets/curang.webp',
    'avatars/santri/../../website-assets/curang.webp',
    'avatars//santri/x/profile.webp',
    '/etc/passwd',
    'wilayah-asing/x.webp',
  ]) {
    const respons = await call(`/api/files/${jahat}`, { method: 'PUT', cookie: cookieSantri, body: gambar, type: 'image/webp' });
    check(`ditolak: ${jahat}`, respons.status === 400 || respons.status === 403 || respons.status === 404, true);
  }
  check('tidak ada berkas curang yang tertulis',
    [...FILES.isi.keys()].some((k) => k.includes('curang') || k.includes('..')), false);
  console.log('');

  console.log('menghapus:');
  check('santri tidak boleh menghapus aset situs',
    (await call('/api/files/website-assets/umum/x.webp', { method: 'DELETE', cookie: cookieSantri })).status, 403);
  check('admin boleh menghapus', (await call('/api/files/website-assets/umum/x.webp', { method: 'DELETE', cookie: cookieAdmin })).status, 200);
  check('berkasnya benar terhapus', FILES.isi.has('website-assets/umum/x.webp'), false);
  console.log('');

  console.log('tanpa binding R2:');
  const tanpaBinding = await worker.fetch(
    new Request('https://contoh.test/api/files/website-assets/umum/x.webp'),
    { DB: db, SESSION_SECRET: SECRET },
  );
  check('menjawab 503 dengan sebabnya, bukan 500', tanpaBinding.status, 503);
  check('menyebut binding yang hilang', (await tanpaBinding.json()).error, 'storage_unavailable');
  console.log('');

  console.log(`lulus: ${passed}, gagal: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
