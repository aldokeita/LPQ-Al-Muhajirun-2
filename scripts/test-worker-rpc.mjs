// Menguji RPC hasil terjemahan terhadap data produksi.
//
// Yang diuji bukan sekadar jalannya, melainkan kesamaan perilaku dengan versi plpgsql:
// pesan galat, normalisasi Jilid 6a/6b, penolakan santri non-aktif, batas poin, dan
// sifat "tidak berubah" yang bukan merupakan galat.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-worker-rpc.mjs <schema.sql> <data.sql>

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { createAuthContext } from '../worker/auth/predicates.js';
import { RpcError, changeSantriJilid, getSantriLeaderboard, incrementSantriPoints } from '../worker/rpc/santri.js';

const [, , schemaPath, dataPath] = process.argv;
if (!schemaPath || !dataPath) {
  console.error('Pemakaian: node --experimental-sqlite scripts/test-worker-rpc.mjs <schema.sql> <data.sql>');
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
  // D1 menjalankan batch dalam satu transaksi; di sini ditiru dengan transaksi SQLite.
  batch: async (statements) => {
    sqlite.exec('begin');
    try {
      for (const statement of statements) sqlite.prepare(statement.sql).run(...statement.params);
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

const run = async () => {
  const admin = sqlite.prepare("select id from user_profiles where role = 'admin' and status = 'active' limit 1").get();
  const guru = sqlite.prepare(`
    select up.id as guru_id, c.id as class_id from user_profiles up
     join classes c on c.id_guru = up.id and c.deleted_at is null
    where up.role = 'guru' and up.status = 'active'
      and exists (select 1 from class_memberships cm where cm.class_id = c.id and cm.status = 'active')
    limit 1`).get();
  const ownSantri = sqlite.prepare(`
    select s.id, s.nama_lengkap, s.points, s.jilid from santri s
     join class_memberships cm on cm.santri_id = s.id and cm.status = 'active'
    where cm.class_id = ? and s.deleted_at is null and lower(trim(s.status)) in ('aktif','active')
    limit 1`).get(guru.class_id);
  const otherSantri = sqlite.prepare(`
    select s.id from santri s join class_memberships cm on cm.santri_id = s.id and cm.status = 'active'
     join classes c on c.id = cm.class_id
    where c.id_guru is not ? and s.id not in (select santri_id from class_memberships where class_id = ?)
      and s.deleted_at is null and lower(trim(s.status)) in ('aktif','active')
    limit 1`).get(guru.guru_id, guru.class_id);

  const adminCtx = createAuthContext(db, admin.id);
  const guruCtx = createAuthContext(db, guru.guru_id);
  const anonCtx = createAuthContext(db, null);

  console.log('increment_santri_points:');
  const before = ownSantri.points ?? 0;
  const after = await incrementSantriPoints(db, guruCtx, { santriId: ownSantri.id, amount: 5 });
  check('poin bertambah', after, before + 5);
  const storedPoints = sqlite.prepare('select points, updated_by from santri where id = ?').get(ownSantri.id);
  check('tersimpan di database', storedPoints.points, before + 5);
  check('updated_by diisi pelaku', storedPoints.updated_by, guru.guru_id);

  await expectMessage('tanpa login ditolak',
    incrementSantriPoints(db, anonCtx, { santriId: ownSantri.id, amount: 1 }),
    'Login diperlukan untuk mengubah poin santri.');
  await expectMessage('santri kosong ditolak',
    incrementSantriPoints(db, adminCtx, { santriId: null, amount: 1 }),
    'Santri wajib dipilih.');
  await expectMessage('perubahan nol ditolak',
    incrementSantriPoints(db, adminCtx, { santriId: ownSantri.id, amount: 0 }),
    'Perubahan poin harus berupa angka selain nol.');
  await expectMessage('guru tidak boleh menyentuh santri kelas lain',
    incrementSantriPoints(db, guruCtx, { santriId: otherSantri.id, amount: 1 }),
    'Anda tidak memiliki izin untuk mengubah poin santri ini.');
  await expectMessage('poin tidak boleh minus',
    incrementSantriPoints(db, adminCtx, { santriId: ownSantri.id, amount: -999999 }),
    'Poin santri tidak dapat kurang dari nol.');
  await expectMessage('poin tidak boleh melampaui batas',
    incrementSantriPoints(db, adminCtx, { santriId: ownSantri.id, amount: 2147483647 }),
    'Poin santri melebihi batas yang didukung.');
  console.log('');

  console.log('get_santri_leaderboard:');
  {
    const aktif = sqlite.prepare(
      "select count(*) n from santri where deleted_at is null and lower(trim(status)) in ('aktif','active')",
    ).get().n;

    const hal1 = await getSantriLeaderboard(db, adminCtx, { page: 1, pageSize: 10 });
    check('sepuluh baris per halaman', hal1.rows.length, Math.min(10, aktif));
    check('total sesuai jumlah santri aktif', hal1.total, aktif);
    check('jumlah halaman dibulatkan ke atas', hal1.totalPages, Math.max(1, Math.ceil(aktif / 10)));
    check('peringkat mulai dari satu', hal1.startRank, 1);
    check('terurut dari poin terbanyak',
      hal1.rows.every((r, i) => i === 0 || (r.points ?? 0) <= (hal1.rows[i - 1].points ?? 0)), true);

    const hal2 = await getSantriLeaderboard(db, adminCtx, { page: 2, pageSize: 10 });
    check('peringkat berlanjut di halaman dua', hal2.startRank, 11);
    check('halaman dua berisi santri berbeda',
      hal2.rows.every((r) => !hal1.rows.some((a) => a.id === r.id)), true);
    check('poin halaman dua tidak melebihi halaman satu',
      (hal2.rows[0]?.points ?? 0) <= (hal1.rows[hal1.rows.length - 1]?.points ?? 0), true);

    // Inti fiturnya: guru melihat peringkat seluruh sekolah, bukan hanya kelasnya.
    // Membaca lewat tabel santri akan terpotong kebijakan, jadi ini yang dijaga.
    const guruLihat = await getSantriLeaderboard(db, guruCtx, { page: 1, pageSize: 10 });
    check('guru melihat total yang sama dengan admin', guruLihat.total, hal1.total);
    check('guru melihat baris yang sama dengan admin',
      guruLihat.rows.map((r) => r.id).join(','), hal1.rows.map((r) => r.id).join(','));
    check('santri kelas lain ikut terlihat oleh guru',
      guruLihat.rows.some((r) => r.id === otherSantri.id) || guruLihat.total > 10, true);

    // Hanya kolom peringkat yang boleh keluar. Kolom pribadi tetap tertutup.
    const kolom = Object.keys(guruLihat.rows[0] || {});
    for (const rahasia of ['no_hp_ortu', 'alamat', 'no_nik', 'no_kk', 'nama_ayah', 'nama_ibu', 'rfid_tag']) {
      check(`kolom ${rahasia} tidak ikut terkirim`, kolom.includes(rahasia), false);
    }

    check('ukuran halaman dibatasi',
      (await getSantriLeaderboard(db, adminCtx, { page: 1, pageSize: 9999 })).pageSize, 50);
    check('halaman nol dinaikkan ke satu',
      (await getSantriLeaderboard(db, adminCtx, { page: 0, pageSize: 10 })).page, 1);

    await expectMessage('tanpa login ditolak',
      getSantriLeaderboard(db, anonCtx, { page: 1, pageSize: 10 }),
      'Login diperlukan untuk melihat papan peringkat.');
  }
  console.log('');

  console.log('change_santri_jilid:');
  const changed = await changeSantriJilid(db, guruCtx, { santriId: ownSantri.id, toJilid: 'Jilid 3' });
  check('perubahan dilaporkan berhasil', changed.changed, true);
  check('pesan sesuai format lama', changed.message, `${ownSantri.nama_lengkap} berhasil diubah ke Jilid 3.`);
  const history = sqlite.prepare('select * from jilid_history where id = ?').get(changed.history_id);
  check('riwayat tercatat', history?.santri_id, ownSantri.id);
  check('riwayat mencatat jilid asal', history.from_jilid, changed.from_jilid);
  check('changed_by diisi pelaku', history.changed_by, guru.guru_id);

  const again = await changeSantriJilid(db, guruCtx, { santriId: ownSantri.id, toJilid: 'Jilid 3' });
  check('jilid sama bukan galat', again.changed, false);
  check('pesan jilid sama sesuai format lama', again.message, `${ownSantri.nama_lengkap} sudah berada di Jilid 3.`);
  check('tidak menambah riwayat', again.history_id, null);

  const six = await changeSantriJilid(db, adminCtx, { santriId: ownSantri.id, toJilid: 'jilid 6a' });
  check('Jilid 6a dinormalkan menjadi Jilid 6', six.to_jilid, 'Jilid 6');
  const sixAgain = await changeSantriJilid(db, adminCtx, { santriId: ownSantri.id, toJilid: 'Jilid 6b' });
  check('Jilid 6b dianggap sama dengan Jilid 6', sixAgain.changed, false);

  await expectMessage('jilid tujuan kosong ditolak',
    changeSantriJilid(db, adminCtx, { santriId: ownSantri.id, toJilid: '   ' }),
    'Jilid tujuan wajib dipilih.');
  await expectMessage('guru tidak boleh mengubah jilid santri kelas lain',
    changeSantriJilid(db, guruCtx, { santriId: otherSantri.id, toJilid: 'Jilid 2' }),
    'Anda tidak memiliki izin untuk mengubah jilid santri ini.');
  console.log('');

  console.log('santri non-aktif:');
  sqlite.prepare("update santri set status = 'Nonaktif' where id = ?").run(ownSantri.id);
  await expectMessage('poin santri non-aktif ditolak',
    incrementSantriPoints(db, adminCtx, { santriId: ownSantri.id, amount: 1 }),
    'Santri aktif tidak ditemukan.');
  await expectMessage('jilid santri non-aktif ditolak',
    changeSantriJilid(db, adminCtx, { santriId: ownSantri.id, toJilid: 'Jilid 1' }),
    'Santri aktif tidak ditemukan.');
  console.log('');

  console.log(`lulus: ${passed}, gagal: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
