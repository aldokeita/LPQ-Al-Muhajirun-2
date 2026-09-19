// Menguji verifikasi password, jalur rehash ke PBKDF2, dan penerbitan sesi.
//
// Hash bcrypt di sini dibuat sendiri dengan password yang diketahui. Hash produksi tidak
// pernah dipakai untuk pengujian.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-worker-auth-password.mjs <schema.sql>

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import {
  PBKDF2_ITERATIONS, detectAlgorithm, hashPbkdf2, rehashToPbkdf2, verifyPassword,
} from '../worker/auth/password.js';
import {
  issueSession, readSessionCookie, sessionCookie, verifySession,
} from '../worker/auth/session.js';

const schemaPath = process.argv[2];
if (!schemaPath) {
  console.error('Pemakaian: node --experimental-sqlite scripts/test-worker-auth-password.mjs <schema.sql>');
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
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${label}${ok ? '' : ` (dapat ${actual}, harus ${expected})`}`);
};

const SECRET = 'rahasia-uji-yang-hanya-dipakai-di-tes';
const PASSWORD = 'Qiroati#2026';

const run = async () => {
  console.log('deteksi algoritma:');
  const legacyHash = bcrypt.hashSync(PASSWORD, 10);
  check('hash bcrypt terdeteksi', detectAlgorithm(legacyHash) === 'bcrypt');
  check('hash pbkdf2 terdeteksi', detectAlgorithm(await hashPbkdf2(PASSWORD)) === 'pbkdf2');
  check('nilai kosong tidak dikenali', detectAlgorithm('') === null);
  console.log('');

  console.log('verifikasi bcrypt (akun warisan):');
  const t1 = Date.now();
  const legacy = await verifyPassword(PASSWORD, legacyHash);
  const bcryptMs = Date.now() - t1;
  check('password benar diterima', legacy.valid);
  check('ditandai perlu rehash', legacy.needsRehash);
  check('password salah ditolak', (await verifyPassword('salah', legacyHash)).valid, false);
  console.log(`  waktu verifikasi bcrypt: ${bcryptMs} ms`);
  console.log('');

  console.log('verifikasi pbkdf2:');
  const t2 = Date.now();
  const modernHash = await hashPbkdf2(PASSWORD);
  const hashMs = Date.now() - t2;
  const t3 = Date.now();
  const modern = await verifyPassword(PASSWORD, modernHash);
  const verifyMs = Date.now() - t3;
  check('password benar diterima', modern.valid);
  check('tidak perlu rehash', modern.needsRehash, false);
  check('password salah ditolak', (await verifyPassword('salah', modernHash)).valid, false);
  check('hash rusak ditolak', (await verifyPassword(PASSWORD, 'pbkdf2$sha256$x$y$z')).valid, false);
  console.log(`  waktu hash ${PBKDF2_ITERATIONS} iterasi: ${hashMs} ms, verifikasi: ${verifyMs} ms`);
  console.log('');

  console.log('jalur rehash tersimpan ke database:');
  const userId = crypto.randomUUID();
  sqlite.prepare('insert into users (id, email, encrypted_password, password_algorithm) values (?, ?, ?, ?)')
    .run(userId, 'uji@contoh.test', legacyHash, 'bcrypt');
  await rehashToPbkdf2(db, userId, PASSWORD);
  const stored = sqlite.prepare('select encrypted_password, password_algorithm from users where id = ?').get(userId);
  check('algoritma tersimpan menjadi pbkdf2', stored.password_algorithm === 'pbkdf2');
  check('hash tersimpan berformat pbkdf2', detectAlgorithm(stored.encrypted_password) === 'pbkdf2');
  check('password lama tetap berlaku setelah rehash', (await verifyPassword(PASSWORD, stored.encrypted_password)).valid);
  check('bcrypt tidak dipanggil lagi', (await verifyPassword(PASSWORD, stored.encrypted_password)).needsRehash, false);
  console.log('');

  console.log('sesi:');
  const { token, expiresAt } = await issueSession(SECRET, { userId });
  const payload = await verifySession(SECRET, token);
  check('token terbit dan terverifikasi', payload?.sub === userId);
  check('tanda tangan salah ditolak', (await verifySession('rahasia-lain', token)) === null);
  check('token diubah ditolak', (await verifySession(SECRET, `${token.slice(0, -2)}xy`)) === null);
  check('token sampah ditolak', (await verifySession(SECRET, 'bukan-token')) === null);
  const expired = await issueSession(SECRET, { userId, ttlSeconds: -10 });
  check('token kedaluwarsa ditolak', (await verifySession(SECRET, expired.token)) === null);
  check('peran tidak disimpan di token', payload && !('role' in payload));
  console.log(`  berlaku sampai ${expiresAt}`);
  console.log('');

  console.log('cookie:');
  const cookie = sessionCookie(token);
  check('HttpOnly disetel', cookie.includes('HttpOnly'));
  check('Secure disetel', cookie.includes('Secure'));
  check('SameSite=Lax disetel', cookie.includes('SameSite=Lax'));
  const request = new Request('https://contoh.test', { headers: { cookie: `lain=1; session=${token}` } });
  check('cookie terbaca kembali', readSessionCookie(request) === token);
  check('tanpa cookie memulangkan null', readSessionCookie(new Request('https://contoh.test')) === null);
  console.log('');

  console.log(`lulus: ${passed}, gagal: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
