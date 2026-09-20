// Menguji titik masuk Worker, khususnya perilakunya ketika SESSION_SECRET belum diset.
//
// Ini nilai konfigurasi paling menentukan di seluruh sistem: tanpa dia tidak ada sesi yang
// bisa diterbitkan maupun diperiksa, jadi tidak ada seorang pun yang bisa masuk. Yang
// dijaga di sini ada dua. Pertama, kegagalannya harus tetap aman — tidak boleh ada token
// yang lolos diperiksa. Kedua, kegagalannya harus bisa dibaca: sebelum ada pemeriksaan
// ini, satu-satunya gejalanya adalah 500 kosong saat mencoba login.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-worker-entry.mjs <schema.sql>

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import worker from '../worker/index.js';
import { issueSession, verifySession } from '../worker/auth/session.js';

const [, , schemaPath] = process.argv;
if (!schemaPath) {
  console.error('Pemakaian: node --experimental-sqlite scripts/test-worker-entry.mjs <schema.sql>');
  process.exit(1);
}

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync(schemaPath, 'utf8'));

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

let passed = 0;
let failed = 0;
const check = (label, actual, expected = true) => {
  const ok = actual === expected;
  if (ok) passed += 1; else failed += 1;
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${label}${ok ? '' : ` (dapat ${JSON.stringify(actual)}, harus ${JSON.stringify(expected)})`}`);
};

const call = (pathname, env, init = {}) =>
  worker.fetch(new Request(`https://contoh.test${pathname}`, init), env);

const run = async () => {
  const dengan = { DB: db, SESSION_SECRET: 'rahasia-uji-yang-panjang-sekali' };
  const tanpa = { DB: db };

  console.log('rahasia sesi tersedia:');
  const sehat = await call('/api/health', dengan);
  check('health memulangkan 200', sehat.status, 200);
  const isiSehat = await sehat.json();
  check('melaporkan rahasianya terpasang', isiSehat.session_secret, 'configured');
  check('tidak membocorkan nilainya',
    JSON.stringify(isiSehat).includes(dengan.SESSION_SECRET), false);
  check('database terjangkau', isiSehat.database, 'reachable');
  console.log('');

  console.log('rahasia sesi hilang:');
  // Endpoint kesehatan harus tetap menjawab justru dalam keadaan ini; kalau ia ikut
  // tertahan, tidak ada cara memeriksa sebabnya selain menebak.
  const sakit = await call('/api/health', tanpa);
  check('health tetap menjawab, bukan ikut mati', sakit.status, 503);
  const isiSakit = await sakit.json();
  check('menyebut rahasianya hilang', isiSakit.session_secret, 'missing');

  for (const [nama, pathname, init] of [
    ['login staf', '/api/auth/login/staff', { method: 'POST', body: '{}' }],
    ['pembacaan data', '/api/data/query', { method: 'POST', body: '{}' }],
    ['pengelolaan akun', '/api/manage-user', { method: 'POST', body: '{}' }],
  ]) {
    const respons = await call(pathname, tanpa, init);
    check(`${nama} ditolak dengan 503, bukan 500`, respons.status, 503);
    check(`${nama} menyebutkan sebabnya`, (await respons.json()).error, 'session_secret_missing');
  }
  console.log('');

  console.log('kegagalannya aman:');
  // Token yang sah pun tidak boleh lolos ketika rahasianya hilang, dan tidak boleh ada
  // rahasia kosong yang membuat tanda tangan bisa ditebak.
  const { token } = await issueSession(dengan.SESSION_SECRET, { userId: 'siapa-pun' });
  check('token sah terbaca dengan rahasianya', (await verifySession(dengan.SESSION_SECRET, token))?.sub, 'siapa-pun');
  check('token sah ditolak tanpa rahasia', await verifySession(undefined, token), null);
  check('token sah ditolak dengan rahasia kosong', await verifySession('', token), null);
  check('token sah ditolak dengan rahasia lain', await verifySession('rahasia-yang-berbeda', token), null);
  console.log('');

  console.log(`lulus: ${passed}, gagal: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
