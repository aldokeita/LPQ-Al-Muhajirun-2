// Menguji penulis data berpagar terhadap data produksi.
//
// Yang dibuktikan di sini bukan hanya "berhasil menulis", melainkan bahwa penulisan yang
// seharusnya ditolak memang ditolak, dan bahwa kolom audit tidak bisa dipalsukan klien.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-worker-mutate.mjs <schema.sql> <data.sql>

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { createAuthorizer } from '../worker/auth/authorize.js';
import { QueryError } from '../worker/data/query.js';
import { deleteRow, insertRow, updateRow } from '../worker/data/mutate.js';

const [, , schemaPath, dataPath] = process.argv;
if (!schemaPath || !dataPath) {
  console.error('Pemakaian: node --experimental-sqlite scripts/test-worker-mutate.mjs <schema.sql> <data.sql>');
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

const expectRejected = async (label, promise) => {
  try {
    await promise;
    check(label, 'diterima', 'ditolak');
  } catch (error) {
    check(label, error instanceof QueryError || error.name === 'AuthorizationError', true);
  }
};

const run = async () => {
  const admin = sqlite.prepare("select id from user_profiles where role = 'admin' and status = 'active' limit 1").get();
  const guru = sqlite.prepare(`
    select up.id as guru_id, c.id as class_id from user_profiles up
     join classes c on c.id_guru = up.id and c.deleted_at is null
    where up.role = 'guru' and up.status = 'active'
      and exists (select 1 from class_memberships cm where cm.class_id = c.id and cm.status = 'active')
    limit 1`).get();
  const ownSantri = sqlite.prepare("select santri_id from class_memberships where class_id = ? and status = 'active' limit 1").get(guru.class_id).santri_id;
  const otherSantri = sqlite.prepare(`
    select cm.santri_id from class_memberships cm join classes c on c.id = cm.class_id
     where cm.status = 'active' and c.id_guru is not ?
       and cm.santri_id not in (select santri_id from class_memberships where class_id = ?)
     limit 1`).get(guru.guru_id, guru.class_id).santri_id;

  const adminAuth = createAuthorizer(db, admin.id);
  const guruAuth = createAuthorizer(db, guru.guru_id);

  console.log('guru menulis di wilayahnya:');
  const inserted = await insertRow(db, guruAuth, {
    table: 'santri_notes',
    values: { santri_id: ownSantri, note: 'Catatan uji otomatis.' },
  });
  check('catatan santri kelasnya tersimpan', typeof inserted.id === 'string', true);

  const stored = sqlite.prepare('select * from santri_notes where id = ?').get(inserted.id);
  check('created_by diisi server dengan identitas penulis', stored.created_by, guru.guru_id);
  check('id dibuat server', stored.id, inserted.id);
  check('created_at terisi', typeof stored.created_at === 'string' && stored.created_at.endsWith('Z'), true);
  console.log('');

  console.log('kolom audit tidak bisa dipalsukan:');
  const forged = await insertRow(db, guruAuth, {
    table: 'santri_notes',
    values: { santri_id: ownSantri, note: 'Percobaan pemalsuan.', created_by: admin.id, id: 'id-palsu' },
  });
  const forgedRow = sqlite.prepare('select * from santri_notes where id = ?').get(forged.id);
  check('created_by kiriman klien diabaikan', forgedRow.created_by, guru.guru_id);
  check('id kiriman klien diabaikan', forgedRow.id === 'id-palsu', false);
  console.log('');

  console.log('guru menulis di luar wilayahnya:');
  await expectRejected(
    'catatan untuk santri kelas lain ditolak',
    insertRow(db, guruAuth, { table: 'santri_notes', values: { santri_id: otherSantri, note: 'Tidak boleh.' } }),
  );
  await expectRejected(
    'menulis payments ditolak',
    insertRow(db, guruAuth, { table: 'payments', values: { santri_id: ownSantri, jumlah: 100000, tanggal_pembayaran: '2026-09-19' } }),
  );
  console.log('');

  console.log('memindahkan baris ke wilayah lain:');
  await expectRejected(
    'guru tidak boleh mengubah santri_id catatan',
    updateRow(db, guruAuth, { table: 'santri_notes', id: inserted.id, values: { santri_id: otherSantri } }),
  );
  const movedByAdmin = await updateRow(db, adminAuth, {
    table: 'santri_notes', id: inserted.id, values: { santri_id: otherSantri },
  });
  check('admin boleh memindahkannya', movedByAdmin.id, inserted.id);
  console.log('');

  console.log('mengubah baris yang bukan haknya:');
  // Setelah dipindah admin, catatan itu kini milik kelas lain dan guru uji kehilangan hak.
  await expectRejected(
    'guru tidak bisa lagi mengubah catatan yang sudah dipindah',
    updateRow(db, guruAuth, { table: 'santri_notes', id: inserted.id, values: { note: 'Coba ubah.' } }),
  );
  console.log('');

  console.log('penghapusan:');
  const softTarget = await insertRow(db, adminAuth, {
    table: 'santri_notes', values: { santri_id: ownSantri, note: 'Akan dihapus.' },
  });
  const removed = await deleteRow(db, adminAuth, { table: 'santri_notes', id: softTarget.id });
  const afterDelete = sqlite.prepare('select * from santri_notes where id = ?').get(softTarget.id);
  if (removed.soft) {
    check('penghapusan lunak menandai deleted_at', typeof afterDelete?.deleted_at === 'string', true);
  } else {
    // santri_notes tidak punya kolom deleted_at, jadi barisnya memang dihapus permanen.
    check('baris benar-benar terhapus', afterDelete === undefined, true);
  }

  // Tabel yang punya deleted_at harus dihapus secara lunak, bukan dibuang.
  const softSantri = await deleteRow(db, adminAuth, { table: 'santri', id: ownSantri });
  check('santri dihapus secara lunak', softSantri.soft, true);
  const santriAfter = sqlite.prepare('select deleted_at from santri where id = ?').get(ownSantri);
  check('deleted_at santri terisi', typeof santriAfter?.deleted_at === 'string', true);
  await expectRejected('baris tak dikenal ditolak', deleteRow(db, adminAuth, { table: 'santri_notes', id: 'tidak-ada' }));
  console.log('');

  console.log('masukan berbahaya:');
  await expectRejected('kolom tak dikenal', insertRow(db, adminAuth, { table: 'santri_notes', values: { santri_id: ownSantri, xx: 1 } }));
  await expectRejected('tabel internal', insertRow(db, adminAuth, { table: 'users', values: { email: 'x@y.z' } }));
  await expectRejected('tabel tak dikenal', insertRow(db, adminAuth, { table: 'sqlite_master', values: { name: 'x' } }));
  await expectRejected('nilai objek', insertRow(db, adminAuth, { table: 'santri_notes', values: { santri_id: ownSantri, note: { a: 1 } } }));
  console.log('');

  console.log(`lulus: ${passed}, gagal: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
