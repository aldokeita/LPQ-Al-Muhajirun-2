// Menguji pengelolaan akun terhadap data produksi.
//
// Versi Supabase membuat akun auth lebih dulu lalu menghapusnya kembali bila langkah
// berikutnya gagal. Di sini seluruh langkah dikirim sebagai satu batch, jadi yang perlu
// dibuktikan adalah tidak ada sisa baris ketika pembuatan gagal di tengah.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-worker-manage-user.mjs <schema.sql> <data.sql>

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { handleManageUser, handleResetPassword } from '../worker/routes/manage-user.js';
import { verifyPassword } from '../worker/auth/password.js';
import { issueSession } from '../worker/auth/session.js';

const [, , schemaPath, dataPath] = process.argv;
if (!schemaPath || !dataPath) {
  console.error('Pemakaian: node --experimental-sqlite scripts/test-worker-manage-user.mjs <schema.sql> <data.sql>');
  process.exit(1);
}

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync(schemaPath, 'utf8'));
sqlite.exec(fs.readFileSync(dataPath, 'utf8'));

const makeStatement = (sql, params = []) => ({
  sql,
  params,
  bind(...bound) { return makeStatement(sql, bound); },
  first: async () => sqlite.prepare(sql).get(...params) ?? null,
  all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
  run: async () => sqlite.prepare(sql).run(...params),
});

const db = {
  prepare: (sql) => makeStatement(sql),
  batch: async (statements) => {
    sqlite.exec('begin');
    try {
      for (const s of statements) sqlite.prepare(s.sql).run(...s.params);
      sqlite.exec('commit');
    } catch (error) {
      sqlite.exec('rollback');
      throw error;
    }
    return statements.map(() => ({ success: true }));
  },
};

const SECRET = 'rahasia-uji-manage-user';
const env = { DB: db, SESSION_SECRET: SECRET };

