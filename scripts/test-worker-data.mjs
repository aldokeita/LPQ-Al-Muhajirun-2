// Menguji pembaca data berpagar terhadap data produksi.
//
// Yang paling penting di sini: otorisasi harus ikut menyaring di dalam SQL, bukan setelah
// LIMIT. Kalau salah, guru yang meminta 100 baris bisa menerima segelintir dan halaman
// berikutnya melewatkan baris yang seharusnya terlihat.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-worker-data.mjs <schema.sql> <data.sql>

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { createAuthorizer } from '../worker/auth/authorize.js';
import { QueryError, runQuery } from '../worker/data/query.js';

const [, , schemaPath, dataPath] = process.argv;
if (!schemaPath || !dataPath) {
  console.error('Pemakaian: node --experimental-sqlite scripts/test-worker-data.mjs <schema.sql> <data.sql>');
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

const query = async (userId, body) => {
  const authorizer = createAuthorizer(db, userId);
  return runQuery(db, authorizer.ctx, authorizer, body);
};

// Menolak boleh dengan 400 (bentuk permintaan salah) atau 403 (tidak berhak); yang
// penting permintaannya tidak pernah sampai mengembalikan baris.
const expectRejected = async (label, userId, body, statuses = [400, 403]) => {
  try {
    await query(userId, body);
    check(label, 'diterima', `ditolak ${statuses.join(' atau ')}`);
  } catch (error) {
    check(label, error instanceof QueryError && statuses.includes(error.status), true);
  }
};

const run = async () => {
  const admin = sqlite.prepare("select id from user_profiles where role = 'admin' and status = 'active' limit 1").get();
  const guru = sqlite.prepare(`
    select up.id as guru_id from user_profiles up
     where up.role = 'guru' and up.status = 'active'
       and exists (select 1 from classes c join class_memberships cm on cm.class_id = c.id
                    where c.id_guru = up.id and c.deleted_at is null and cm.status = 'active')
     limit 1`).get();
  const santriUser = sqlite.prepare("select id from user_profiles where role = 'santri' and status = 'active' limit 1").get();

  const totalSantri = sqlite.prepare('select count(*) c from santri').get().c;
  const guruSantriCount = sqlite.prepare(`
    select count(distinct cm.santri_id) c
      from class_memberships cm join classes c on c.id = cm.class_id
     where c.id_guru = ? and c.deleted_at is null and cm.status = 'active'`).get(guru.guru_id).c;

  console.log(`santri seluruhnya: ${totalSantri}, milik guru uji: ${guruSantriCount}\n`);

  console.log('admin:');
  const adminRows = await query(admin.id, { table: 'santri', columns: ['id', 'nama_lengkap'], limit: 1000 });
  check('melihat seluruh santri', adminRows.rows.length, totalSantri);
  const adminPayments = await query(admin.id, { table: 'payments', columns: ['id', 'jumlah'], limit: 5 });
  check('bisa membaca payments', adminPayments.rows.length > 0, true);
  console.log('');

  console.log('guru:');
  const guruRows = await query(guru.guru_id, { table: 'santri', columns: ['id'], limit: 1000 });
  check('hanya melihat santri kelasnya', guruRows.rows.length, guruSantriCount);
  check('jumlahnya lebih sedikit dari seluruh santri', guruRows.rows.length < totalSantri, true);

  // Inti pengujian ini: batas diterapkan setelah otorisasi, bukan sebelumnya.
  const limited = await query(guru.guru_id, { table: 'santri', columns: ['id'], limit: 3 });
  check('limit 3 memulangkan tepat 3 baris', limited.rows.length, Math.min(3, guruSantriCount));
  await expectRejected('ditolak membaca payments', guru.guru_id, { table: 'payments', columns: ['id'] });
  console.log('');

  console.log('santri:');
  // RLS dulu memulangkan himpunan kosong, bukan galat, dan sifat itu dipertahankan.
  // Yang wajib dibuktikan adalah jumlah barisnya nol, bukan adanya pesan penolakan.
  const santriSeesSantri = await query(santriUser.id, { table: 'santri', columns: ['id', 'nama_lengkap'], limit: 1000 });
  check('tidak melihat satu pun baris tabel santri', santriSeesSantri.rows.length, 0);
  const ownHistory = await query(santriUser.id, { table: 'jilid_history', columns: ['id', 'santri_id'], limit: 50 });
  check('riwayat jilid yang terbaca hanya miliknya', ownHistory.rows.every((r) => r.santri_id === santriUser.id), true);
  console.log('');

  console.log('tanpa login:');
  const news = await query(null, { table: 'news', columns: ['id', 'status'], limit: 10 });
  check('hanya berita berstatus published', news.rows.every((r) => r.status === 'published'), true);
  await expectRejected('ditolak membaca santri', null, { table: 'santri', columns: ['id'] });
  await expectRejected('ditolak membaca payments', null, { table: 'payments', columns: ['id'] });
  console.log('');

  console.log('penolakan masukan berbahaya:');
  await expectRejected('tabel tak dikenal', admin.id, { table: 'sqlite_master', columns: ['name'] });
  await expectRejected('tabel internal users', admin.id, { table: 'users', columns: ['id'] });
  await expectRejected('kolom tak dikenal', admin.id, { table: 'santri', columns: ['encrypted_password'] });
  await expectRejected('suntikan lewat nama kolom', admin.id, { table: 'santri', columns: ['id) from santri; drop table santri --'] });
  await expectRejected('operator tak diizinkan', admin.id, { table: 'santri', filters: [{ column: 'id', op: 'glob', value: '*' }] });
  await expectRejected('kolom urut tak dikenal', admin.id, { table: 'santri', order: { column: 'x; drop table santri', ascending: true } });
  console.log('');

  console.log('batas dan penyaringan:');
  const capped = await query(admin.id, { table: 'attendance', columns: ['id'], limit: 999999 });
  check('limit dipangkas ke maksimum', capped.limit, 1000);
  const filtered = await query(admin.id, {
    table: 'santri', columns: ['id', 'status'], filters: [{ column: 'status', op: 'eq', value: 'Aktif' }], limit: 1000,
  });
  check('filter eq bekerja', filtered.rows.every((r) => r.status === 'Aktif'), true);
  check('filter menyaring sebagian', filtered.rows.length < totalSantri, true);
  const contains = await query(admin.id, {
    table: 'santri', columns: ['id', 'juz_hafalan'], filters: [{ column: 'juz_hafalan', op: 'contains', value: 'Juz 30' }], limit: 1000,
  });
  check('filter contains pada kolom JSON bekerja', contains.rows.every((r) => r.juz_hafalan.includes('Juz 30')), true);
  console.log('');

  console.log('kelompok OR:');
  const orRows = await query(admin.id, {
    table: 'santri',
    columns: ['id', 'status', 'deleted_at'],
    filters: [{
      or: [
        { column: 'status', op: 'eq', value: 'Nonaktif' },
        { column: 'deleted_at', op: 'not_null' },
      ],
    }],
    limit: 1000,
  });
  check('setiap baris memenuhi salah satu syarat',
    orRows.rows.every((r) => r.status === 'Nonaktif' || r.deleted_at !== null), true);
  const aktifOnly = await query(admin.id, {
    table: 'santri', columns: ['id'], filters: [{ column: 'status', op: 'eq', value: 'Aktif' }], limit: 1000,
  });
  check('hasil OR berbeda dari filter tunggal', orRows.rows.length !== aktifOnly.rows.length, true);

  // Kombinasi AND di luar dengan OR di dalam harus menyempitkan, bukan melebarkan.
  const combined = await query(admin.id, {
    table: 'santri',
    columns: ['id', 'kategori', 'status'],
    filters: [
      { column: 'kategori', op: 'eq', value: 'Anak' },
      { or: [{ column: 'status', op: 'eq', value: 'Aktif' }, { column: 'status', op: 'eq', value: 'Nonaktif' }] },
    ],
    limit: 1000,
  });
  check('AND di luar tetap berlaku', combined.rows.every((r) => r.kategori === 'Anak'), true);
  check('OR di dalam membatasi status', combined.rows.every((r) => ['Aktif', 'Nonaktif'].includes(r.status)), true);
  await expectRejected('kelompok OR kosong ditolak', admin.id, { table: 'santri', filters: [{ or: [] }] });
  await expectRejected('kolom tak dikenal di dalam OR ditolak', admin.id,
    { table: 'santri', filters: [{ or: [{ column: 'xx', op: 'eq', value: 1 }] }] });
  console.log('');

  console.log('urutan dan penempatan NULL:');
  const nullsLast = await query(admin.id, {
    table: 'santri', columns: ['id', 'order_in_class'],
    order: [{ column: 'order_in_class', ascending: true, nullsFirst: false }], limit: 1000,
  });
  const firstNullAt = nullsLast.rows.findIndex((r) => r.order_in_class === null);
  const lastValueAt = nullsLast.rows.map((r) => r.order_in_class).lastIndexOf(
    [...nullsLast.rows].reverse().find((r) => r.order_in_class !== null)?.order_in_class ?? null,
  );
  check('NULL ditempatkan setelah nilai', firstNullAt === -1 || firstNullAt > lastValueAt - 1, true);
  const nullsFirst = await query(admin.id, {
    table: 'santri', columns: ['id', 'order_in_class'],
    order: [{ column: 'order_in_class', ascending: true, nullsFirst: true }], limit: 5,
  });
  check('NULL bisa ditempatkan di awal', nullsFirst.rows[0]?.order_in_class, null);
  await expectRejected('kolom urut tak dikenal di dalam array ditolak', admin.id,
    { table: 'santri', order: [{ column: 'drop table santri', ascending: true }] });
  console.log('');

  console.log('batas parameter terikat D1:');
  const ids = sqlite.prepare('select id from santri limit 80').all().map((r) => r.id);
  const inMax = await query(admin.id, {
    table: 'santri', columns: ['id'], filters: [{ column: 'id', op: 'in', value: ids }], limit: 1000,
  });
  check('80 nilai in diterima', inMax.rows.length, ids.length);
  const terlalu = sqlite.prepare('select id from santri limit 200').all().map((r) => r.id);
  await expectRejected('lebih dari 80 nilai ditolak dengan jelas', admin.id,
    { table: 'santri', columns: ['id'], filters: [{ column: 'id', op: 'in', value: terlalu }] });
  console.log('');

  console.log(`lulus: ${passed}, gagal: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
