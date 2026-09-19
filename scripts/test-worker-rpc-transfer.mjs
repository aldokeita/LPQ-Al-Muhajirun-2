// Menguji RPC perpindahan kelas terhadap data produksi.
//
// Yang dijaga di sini: keanggotaan lama benar-benar ditutup, keanggotaan baru terbuka,
// mutasinya tercatat, dan santri tidak pernah berakhir dengan dua keanggotaan aktif.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-worker-rpc-transfer.mjs <schema.sql> <data.sql>

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { createAuthContext } from '../worker/auth/predicates.js';
import { RpcError } from '../worker/rpc/santri.js';
import {
  getGuruTransferClassOptions, moveSantriToClass, transferSantriToClassByGuru,
} from '../worker/rpc/class-transfer.js';

const [, , schemaPath, dataPath] = process.argv;
if (!schemaPath || !dataPath) {
  console.error('Pemakaian: node --experimental-sqlite scripts/test-worker-rpc-transfer.mjs <schema.sql> <data.sql>');
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

let passed = 0;
let failed = 0;
const check = (label, actual, expected = true) => {
  const ok = actual === expected;
  if (ok) passed += 1; else failed += 1;
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${label}${ok ? '' : ` (dapat ${JSON.stringify(actual)}, harus ${JSON.stringify(expected)})`}`);
};

const expectMessage = async (label, promise, message) => {
  try {
    await promise;
    check(label, 'tidak melempar', message);
  } catch (error) {
    check(label, error instanceof RpcError ? error.message : error.name, message);
  }
};

const activeMemberships = (santriId) =>
  sqlite.prepare("select count(*) c from class_memberships where santri_id = ? and status = 'active'").get(santriId).c;

const run = async () => {
  const admin = sqlite.prepare("select id from user_profiles where role = 'admin' and status = 'active' limit 1").get();
  const guru = sqlite.prepare(`
    select up.id as guru_id, c.id as class_id, c.kategori from user_profiles up
     join classes c on c.id_guru = up.id and c.deleted_at is null and c.is_active = 1
    where up.role = 'guru' and up.status = 'active'
      and exists (select 1 from class_memberships cm where cm.class_id = c.id and cm.status = 'active')
    limit 1`).get();
  const santri = sqlite.prepare(`
    select s.id, s.nama_lengkap, s.kategori, s.current_class_id from santri s
     join class_memberships cm on cm.santri_id = s.id and cm.status = 'active'
    where cm.class_id = ? and s.deleted_at is null and lower(trim(s.status)) in ('aktif','active')
    limit 1`).get(guru.class_id);
  const sameCategoryClass = sqlite.prepare(`
    select id, nama_kelas from classes
     where is_active = 1 and deleted_at is null and id <> ?
       and (case when upper(trim(coalesce(kategori,''))) = 'TPQ' then 'ANAK' else upper(trim(coalesce(kategori,''))) end)
         = (case when upper(trim(coalesce(?,''))) = 'TPQ' then 'ANAK' else upper(trim(coalesce(?,''))) end)
     limit 1`).get(guru.class_id, santri.kategori, santri.kategori);
  const otherCategoryClass = sqlite.prepare(`
    select id from classes
     where is_active = 1 and deleted_at is null
       and (case when upper(trim(coalesce(kategori,''))) = 'TPQ' then 'ANAK' else upper(trim(coalesce(kategori,''))) end)
         <> (case when upper(trim(coalesce(?,''))) = 'TPQ' then 'ANAK' else upper(trim(coalesce(?,''))) end)
     limit 1`).get(santri.kategori, santri.kategori);

  const adminCtx = createAuthContext(db, admin.id);
  const guruCtx = createAuthContext(db, guru.guru_id);
  const anonCtx = createAuthContext(db, null);

  console.log(`santri uji di kelas ${guru.class_id}, kelas tujuan sekategori: ${sameCategoryClass?.id ?? 'TIDAK ADA'}\n`);

  console.log('get_guru_transfer_class_options:');
  const options = await getGuruTransferClassOptions(db, guruCtx, { santriId: santri.id });
  check('memulangkan daftar kelas', options.length > 0, true);
  check('kelas saat ini ditandai', options.some((o) => o.is_current && o.class_id === guru.class_id), true);
  check('kelas saat ini tidak bisa dipilih', options.find((o) => o.class_id === guru.class_id).is_selectable, false);
  check('semua pilihan sekategori dengan santri', options.every((o) => {
    const norm = (v) => (String(v ?? '').trim().toUpperCase() === 'TPQ' ? 'ANAK' : String(v ?? '').trim().toUpperCase());
    return norm(o.category) === norm(santri.kategori);
  }), true);
  await expectMessage('admin ditolak', getGuruTransferClassOptions(db, adminCtx, { santriId: santri.id }),
    'Hanya guru pengampu yang dapat melihat pilihan transfer kelas.');
  await expectMessage('tanpa login ditolak', getGuruTransferClassOptions(db, anonCtx, { santriId: santri.id }),
    'Login diperlukan untuk melihat pilihan kelas.');
  console.log('');

  console.log('transfer_santri_to_class_by_guru:');
  await expectMessage('kelas tujuan sama ditolak',
    transferSantriToClassByGuru(db, guruCtx, { santriId: santri.id, toClassId: guru.class_id }),
    'Kelas tujuan harus berbeda dari kelas asal.');
  if (otherCategoryClass) {
    await expectMessage('kategori berbeda ditolak',
      transferSantriToClassByGuru(db, guruCtx, { santriId: santri.id, toClassId: otherCategoryClass.id }),
      'Kelas tujuan harus memiliki kategori yang sama dengan santri.');
  }
  await expectMessage('admin ditolak di jalur guru',
    transferSantriToClassByGuru(db, adminCtx, { santriId: santri.id, toClassId: sameCategoryClass.id }),
    'Hanya guru pengampu yang dapat mentransfer santri.');

  const transferred = await transferSantriToClassByGuru(db, guruCtx, {
    santriId: santri.id, toClassId: sameCategoryClass.id, reason: 'Naik kelas.',
  });
  check('transfer berhasil', transferred.changed, true);
  check('pesan sesuai format lama', transferred.message, `${santri.nama_lengkap} berhasil ditransfer ke ${sameCategoryClass.nama_kelas}.`);
  check('tepat satu keanggotaan aktif', activeMemberships(santri.id), 1);
  check('keanggotaan aktif ada di kelas tujuan',
    sqlite.prepare("select class_id from class_memberships where santri_id = ? and status = 'active'").get(santri.id).class_id,
    sameCategoryClass.id);
  check('keanggotaan lama ditutup',
    sqlite.prepare("select status from class_memberships where santri_id = ? and class_id = ? order by created_at limit 1").get(santri.id, guru.class_id).status,
    'moved');
  check('santri menunjuk kelas baru',
    sqlite.prepare('select current_class_id from santri where id = ?').get(santri.id).current_class_id, sameCategoryClass.id);
  const mutation = sqlite.prepare('select * from class_mutations where id = ?').get(transferred.mutation_id);
  check('mutasi tercatat dengan alasan', mutation.reason, 'Naik kelas.');
  check('mutasi mencatat kelas asal', mutation.from_class_id, guru.class_id);

  // Guru kehilangan hak setelah santrinya pindah ke kelas guru lain.
  await expectMessage('guru lama tidak lagi berhak',
    transferSantriToClassByGuru(db, guruCtx, { santriId: santri.id, toClassId: guru.class_id }),
    'Guru tidak memiliki akses transfer untuk santri ini.');
  console.log('');

  console.log('move_santri_to_class:');
  await expectMessage('guru ditolak di jalur admin',
    moveSantriToClass(db, guruCtx, { santriId: santri.id, toClassId: guru.class_id }),
    'Hanya admin yang boleh memindahkan kelas santri.');

  const moved = await moveSantriToClass(db, adminCtx, { santriId: santri.id, toClassId: guru.class_id });
  check('admin memindahkan kembali', moved.changed, true);
  check('pesan sesuai format lama', moved.message, 'Santri berhasil dipindahkan kelas.');
  check('tetap satu keanggotaan aktif', activeMemberships(santri.id), 1);
  check('jumlah keanggotaan aktif dilaporkan', moved.active_memberships, 1);
  check('alasan bawaan dipakai',
    sqlite.prepare('select reason from class_mutations where id = ?').get(moved.mutation_id).reason,
    'Mutasi kelas oleh admin');

  const again = await moveSantriToClass(db, adminCtx, { santriId: santri.id, toClassId: guru.class_id });
  check('memindahkan ke kelas yang sama tidak membuat mutasi', again.mutation_id, null);
  check('pesan sinkronisasi sesuai format lama', again.message, 'Santri sudah berada di kelas tujuan. Data aktif disinkronkan.');
  check('changed false karena sudah selaras', again.changed, false);

  await expectMessage('kelas tujuan tak dikenal ditolak',
    moveSantriToClass(db, adminCtx, { santriId: santri.id, toClassId: '00000000-0000-0000-0000-000000000000' }),
    'Kelas tujuan tidak ditemukan.');
  console.log('');

  console.log('santri non-aktif:');
  sqlite.prepare("update santri set status = 'Nonaktif' where id = ?").run(santri.id);
  await expectMessage('pemindahan ditolak',
    moveSantriToClass(db, adminCtx, { santriId: santri.id, toClassId: sameCategoryClass.id }),
    'Santri tidak aktif sehingga tidak dapat dipindahkan kelas.');
  await expectMessage('transfer ditolak',
    transferSantriToClassByGuru(db, guruCtx, { santriId: santri.id, toClassId: sameCategoryClass.id }),
    'Santri tidak aktif sehingga tidak dapat ditransfer.');
  console.log('');

  console.log(`lulus: ${passed}, gagal: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
