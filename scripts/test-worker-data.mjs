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
  // Policy payments berbunyi admin OR santri_id = auth.uid(). Bagi guru itu berarti
  // himpunan kosong, bukan penolakan — persis seperti RLS, yang menyaring baris alih-alih
  // menolak query. Pemeriksaan ini dulu menuntut penolakan, dan itu keliru.
  const bayarMenurutGuru = await query(guru.guru_id, { table: 'payments', columns: ['id'], limit: 100 });
  check('tidak melihat satu pun pembayaran', bayarMenurutGuru.rows.length, 0);
  console.log('');

  console.log('santri:');
  // RLS dulu memulangkan himpunan kosong, bukan galat, dan sifat itu dipertahankan.
  //
  // Tetapi kosongnya bukan nol mutlak: policy santri berbunyi id = auth.uid() OR ...,
  // jadi seorang santri melihat tepat satu baris, yaitu dirinya sendiri. Pemeriksaan ini
  // dulu menuntut nol, yang mengunci cabang kepemilikan yang hilang.
  const santriSeesSantri = await query(santriUser.id, { table: 'santri', columns: ['id', 'nama_lengkap'], limit: 1000 });
  check('hanya melihat dirinya sendiri di tabel santri', santriSeesSantri.rows.length, 1);
  check('baris itu benar dirinya', santriSeesSantri.rows[0].id, santriUser.id);
  const ownHistory = await query(santriUser.id, { table: 'jilid_history', columns: ['id', 'santri_id'], limit: 50 });
  check('riwayat jilid yang terbaca hanya miliknya', ownHistory.rows.every((r) => r.santri_id === santriUser.id), true);
  console.log('');

  console.log('tanpa login:');
  const news = await query(null, { table: 'news', columns: ['id', 'status'], limit: 10 });
  check('hanya berita berstatus published', news.rows.every((r) => r.status === 'published'), true);

  // Tabel tanpa jalur publik memulangkan himpunan kosong, bukan galat, persis seperti RLS.
  // Yang wajib dibuktikan adalah nol baris, bukan adanya pesan penolakan.
  const santriAnon = await query(null, { table: 'santri', columns: ['id'], limit: 1000 });
  check('tidak melihat satu pun santri', santriAnon.rows.length, 0);
  const paymentsAnon = await query(null, { table: 'payments', columns: ['id'], limit: 1000 });
  check('tidak melihat satu pun payments', paymentsAnon.rows.length, 0);
  const guruAnon = await query(null, { table: 'guru', columns: ['id'], limit: 1000 });
  check('tidak melihat satu pun guru', guruAnon.rows.length, 0);
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

  console.log('setiap orang melihat datanya sendiri:');
  // Policy Postgres hampir selalu punya cabang "baris ini milik saya" — santri_id =
  // auth.uid(), user_id = auth.uid(), dan seterusnya. Terjemahan pertama melewatkannya di
  // banyak tabel, sehingga santri tidak bisa melihat apa pun miliknya sendiri. Tiap
  // pemeriksaan di bawah dibandingkan dengan SQL setara, bukan dengan adapternya sendiri.
  const santriId = santriUser.id;
  const punyaSendiri = [
    ['pembayaran', 'payments', 'santri_id'],
    ['kehadiran', 'attendance', 'user_id'],
    ['keanggotaan kelas', 'class_memberships', 'santri_id'],
    ['nilai juz', 'santri_juz_scores', 'santri_id'],
    ['nilai surah', 'santri_surah_scores', 'santri_id'],
    ['progres hafalan', 'hafalan_progress', 'santri_id'],
    ['mutasi kelas', 'class_mutations', 'santri_id'],
  ];
  for (const [sebutan, tabel, kolom] of punyaSendiri) {
    const hasil = await query(santriId, { table: tabel, columns: ['id', kolom], limit: 1000 });
    const seharusnya = sqlite.prepare(`select count(*) c from "${tabel}" where "${kolom}" = ?`).get(santriId).c;
    check(`santri melihat ${sebutan} miliknya`, hasil.rows.length, seharusnya);
    check(`${sebutan} hanya miliknya`, hasil.rows.every((r) => r[kolom] === santriId), true);
  }

  // Profil sendiri juga, yang dulu saya kira hanya boleh dibaca admin.
  const profilSendiri = await query(santriId, { table: 'user_profiles', columns: ['id'], limit: 10 });
  check('santri melihat profilnya sendiri', profilSendiri.rows.length, 1);
  check('profilnya benar miliknya', profilSendiri.rows[0].id, santriId);

  // Barisnya sendiri di tabel santri.
  const dirinya = await query(santriId, { table: 'santri', columns: ['id'], limit: 10 });
  check('santri melihat barisnya sendiri', dirinya.rows.some((r) => r.id === santriId), true);

  // Kelasnya sendiri lewat keanggotaan aktif.
  const kelasSantri = await query(santriId, { table: 'classes', columns: ['id'], limit: 100 });
  const kelasSeharusnya = sqlite.prepare(
    "select count(distinct class_id) c from class_memberships where santri_id = ? and status = 'active'").get(santriId).c;
  check('santri melihat kelasnya sendiri', kelasSantri.rows.length, kelasSeharusnya);
  console.log('');

  console.log('guru melihat kelas yang diampunya:');
  const kelasGuru = await query(guru.guru_id, { table: 'classes', columns: ['id', 'id_guru'], limit: 1000 });
  const kelasGuruSql = sqlite.prepare('select count(*) c from classes where id_guru = ?').get(guru.guru_id).c;
  check('jumlahnya sama dengan SQL setara', kelasGuru.rows.length, kelasGuruSql);
  check('lebih dari nol', kelasGuru.rows.length > 0, true);
  check('semuanya benar diampunya', kelasGuru.rows.every((r) => r.id_guru === guru.guru_id), true);

  // Guru melihat dirinya sendiri di tabel guru, dan santrinya melihat gurunya.
  const guruSendiri = await query(guru.guru_id, { table: 'guru', columns: ['id'], limit: 100 });
  check('guru melihat barisnya sendiri', guruSendiri.rows.some((r) => r.id === guru.guru_id), true);
  const guruMenurutSantri = await query(santriId, { table: 'guru', columns: ['id'], limit: 100 });
  const guruSeharusnya = sqlite.prepare(`
    select count(distinct c.id_guru) c from classes c
      join class_memberships cm on cm.class_id = c.id and cm.status = 'active'
     where cm.santri_id = ? and c.id_guru is not null`).get(santriId).c;
  check('santri melihat guru yang mengajarnya', guruMenurutSantri.rows.length, guruSeharusnya);
  console.log('');

  console.log('acuan penilaian terbuka untuk semua peran:');
  for (const [sebutan, id] of [['santri', santriId], ['guru', guru.guru_id]]) {
    const acuan = await query(id, { table: 'character_assessment_items', columns: ['id'], limit: 1000 });
    check(`${sebutan} melihat acuan karakter`, acuan.rows.length,
      sqlite.prepare('select count(*) c from character_assessment_items').get().c);
  }
  // hafalan_items terbuka selama aktif; admin melihat semuanya.
  const hafalanSantri = await query(santriId, { table: 'hafalan_items', columns: ['id', 'is_active'], limit: 1000 });
  check('santri hanya melihat item aktif', hafalanSantri.rows.every((r) => r.is_active === 1), true);
  check('jumlahnya sama dengan yang aktif', hafalanSantri.rows.length,
    sqlite.prepare('select count(*) c from hafalan_items where is_active = 1').get().c);
  const hafalanAdmin = await query(admin.id, { table: 'hafalan_items', columns: ['id'], limit: 1000 });
  check('admin melihat seluruh item', hafalanAdmin.rows.length,
    sqlite.prepare('select count(*) c from hafalan_items').get().c);
  console.log('');

  console.log('yang tertutup tetap tertutup:');
  await expectRejected('santri ditolak membaca expenses', santriId, { table: 'expenses', columns: ['id'] });
  await expectRejected('santri ditolak membaca login_logs', santriId, { table: 'login_logs', columns: ['id'] });
  const catatanSantri = await query(santriId, { table: 'santri_notes', columns: ['id'], limit: 100 });
  // Catatan guru tentang santri memang tidak terbaca oleh santri itu sendiri.
  check('santri tidak melihat catatan tentang dirinya', catatanSantri.rows.length, 0);
  const bayarOrangLain = await query(santriId, { table: 'payments', columns: ['santri_id'], limit: 1000 });
  check('tidak ada pembayaran orang lain yang bocor',
    bayarOrangLain.rows.every((r) => r.santri_id === santriId), true);
  console.log('');

  console.log('penyaring pada kolom uang:');
  // Nilai uang disimpan sebagai sen. Pemanggil bekerja dalam rupiah, jadi penyaringnya
  // harus dikonversi seperti halnya penulisan — kalau tidak, hasilnya kosong tanpa galat.
  const contohBayar = sqlite.prepare(
    'select id, jumlah from payments where deleted_at is null and jumlah > 0 limit 1').get();
  const rupiah = contohBayar.jumlah / 100;

  const cocok = await query(admin.id, {
    table: 'payments', columns: ['id', 'jumlah'],
    filters: [{ column: 'jumlah', op: 'eq', value: rupiah }], limit: 1000,
  });
  check('menyaring dengan nilai rupiah menemukan barisnya',
    cocok.rows.some((r) => r.id === contohBayar.id), true);
  check('nilai yang dipulangkan tetap rupiah', cocok.rows[0].jumlah, rupiah);

  // Tanpa konversi, angka sen mentah justru tidak boleh cocok.
  const salahSatuan = await query(admin.id, {
    table: 'payments', columns: ['id'],
    filters: [{ column: 'jumlah', op: 'eq', value: contohBayar.jumlah }], limit: 1000,
  });
  check('angka sen mentah tidak dianggap rupiah',
    salahSatuan.rows.some((r) => r.id === contohBayar.id), false);

  const rentang = await query(admin.id, {
    table: 'payments', columns: ['id', 'jumlah'],
    filters: [{ column: 'jumlah', op: 'gte', value: rupiah }], limit: 1000,
  });
  check('pembanding rentang ikut dikonversi', rentang.rows.every((r) => r.jumlah >= rupiah), true);
  console.log('');

  console.log('konten publik untuk pengguna yang sudah login:');
  // Policy Postgres-nya berpasangan, dan yang kedua berlaku untuk "authenticated" juga:
  //   FOR SELECT TO "anon"          USING ("is_public")
  //   FOR SELECT TO "authenticated" USING ("is_public" OR is_admin())
  // Jadi santri dan guru yang sudah login harus melihat baris publik, bukan kosong.
  const publikSql = sqlite.prepare('select count(*) c from website_content where is_public = 1').get().c;
  const totalKonten = sqlite.prepare('select count(*) c from website_content').get().c;

  for (const [sebutan, id] of [['santri', santriUser.id], ['guru', guru.guru_id]]) {
    const hasil = await query(id, { table: 'website_content', columns: ['key', 'is_public'], limit: 1000 });
    check(`${sebutan} melihat konten publik`, hasil.rows.length, publikSql);
    check(`${sebutan} hanya melihat yang publik`, hasil.rows.every((r) => r.is_public === 1), true);
  }

  const kontenAdmin = await query(admin.id, { table: 'website_content', columns: ['key'], limit: 1000 });
  check('admin melihat seluruh konten', kontenAdmin.rows.length, totalKonten);

  const kontenAnon = await query(null, { table: 'website_content', columns: ['key'], limit: 1000 });
  check('pengunjung tetap melihat yang publik', kontenAnon.rows.length, publikSql);

  // news dan music_files berpola sama.
  const beritaSantri = await query(santriUser.id, { table: 'news', columns: ['id', 'status'], limit: 1000 });
  check('santri melihat berita terbit', beritaSantri.rows.every((r) => r.status === 'published'), true);
  check('jumlahnya sama dengan yang terbit', beritaSantri.rows.length,
    sqlite.prepare("select count(*) c from news where status = 'published'").get().c);

  const musikGuru = await query(guru.guru_id, { table: 'music_files', columns: ['id', 'is_active'], limit: 1000 });
  check('guru melihat musik aktif', musikGuru.rows.every((r) => r.is_active === 1), true);
  check('jumlahnya sama dengan yang aktif', musikGuru.rows.length,
    sqlite.prepare('select count(*) c from music_files where is_active = 1').get().c);

  // feedbacks tidak punya jalur baca publik, jadi non-admin tetap ditolak.
  await expectRejected('santri tetap ditolak membaca feedbacks', santriUser.id,
    { table: 'feedbacks', columns: ['id'] });
  console.log('');

  console.log('view payment_status_summary:');
  // Di Postgres otorisasi view ini menyatu di klausa WHERE-nya. Di sini ia dipindahkan ke
  // lapisan kebijakan, dengan dua predikat memakai kolom berbeda: kepemilikan lewat
  // santri_id, akses guru lewat class_id.
  const viewAdmin = await query(admin.id, {
    table: 'payment_status_summary', columns: ['santri_id', 'class_id', 'status'], limit: 1000,
  });
  check('admin melihat isi view', viewAdmin.rows.length > 0, true);
  check('status hanya dua nilai',
    viewAdmin.rows.every((r) => ['Lunas', 'Belum Lunas'].includes(r.status)), true);

  const guruClassIds = new Set(sqlite.prepare(
    'select id from classes where id_guru = ? and deleted_at is null',
  ).all(guru.guru_id).map((r) => r.id));
  const viewGuru = await query(guru.guru_id, {
    table: 'payment_status_summary', columns: ['santri_id', 'class_id'], limit: 1000,
  });
  check('guru melihat sebagian baris', viewGuru.rows.length > 0, true);
  check('guru hanya melihat kelasnya', viewGuru.rows.every((r) => guruClassIds.has(r.class_id)), true);
  check('guru melihat lebih sedikit dari admin', viewGuru.rows.length < viewAdmin.rows.length, true);

  // Santri uji diambil dari isi view itu sendiri, supaya pemeriksaan tidak lolos hanya
  // karena kebetulan tidak ada barisnya.
  const santriDiView = viewAdmin.rows[0].santri_id;
  const viewSantri = await query(santriDiView, {
    table: 'payment_status_summary', columns: ['santri_id'], limit: 1000,
  });
  check('santri melihat barisnya sendiri', viewSantri.rows.length > 0, true);
  check('santri tidak melihat baris orang lain',
    viewSantri.rows.every((r) => r.santri_id === santriDiView), true);

  const viewAnon = await query(null, { table: 'payment_status_summary', columns: ['santri_id'], limit: 1000 });
  check('pengunjung tidak melihat apa pun', viewAnon.rows.length, 0);
  console.log('');

  console.log('menghitung baris:');
  const { runCount } = await import('../worker/data/query.js');
  const hitung = async (userId, body) => {
    const authorizer = createAuthorizer(db, userId);
    return runCount(db, authorizer.ctx, authorizer, body);
  };

  const totalAdmin = await hitung(admin.id, { table: 'santri' });
  check('admin menghitung seluruh santri', totalAdmin.count, totalSantri);
  const totalGuru = await hitung(guru.guru_id, { table: 'santri' });
  // Hitungan wajib mengikuti otorisasi. Kalau tidak, ia membocorkan berapa banyak santri
  // yang sebenarnya tidak boleh dilihat guru itu.
  check('guru hanya menghitung santri kelasnya', totalGuru.count, guruSantriCount);
  check('hitungan guru lebih kecil dari total', totalGuru.count < totalAdmin.count, true);
  const totalAnon = await hitung(null, { table: 'santri' });
  check('pengunjung menghitung nol santri', totalAnon.count, 0);
  const berfilter = await hitung(admin.id, {
    table: 'santri', filters: [{ column: 'status', op: 'eq', value: 'Aktif' }],
  });
  check('filter ikut diterapkan pada hitungan', berfilter.count < totalSantri, true);
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
