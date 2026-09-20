// Menguji adapter frontend terhadap Worker yang benar-benar berjalan.
//
// Ini menembus seluruh lapisan: login, cookie sesi, endpoint, otorisasi, sampai D1.
// Yang dibuktikan adalah bentuk kembaliannya tetap { data, error } seperti konvensi lama,
// sehingga 80 berkas yang sudah menangani bentuk itu tidak perlu diubah polanya.
//
// Jalankan `npx wrangler dev --port 8788 --local` lebih dulu, dengan akun admin uji
// sudah tersemai di D1 lokal.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-frontend-adapter.mjs [baseUrl]

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:8788';

// Adapter memakai fetch relatif; di Node perlu diarahkan ke server dev, dan cookie
// sesi harus dibawa sendiri karena Node tidak punya cookie jar.
let sessionCookie = null;
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const url = typeof input === 'string' && input.startsWith('/') ? `${baseUrl}${input}` : input;
  const headers = { ...(init.headers ?? {}) };
  if (sessionCookie) headers.cookie = sessionCookie;
  return realFetch(url, { ...init, headers });
};

const { changeSantriJilid } = await import('../src/lib/santriJilidAdapters.js');
const { adjustSantriPoints, getSantriPointsErrorMessage } = await import('../src/lib/santriPointsAdapters.js');
const { fetchGuruTransferClassOptions, getClassTransferErrorMessage, transferSantriByGuru } = await import('../src/lib/classTransferAdapters.js');
const { query, queryOne, rpc } = await import('../src/lib/dataClient.js');

const findLocalD1 = () => {
  const stack = [path.join('.wrangler', 'state', 'v3', 'd1')];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.sqlite')) return full;
    }
  }
  return null;
};

const sqlite = new DatabaseSync(findLocalD1(), { readOnly: true });