let passed = 0;
let failed = 0;
const check = (label, actual, expected = true) => {
  const ok = actual === expected;
  if (ok) passed += 1; else failed += 1;
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${label}${ok ? '' : ` (dapat ${JSON.stringify(actual)}, harus ${JSON.stringify(expected)})`}`);
};

const call = async (body, cookie) => {
  const request = new Request('https://contoh.test/api/manage-user', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  const response = await handleManageUser(request, env, new URL(request.url));
  return { status: response.status, body: await response.json() };
};

const run = async () => {
  const admin = sqlite.prepare("select id from user_profiles where role = 'admin' and status = 'active' limit 1").get();
  const guru = sqlite.prepare("select id from user_profiles where role = 'guru' and status = 'active' limit 1").get();
  const adminCookie = `session=${(await issueSession(SECRET, { userId: admin.id })).token}`;
  const guruCookie = `session=${(await issueSession(SECRET, { userId: guru.id })).token}`;

  console.log('kendali akses:');
  check('tanpa sesi ditolak', (await call({ action: 'create', role: 'santri' })).status, 401);
  check('guru ditolak', (await call({ action: 'create', role: 'santri' }, guruCookie)).status, 403);
  check('aksi tak dikenal ditolak', (await call({ action: 'meledak', role: 'santri' }, adminCookie)).status, 400);
  check('role tak dikenal ditolak', (await call({ action: 'create', role: 'alien' }, adminCookie)).status, 400);
  console.log('');

  console.log('membuat santri:');
  const nomorInduk = `UJI-${Date.now()}`;
  const created = await call({
    action: 'create',
    role: 'santri',
    initial_password: 'Rahasia#2026',
    profile: { nama_lengkap: 'Santri Uji Baru', nomor_induk_qiroati: nomorInduk, kategori: 'TPQ', berkas_foto: true },
  }, adminCookie);
  check('dibuat dengan status 201', created.status, 201);
  const newId = created.body?.data?.user_id;
  check('memulangkan user_id', typeof newId, 'string');

  const userRow = sqlite.prepare('select * from users where id = ?').get(newId);
  check('baris users dibuat', Boolean(userRow), true);
  check('password disimpan sebagai pbkdf2', userRow.password_algorithm, 'pbkdf2');
  check('email internal dipakai untuk santri', userRow.email.startsWith('santri+'), true);
  check('profil dibuat', sqlite.prepare('select role from user_profiles where id = ?').get(newId).role, 'santri');
  const santriRow = sqlite.prepare('select * from santri where id = ?').get(newId);
  check('kategori TPQ dinormalkan menjadi Anak', santriRow.kategori, 'Anak');
  check('boolean disimpan sebagai angka', santriRow.berkas_foto, 1);
  check('alias login dibuat',
    sqlite.prepare('select normalized_alias from auth_login_aliases where auth_user_id = ?').get(newId).normalized_alias,
    nomorInduk);
  console.log('');

  console.log('nomor induk ganda:');
  const duplicate = await call({
    action: 'create', role: 'santri', initial_password: 'Rahasia#2026',
    profile: { nama_lengkap: 'Kembar', nomor_induk_qiroati: nomorInduk, kategori: 'TPQ' },
  }, adminCookie);
  check('ditolak dengan 409', duplicate.status, 409);
  check('kode galat sesuai', duplicate.body?.error?.code, 'DUPLICATE_NOMOR_INDUK');
  console.log('');

  console.log('pembuatan yang gagal tidak meninggalkan sisa:');
  const before = sqlite.prepare('select count(*) c from users').get().c;
  const invalid = await call({
    action: 'create', role: 'santri', initial_password: 'Rahasia#2026',
    profile: { nama_lengkap: 'Kategori Salah', nomor_induk_qiroati: `X-${Date.now()}`, kategori: 'REMAJA' },
  }, adminCookie);
  check('kategori tidak sah ditolak', invalid.body?.error?.code, 'INVALID_SANTRI_CATEGORY');
  check('tidak ada baris users tersisa', sqlite.prepare('select count(*) c from users').get().c, before);
  console.log('');

  console.log('arsip dan pemulihan:');
  const archived = await call({ action: 'archive', role: 'santri', target_user_id: newId, reason: 'Pindah kota' }, adminCookie);
  check('arsip berhasil', archived.body?.data?.archived, true);
  const afterArchive = sqlite.prepare('select status, deleted_at, archive_reason, archived_by from santri where id = ?').get(newId);
  check('status menjadi Nonaktif', afterArchive.status, 'Nonaktif');
  check('deleted_at terisi', typeof afterArchive.deleted_at, 'string');
  check('alasan tersimpan', afterArchive.archive_reason, 'Pindah kota');
  check('pengarsip tercatat', afterArchive.archived_by, admin.id);
  check('profil menjadi inactive', sqlite.prepare('select status from user_profiles where id = ?').get(newId).status, 'inactive');
  check('alias dinonaktifkan', sqlite.prepare('select is_active from auth_login_aliases where auth_user_id = ?').get(newId).is_active, 0);
  check('akun diblokir', typeof sqlite.prepare('select banned_until from users where id = ?').get(newId).banned_until, 'string');

  const restored = await call({ action: 'restore', role: 'santri', target_user_id: newId }, adminCookie);
  check('pemulihan berhasil', restored.body?.data?.archived, false);
  const afterRestore = sqlite.prepare('select status, deleted_at, archive_reason from santri where id = ?').get(newId);
  check('status kembali Aktif', afterRestore.status, 'Aktif');
  check('deleted_at dikosongkan', afterRestore.deleted_at, null);
  check('alasan dikosongkan', afterRestore.archive_reason, null);
  check('blokir dicabut', sqlite.prepare('select banned_until from users where id = ?').get(newId).banned_until, null);
  check('alias diaktifkan kembali', sqlite.prepare('select is_active from auth_login_aliases where auth_user_id = ?').get(newId).is_active, 1);

  check('arsip guru ditolak', (await call({ action: 'archive', role: 'guru', target_user_id: newId }, adminCookie)).status, 400);
  console.log('');

  console.log('pembaruan santri:');
  const updated = await call({
    action: 'update', role: 'santri', target_user_id: newId,
    profile: { nama_lengkap: 'Santri Uji Diubah', no_hp_ortu: '0812000111', status: 'Nonaktif' },
  }, adminCookie);
  check('pembaruan berhasil', updated.body?.data?.updated, true);
  check('nama tersimpan', sqlite.prepare('select nama_lengkap from santri where id = ?').get(newId).nama_lengkap, 'Santri Uji Diubah');
  const profileAfter = sqlite.prepare('select display_name, phone, status from user_profiles where id = ?').get(newId);
  check('display_name ikut berubah', profileAfter.display_name, 'Santri Uji Diubah');
  check('telepon ikut berubah', profileAfter.phone, '0812000111');
  check('status Nonaktif menjadi inactive', profileAfter.status, 'inactive');
  console.log('');

  console.log('reset password oleh admin:');
  const resetCall = async (body, cookie) => {
    const request = new Request('https://contoh.test/api/reset-user-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    });
    const response = await handleResetPassword(request, env, new URL(request.url));
    return { status: response.status, body: await response.json() };
  };

  check('tanpa sesi ditolak', (await resetCall({ target_user_id: newId, new_password: 'RahasiaBaru1' })).status, 401);
  check('guru ditolak', (await resetCall({ target_user_id: newId, new_password: 'RahasiaBaru1' }, guruCookie)).status, 403);
  const lemah = await resetCall({ target_user_id: newId, new_password: 'pendek' }, adminCookie);
  check('password terlalu pendek ditolak', lemah.body?.error?.code, 'WEAK_PASSWORD');

  const reset = await resetCall({ target_user_id: newId, new_password: 'RahasiaBaru#2026' }, adminCookie);
  check('reset berhasil', reset.body?.data?.password_updated, true);
  const setelahReset = sqlite.prepare('select encrypted_password, password_algorithm from users where id = ?').get(newId);
  // Password baru selalu PBKDF2, jadi akun yang di-reset tidak menambah beban bcrypt.
  check('disimpan sebagai pbkdf2', setelahReset.password_algorithm, 'pbkdf2');
  check('password baru berlaku', (await verifyPassword('RahasiaBaru#2026', setelahReset.encrypted_password)).valid, true);
  check('password lama tidak berlaku lagi', (await verifyPassword('Rahasia#2026', setelahReset.encrypted_password)).valid, false);
  console.log('');

  console.log('penghapusan permanen:');
  check('hapus guru ditolak', (await call({ action: 'delete', role: 'guru', target_user_id: newId }, adminCookie)).status, 400);
  const deleted = await call({ action: 'delete', role: 'santri', target_user_id: newId }, adminCookie);
  check('penghapusan berhasil', deleted.body?.data?.deleted, true);
  check('baris users hilang', sqlite.prepare('select count(*) c from users where id = ?').get(newId).c, 0);
  check('santri ikut terhapus lewat cascade', sqlite.prepare('select count(*) c from santri where id = ?').get(newId).c, 0);
  check('profil ikut terhapus lewat cascade', sqlite.prepare('select count(*) c from user_profiles where id = ?').get(newId).c, 0);
  check('alias ikut terhapus lewat cascade', sqlite.prepare('select count(*) c from auth_login_aliases where auth_user_id = ?').get(newId).c, 0);
  console.log('');

  console.log(`lulus: ${passed}, gagal: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
