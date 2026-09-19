// Menguji kedua jalur login terhadap data produksi yang sudah dimuat ke SQLite.
//
// Password guru dan admin produksi tidak diketahui, jadi akun staf uji dibuat sendiri
// dengan password yang diketahui. Jalur santri diuji dengan akun santri sungguhan,
// karena kredensialnya memang nomor induk yang sudah ada di tabel.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-worker-login.mjs <schema.sql> <data.sql>

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { consumeRateLimit, loginSantri, loginStaff, sha256Hex } from '../worker/auth/login.js';
import { detectAlgorithm } from '../worker/auth/password.js';

const [, , schemaPath, dataPath] = process.argv;
if (!schemaPath || !dataPath) {
  console.error('Pemakaian: node --experimental-sqlite scripts/test-worker-login.mjs <schema.sql> <data.sql>');
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

let passed = 0;
let failed = 0;
const check = (label, actual, expected = true) => {
  const ok = actual === expected;
  if (ok) passed += 1; else failed += 1;
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${label}${ok ? '' : ` (dapat ${JSON.stringify(actual)}, harus ${JSON.stringify(expected)})`}`);
};

const run = async () => {
  const santri = sqlite.prepare(`
    select s.id, s.nama_panggilan, s.nomor_induk_qiroati
      from santri s
      join user_profiles up on up.id = s.id
     where up.role = 'santri' and up.status = 'active'
       and s.nomor_induk_qiroati is not null and s.nomor_induk_qiroati <> ''
       and s.nama_panggilan is not null and s.nama_panggilan <> ''
     limit 1`).get();
  const otherSantri = sqlite.prepare(`
    select nomor_induk_qiroati from santri
     where nomor_induk_qiroati is not null and nomor_induk_qiroati <> '' and id <> ?
     limit 1`).get(santri?.id);

  console.log('login santri (nama panggilan + nomor induk):');
  if (santri) {
    check('nama panggilan + nomor induk benar', (await loginSantri(db, { identifier: santri.nama_panggilan, nomorInduk: santri.nomor_induk_qiroati })).ok, true);
    check('nomor induk sebagai identitas sekaligus sandi', (await loginSantri(db, { identifier: santri.nomor_induk_qiroati, nomorInduk: santri.nomor_induk_qiroati })).ok, true);
    check('nama panggilan beda huruf besar kecil', (await loginSantri(db, { identifier: santri.nama_panggilan.toUpperCase(), nomorInduk: santri.nomor_induk_qiroati })).ok, true);
    if (otherSantri) {
      check('nomor induk milik orang lain ditolak', (await loginSantri(db, { identifier: santri.nama_panggilan, nomorInduk: otherSantri.nomor_induk_qiroati })).ok, false);
    }
    check('nomor induk kosong ditolak', (await loginSantri(db, { identifier: santri.nama_panggilan, nomorInduk: '' })).ok, false);
    check('nomor induk berspasi ditolak', (await loginSantri(db, { identifier: santri.nama_panggilan, nomorInduk: '12 34' })).ok, false);
    check('nama panggilan tak dikenal ditolak', (await loginSantri(db, { identifier: 'tidak-ada-nama-ini', nomorInduk: santri.nomor_induk_qiroati })).ok, false);
  } else {
    console.log('  (tidak ada santri yang memenuhi syarat uji)');
  }
  console.log('');

  console.log('login staf (email + password):');
  const staffId = crypto.randomUUID();
  const PASSWORD = 'Guru#Qiroati2026';
  sqlite.prepare('insert into users (id, email, encrypted_password, password_algorithm) values (?, ?, ?, ?)')
    .run(staffId, 'guru.uji@contoh.test', bcrypt.hashSync(PASSWORD, 10), 'bcrypt');
  sqlite.prepare("insert into user_profiles (id, role, status) values (?, 'guru', 'active')").run(staffId);

  const first = await loginStaff(db, { email: 'guru.uji@contoh.test', password: PASSWORD });
  check('password benar diterima', first.ok, true);
  check('akun dipindahkan ke pbkdf2', first.rehashed, true);
  const storedAfter = sqlite.prepare('select encrypted_password, password_algorithm from users where id = ?').get(staffId);
  check('hash tersimpan kini pbkdf2', detectAlgorithm(storedAfter.encrypted_password) === 'pbkdf2');
  const second = await loginStaff(db, { email: 'guru.uji@contoh.test', password: PASSWORD });
  check('login kedua tetap berhasil', second.ok, true);
  check('login kedua tidak rehash lagi', second.rehashed, false);
  check('password salah ditolak', (await loginStaff(db, { email: 'guru.uji@contoh.test', password: 'salah' })).ok, false);
  check('email tak dikenal ditolak', (await loginStaff(db, { email: 'bukan@contoh.test', password: PASSWORD })).ok, false);
  check('email beda huruf besar kecil diterima', (await loginStaff(db, { email: 'Guru.Uji@Contoh.Test', password: PASSWORD })).ok, true);

  // Santri tidak boleh bisa lewat jalur staf sekalipun nomor induknya benar.
  if (santri) {
    check('santri ditolak di jalur staf', (await loginStaff(db, { email: 'guru.uji@contoh.test', password: santri.nomor_induk_qiroati })).ok, false);
  }
  console.log('');

  console.log('pembatasan percobaan:');
  const ipHash = await sha256Hex('203.0.113.9');
  const aliasHash = await sha256Hex('percobaan');
  const results = [];
  for (let i = 0; i < 7; i += 1) {
    results.push(await consumeRateLimit(db, { purpose: 'login', ipHash, aliasHash }));
  }
  check('lima percobaan pertama diizinkan', results.slice(0, 5).every((r) => r.allowed), true);
  check('percobaan keenam diblokir', results[5].allowed, false);
  check('blokir punya waktu berakhir', typeof results[5].blockedUntil === 'string', true);
  check('tetap terblokir setelahnya', results[6].allowed, false);
  const lainHash = await sha256Hex('alias-lain');
  check('alias berbeda tidak ikut terblokir', (await consumeRateLimit(db, { purpose: 'login', ipHash, aliasHash: lainHash })).allowed, true);
  console.log('');

  console.log(`lulus: ${passed}, gagal: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