let passed = 0;
let failed = 0;
const check = (label, actual, expected = true) => {
  const ok = actual === expected;
  if (ok) passed += 1; else failed += 1;
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${label}${ok ? '' : ` (dapat ${JSON.stringify(actual)}, harus ${JSON.stringify(expected)})`}`);
};

const run = async () => {
  console.log('sebelum login:');
  const denied = await query({ table: 'santri', columns: ['id'], limit: 5 });
  check('membaca santri ditolak', denied.error !== null, true);
  check('galat memulangkan objek Error', denied.error instanceof Error, true);
  check('data null saat galat', denied.data, null);
  console.log('');

  console.log('login admin uji:');
  const login = await realFetch(`${baseUrl}/api/auth/login/staff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin.uji@contoh.test', password: 'UjiAdmin#2026' }),
  });
  check('login berhasil', login.status, 200);
  sessionCookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
  check('cookie sesi diperoleh', sessionCookie.startsWith('session='), true);
  console.log('');

  console.log('membaca lewat adapter:');
  const santriList = await query({ table: 'santri', columns: ['id', 'nama_lengkap', 'jilid'], limit: 5 });
  check('tidak ada galat', santriList.error, null);
  check('memulangkan array', Array.isArray(santriList.data), true);
  check('terisi', santriList.data.length > 0, true);

  const aktif = await query({ table: 'santri', columns: ['id', 'status'], filters: { status: 'Aktif' }, limit: 10 });
  check('filter ringkas bekerja', aktif.data.every((r) => r.status === 'Aktif'), true);

  const satu = await queryOne({ table: 'santri', columns: ['id'] });
  check('queryOne memulangkan satu objek', typeof satu.data?.id, 'string');
  console.log('');

  console.log('RPC lewat adapter santriJilidAdapters:');
  const target = sqlite.prepare(`
    select s.id, s.jilid from santri s
     join user_profiles up on up.id = s.id
    where up.role = 'santri' and up.status = 'active' and s.deleted_at is null
      and lower(trim(s.status)) in ('aktif','active')
    limit 1`).get();

  const kosong = await changeSantriJilid({ santriId: null, toJilid: 'Jilid 2' });
  check('santri kosong ditolak di sisi klien', kosong.error?.message, 'Santri belum dipilih.');

  // D1 lokal menyimpan keadaan antar-jalankan, jadi jilid tujuan dipilih yang berbeda
  // dari yang tersimpan sekarang agar pengujian tidak bergantung pada urutan menjalankan.
  const jilidSekarang = sqlite.prepare('select jilid from santri where id = ?').get(target.id).jilid;
  const jilidTujuan = jilidSekarang === 'Jilid 5' ? 'Jilid 4' : 'Jilid 5';

  const hasil = await changeSantriJilid({ santriId: target.id, toJilid: jilidTujuan });
  check('perubahan jilid berhasil', hasil.error, null);
  check('memulangkan santri_id', hasil.data?.santri_id, target.id);
  check('jilid tujuan benar', hasil.data?.to_jilid, jilidTujuan);
  check('ditandai berubah', hasil.data?.changed, true);

  const ulang = await changeSantriJilid({ santriId: target.id, toJilid: jilidTujuan });
  check('perubahan berulang bukan galat', ulang.error, null);
  check('dilaporkan tidak berubah', ulang.data?.changed, false);
  console.log('');

  console.log('santriPointsAdapters:');
  const poinAwal = sqlite.prepare('select points from santri where id = ?').get(target.id).points ?? 0;
  const poinBaru = await adjustSantriPoints({ santriId: target.id, amount: 7 });
  check('poin bertambah lewat adapter', poinBaru, poinAwal + 7);

  // Modul ini melempar galat, bukan memulangkannya, dan pesannya dipetakan untuk pengguna.
  let pointsError = null;
  try {
    await adjustSantriPoints({ santriId: '00000000-0000-0000-0000-000000000000', amount: 1 });
  } catch (error) {
    pointsError = error;
  }
  check('santri tak dikenal melempar galat', pointsError !== null, true);
  check('pesan dipetakan untuk pengguna', getSantriPointsErrorMessage(pointsError),
    'Data santri aktif tidak ditemukan. Muat ulang halaman lalu coba lagi.');

  let zeroError = null;
  try {
    await adjustSantriPoints({ santriId: target.id, amount: 0 });
  } catch (error) {
    zeroError = error;
  }
  check('perubahan nol ditolak di sisi klien', zeroError?.message, 'Perubahan poin harus berupa angka selain nol.');
  console.log('');

  console.log('classTransferAdapters (sebagai admin, bukan guru):');
  let optionsError = null;
  try {
    await fetchGuruTransferClassOptions(target.id);
  } catch (error) {
    optionsError = error;
  }
  check('admin ditolak di jalur guru', optionsError !== null, true);
  check('pesan izin dipetakan', getClassTransferErrorMessage(optionsError),
    'Anda tidak memiliki izin untuk mentransfer santri ini.');

  let transferError = null;
  try {
    await transferSantriByGuru({ santriId: target.id, targetClassId: target.id, reason: 'uji' });
  } catch (error) {
    transferError = error;
  }
  check('transfer oleh admin ditolak', getClassTransferErrorMessage(transferError),
    'Anda tidak memiliki izin untuk mentransfer santri ini.');

  // Galat jaringan harus tetap terbaca sebagai gangguan koneksi, bukan pesan umum.
  check('galat jaringan dipetakan', getClassTransferErrorMessage({ code: 'network_error', message: 'Gagal menghubungi server: fetch failed' }),
    'Koneksi ke server terganggu. Periksa internet lalu coba lagi.');
  check('galat jaringan dipetakan (poin)', getSantriPointsErrorMessage({ code: 'network_error', message: 'Gagal menghubungi server: fetch failed' }),
    'Koneksi ke server terganggu. Periksa internet lalu coba lagi.');
  console.log('');

  console.log('classAttendanceAdapters:');
  const { fetchClassAttendanceSource } = await import('../src/lib/classAttendanceAdapters.js');
  const sumber = await fetchClassAttendanceSource({ year: 2026 });
  check('memulangkan daftar kelas', Array.isArray(sumber.classes) && sumber.classes.length > 0, true);
  check('hari libur berupa Set', sumber.holidays instanceof Set, true);

  const kelasBerisi = sumber.classes.find((c) => c.roster.length > 0);
  check('ada kelas dengan roster terisi', Boolean(kelasBerisi), true);
  check('roster hanya berisi santri aktif', kelasBerisi.roster.every((s) => {
    const status = String(s.status ?? '').trim().toLowerCase();
    return !status || status === 'aktif' || status === 'active';
  }), true);
  check('roster terurut menaik', kelasBerisi.roster.every((s, i, arr) => {
    if (i === 0) return true;
    const prev = Number.isFinite(arr[i - 1].order_in_class) ? arr[i - 1].order_in_class : Number.MAX_SAFE_INTEGER;
    const cur = Number.isFinite(s.order_in_class) ? s.order_in_class : Number.MAX_SAFE_INTEGER;
    return prev <= cur;
  }), true);

  // Join guru dulu dilakukan database; sekarang dijahit di klien dan harus tetap terisi.
  const kelasBerguru = sumber.classes.find((c) => c.id_guru);
  check('nama guru terjahit dari tabel terpisah', typeof kelasBerguru?.guru?.nama, 'string');
  check('kelas tanpa guru memberi peringatan',
    sumber.classes.filter((c) => !c.guru?.nama).every((c) => c.warnings.includes('Guru belum ditentukan')), true);
  console.log('');

  console.log('financeAdapters (konversi sen):');
  const { createExpense, fetchExpensesByPeriod, fetchCashflowSummary, softDeleteExpense } =
    await import('../src/lib/financeAdapters.js');

  const NOMINAL = 125000.5;
  const dibuat = await createExpense({
    tanggal_pengeluaran: '2026-09-20',
    kategori: 'Operasional',
    deskripsi: 'Uji konversi sen',
    jumlah: NOMINAL,
  }, null);
  check('pengeluaran tersimpan', typeof dibuat.id, 'string');

  // Inti pengujian ini: nilai di database harus sen, bukan rupiah. Salah arah konversi
  // membuat angka seratus kali lipat atau seperseratusnya, dan tidak memunculkan galat.
  const tersimpan = sqlite.prepare('select jumlah from expenses where id = ?').get(dibuat.id).jumlah;
  check('disimpan sebagai sen bulat', tersimpan, Math.round(NOMINAL * 100));
  check('bukan tersimpan sebagai rupiah', tersimpan === NOMINAL, false);

  const dibaca = await fetchExpensesByPeriod({ year: 2026, month: 9 });
  const baris = dibaca.find((row) => row.id === dibuat.id);
  check('dibaca kembali sebagai rupiah', baris.jumlah, NOMINAL);

  const ringkasan = await fetchCashflowSummary({ year: 2026, month: 9 });
  check('total pengeluaran dalam rupiah', ringkasan.totalPengeluaran >= NOMINAL, true);
  check('total pemasukan masuk akal', ringkasan.totalPemasukan >= 0, true);

  await softDeleteExpense(dibuat.id);
  const setelahHapus = sqlite.prepare('select deleted_at from expenses where id = ?').get(dibuat.id);
  check('penghapusan lunak menandai deleted_at', typeof setelahHapus.deleted_at, 'string');
  const setelahnya = await fetchExpensesByPeriod({ year: 2026, month: 9 });
  check('baris terhapus tidak ikut terbaca', setelahnya.some((row) => row.id === dibuat.id), false);
  console.log('');

  console.log('galat RPC diteruskan apa adanya:');
  const ditolak = await rpc('move_santri_to_class', { p_santri_id: target.id, p_to_class_id: null });
  check('pesan dari server sampai ke pemanggil', ditolak.error?.message, 'Kelas tujuan wajib dipilih.');
  check('bentuknya tetap { data, error }', ditolak.data, null);
  console.log('');

  console.log(`lulus: ${passed}, gagal: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
