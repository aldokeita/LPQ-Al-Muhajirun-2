// Menguji lapisan otorisasi Worker terhadap data produksi yang sudah dimuat ke SQLite.
//
// Kasus ujinya memakai baris nyata: guru yang benar-benar memegang kelas, santri yang
// benar-benar terdaftar di kelas itu, dan pasangan yang sengaja tidak berhubungan.
// Otorisasi yang salah tidak akan ketahuan dari data karangan.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-worker-authorization.mjs <schema.sql> <data.sql>

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { createAuthorizer, AuthorizationError } from '../worker/auth/authorize.js';

const [, , schemaPath, dataPath] = process.argv;
if (!schemaPath || !dataPath) {
  console.error('Pemakaian: node --experimental-sqlite scripts/test-worker-authorization.mjs <schema.sql> <data.sql>');
  process.exit(1);
}

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync(schemaPath, 'utf8'));
sqlite.exec(fs.readFileSync(dataPath, 'utf8'));

// Tiruan antarmuka D1 secukupnya untuk dipakai predikat.
const db = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    return {
      bind(...params) {
        return {
          first: async () => statement.get(...params) ?? null,
          all: async () => ({ results: statement.all(...params) }),
        };
      },
      first: async () => statement.get() ?? null,
    };
  },
};

const query = (sql, ...params) => sqlite.prepare(sql).all(...params);
const one = (sql, ...params) => sqlite.prepare(sql).get(...params);

// --- Memilih aktor nyata dari data -----------------------------------------------------

const admin = one(`select id from user_profiles where role = 'admin' and status = 'active' limit 1`);
const guruRow = one(`
  select up.id as guru_id, c.id as class_id
    from user_profiles up
    join classes c on c.id_guru = up.id and c.deleted_at is null
   where up.role = 'guru' and up.status = 'active'
     and exists (select 1 from class_memberships cm where cm.class_id = c.id and cm.status = 'active')
   limit 1`);
const santriInClass = guruRow
  ? one(`select santri_id from class_memberships where class_id = ? and status = 'active' limit 1`, guruRow.class_id)
  : null;
const santriElsewhere = guruRow
  ? one(`select cm.santri_id
           from class_memberships cm
           join classes c on c.id = cm.class_id
          where cm.status = 'active' and c.id_guru is not ?
            and cm.santri_id not in (select santri_id from class_memberships where class_id = ?)
          limit 1`, guruRow.guru_id, guruRow.class_id)
  : null;
const santriUser = one(`select id from user_profiles where role = 'santri' and status = 'active' limit 1`);

console.log('Aktor yang dipakai:');
console.log(`  admin            : ${admin?.id ?? 'TIDAK ADA'}`);
console.log(`  guru             : ${guruRow?.guru_id ?? 'TIDAK ADA'} (kelas ${guruRow?.class_id ?? '-'})`);
console.log(`  santri di kelas  : ${santriInClass?.santri_id ?? 'TIDAK ADA'}`);
console.log(`  santri kelas lain: ${santriElsewhere?.santri_id ?? 'TIDAK ADA'}`);
console.log(`  akun santri      : ${santriUser?.id ?? 'TIDAK ADA'}`);
console.log('');

// --- Kasus uji --------------------------------------------------------------------------

let passed = 0;
let failed = 0;

const check = async (label, actual, expected) => {
  const ok = actual === expected;
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${label} -> ${actual ? 'boleh' : 'ditolak'} (harus ${expected ? 'boleh' : 'ditolak'})`);
};

const run = async () => {
  if (admin) {
    console.log('admin:');
    const auth = createAuthorizer(db, admin.id);
    await check('baca santri mana pun', await auth.can('santri', 'select', { id: santriElsewhere?.santri_id }), true);
    await check('baca payments', await auth.can('payments', 'select', {}), true);
    await check('hapus santri', await auth.can('santri', 'delete', { id: santriInClass?.santri_id }), true);
    console.log('');
  }

  if (guruRow && santriInClass) {
    console.log('guru:');
    const auth = createAuthorizer(db, guruRow.guru_id);
    await check('baca santri di kelasnya', await auth.can('santri', 'select', { id: santriInClass.santri_id }), true);
    await check('catat nilai santri di kelasnya', await auth.can('santri_juz_scores', 'insert', { santri_id: santriInClass.santri_id }), true);
    await check('baca absensi kelasnya', await auth.can('attendance', 'select', { class_id: guruRow.class_id }), true);
    await check('baca payments', await auth.can('payments', 'select', {}), false);
    await check('hapus santri', await auth.can('santri', 'delete', { id: santriInClass.santri_id }), false);
    if (santriElsewhere) {
      await check('baca santri kelas lain', await auth.can('santri', 'select', { id: santriElsewhere.santri_id }), false);
      await check('catat nilai santri kelas lain', await auth.can('santri_juz_scores', 'insert', { santri_id: santriElsewhere.santri_id }), false);
    }
    console.log('');
  }

  if (santriUser) {
    console.log('santri:');
    const auth = createAuthorizer(db, santriUser.id);
    await check('baca riwayat jilid sendiri', await auth.can('jilid_history', 'select', { santri_id: santriUser.id }), true);
    if (santriElsewhere && santriElsewhere.santri_id !== santriUser.id) {
      await check('baca riwayat jilid orang lain', await auth.can('jilid_history', 'select', { santri_id: santriElsewhere.santri_id }), false);
      await check('baca data santri lain', await auth.can('santri', 'select', { id: santriElsewhere.santri_id }), false);
    }
    await check('baca payments', await auth.can('payments', 'select', {}), false);
    await check('baca kalender akademik', await auth.can('academic_calendar', 'select', {}), true);
    console.log('');
  }

  console.log('tanpa login:');
  const anon = createAuthorizer(db, null);
  await check('baca santri', await anon.can('santri', 'select', { id: santriInClass?.santri_id }), false);
  await check('baca payments', await anon.can('payments', 'select', {}), false);
  await check('baca kalender akademik lewat jalur terautentikasi', await anon.can('academic_calendar', 'select', {}), false);
  console.log(`  ${anon.publicRead('news') ? 'OK   ' : 'GAGAL'} filter publik news -> ${JSON.stringify(anon.publicRead('news'))}`);
  console.log(`  ${anon.allowsPublicInsert('feedbacks') ? 'OK   ' : 'GAGAL'} boleh kirim feedbacks tanpa login`);
  console.log(`  ${anon.publicRead('payments') === null ? 'OK   ' : 'GAGAL'} payments tidak punya jalur publik`);
  if (!anon.publicRead('news') || !anon.allowsPublicInsert('feedbacks') || anon.publicRead('payments') !== null) failed += 1;
  else passed += 3;
  console.log('');

  console.log('tabel internal:');
  for (const table of ['users', 'auth_login_aliases', 'auth_rate_limits']) {
    const auth = createAuthorizer(db, admin?.id ?? null);
    let blocked = false;
    try { await auth.can(table, 'select', {}); } catch (error) { blocked = error instanceof AuthorizationError; }
    if (blocked) passed += 1; else failed += 1;
    console.log(`  ${blocked ? 'OK   ' : 'GAGAL'} ${table} ditolak walau sebagai admin`);
  }
  console.log('');

  console.log(`lulus: ${passed}, gagal: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
