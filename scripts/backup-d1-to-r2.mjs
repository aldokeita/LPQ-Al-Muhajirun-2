// Menyalin seluruh isi D1 produksi ke R2 sebagai satu berkas SQL terkompresi.
//
// Sejak pindah dari Supabase, tidak ada lagi yang mengambil salinan otomatis. Data
// santri, pembayaran, dan absensi hanya ada di satu tempat, dan D1 tidak punya
// pemulihan titik waktu di paket gratis.
//
// Dijalankan oleh .github/workflows/backup-d1.yml setiap hari, bukan oleh Worker.
// Worker-nya sengaja tidak dilibatkan: ekspor penuh memakan waktu belasan detik dan
// memuat berkas belasan megabita, sementara anggaran CPU paket gratis dihitung per
// permintaan. Menaruhnya di luar Worker juga berarti backup tetap berjalan meski
// aplikasinya sedang bermasalah.
//
// Hasilnya disimpan di awalan backups/, yang TIDAK ada di daftar awalan
// worker/routes/files.js — jadi berkas ini tidak bisa diambil siapa pun lewat HTTP,
// hanya lewat kredensial R2.
//
// Pemakaian:
//   node scripts/backup-d1-to-r2.mjs
//   node scripts/backup-d1-to-r2.mjs --dry-run     (ekspor dan periksa, tanpa unggah)
//   node scripts/backup-d1-to-r2.mjs --keep-local  (sisakan berkasnya untuk diperiksa)

import { execFile } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGunzip, createGzip } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

const dryRun = hasFlag('--dry-run');
const keepLocal = hasFlag('--keep-local');
const database = getArg('--database', 'lpq-al-muhajirun');
const bucket = getArg('--bucket', 'lpq-al-muhajirun-files');

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

const wranglerEntry = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
if (!fs.existsSync(wranglerEntry)) fail('wrangler tidak ditemukan. Jalankan npm ci lebih dulu.');

// Wrangler dipanggil sebagai skrip Node, bukan lewat npx: di Windows menjalankan
// pembungkus .cmd dari execFile gagal dengan EINVAL.
//
// Galatnya dibungkus ulang karena execFile menaruh keluaran anak proses di .stderr
// dan .stdout, sementara .message hanya berbunyi "Command failed". Melaporkan
// .message saja membuang satu-satunya keterangan yang berguna — izin token yang
// kurang, nama basis data yang salah, apa pun — dan itu persis yang membuat
// kegagalan pertama di CI tidak bisa ditelusuri sama sekali.
const wrangler = async (wranglerArgs) => {
  try {
    return await run(
      process.execPath,
      [wranglerEntry, ...wranglerArgs],
      { cwd: root, maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (error) {
    const keterangan = [error.stderr, error.stdout]
      .filter(Boolean).map((s) => String(s).trim()).filter(Boolean).join('\n');
    const perintah = wranglerArgs.filter((a) => !a.startsWith('--')).slice(0, 3).join(' ');

    // Cloudflare memulangkan kode 10000 "Authentication error" baik untuk token yang
    // tidak sah maupun untuk token sah yang izinnya kurang, sehingga pesannya sendiri
    // tidak membedakan keduanya. Kalau whoami tadi lolos, tokennya jelas sah, jadi
    // yang tersisa hanya izin — dan izin yang dibutuhkan disebutkan di sini supaya
    // tidak ada yang perlu menebaknya.
    //
    // Ekspor D1 adalah POST yang membuat tugas di sisi server, jadi ia butuh D1 Edit;
    // D1 Read saja akan ditolak persis seperti ini.
    const izinKurang = /10000|Authentication error/i.test(keterangan);
    const petunjuk = izinKurang
      ? '\n\nToken lolos wrangler whoami di atas, jadi tokennya sah dan yang kurang izinnya.'
        + '\nIzin yang dibutuhkan, keduanya tingkat Akun:'
        + '\n  - D1 Edit                  (ekspor adalah POST yang membuat tugas, D1 Read tidak cukup)'
        + '\n  - Workers R2 Storage Edit  (untuk menyimpan hasilnya)'
      : '';

    throw new Error(
      `perintah "wrangler ${perintah}" gagal`
      + (keterangan ? `:\n${keterangan}` : ` (${error.message})`)
      + petunjuk,
    );
  }
};

// Tanggal WIB, bukan UTC. Backup yang berjalan pukul 01.00 WIB harus bernama tanggal
// hari itu, bukan tanggal kemarin menurut UTC.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const stempel = () => new Date(Date.now() + WIB_OFFSET_MS).toISOString().replace(/[:T]/g, '-').slice(0, 16);

const main = async () => {
  const nama = `d1-${stempel()}.sql.gz`;
  const kunci = `backups/d1/${nama}`;
  const kerja = fs.mkdtempSync(path.join(os.tmpdir(), 'lpq-backup-'));
  const berkasSql = path.join(kerja, 'dump.sql');
  const berkasGz = path.join(kerja, nama);

  try {
    console.log(`Basis data : ${database}`);
    console.log(`Tujuan     : r2://${bucket}/${kunci}\n`);

    // Dicetak lebih dulu, sebelum apa pun sempat gagal: keluarannya menyebutkan akun
    // yang dipakai beserta daftar izin token. Kalau nanti ekspor atau unggah ditolak,
    // sebabnya sudah terbaca di baris-baris ini tanpa perlu menebak. GitHub menyamarkan
    // nilai secret di log, dan tokennya sendiri memang tidak pernah dicetak.
    console.log('memeriksa kredensial...');
    const { stdout: siapa } = await wrangler(['whoami']);
    console.log(siapa.split('\n').map((b) => `  ${b}`).join('\n').trimEnd());
    console.log('');

    console.log('mengekspor...');
    const mulai = Date.now();
    await wrangler(['d1', 'export', database, '--remote', '--output', berkasSql, '--skip-confirmation']);
    const detik = ((Date.now() - mulai) / 1000).toFixed(1);

    const isi = fs.readFileSync(berkasSql, 'utf8');
    const ukuranSql = fs.statSync(berkasSql).size;
    const jumlahTabel = (isi.match(/^CREATE TABLE/gm) || []).length;
    const jumlahInsert = (isi.match(/^INSERT INTO/gm) || []).length;
    console.log(`  ${(ukuranSql / 1024 / 1024).toFixed(2)} MB, ${jumlahTabel} tabel, ${jumlahInsert} INSERT, ${detik} detik`);

    // Ekspor yang "berhasil" tetapi memulangkan berkas kosong atau tanpa tabel lebih
    // berbahaya daripada gagal terang-terangan: ia akan menimpa riwayat dengan
    // sesuatu yang tidak bisa dipulihkan. Jadi diperiksa sebelum diunggah.
    if (jumlahTabel < 30) fail(`Ekspor hanya memuat ${jumlahTabel} tabel; seharusnya sekitar 37. Tidak diunggah.`);
    if (jumlahInsert < 1000) fail(`Ekspor hanya memuat ${jumlahInsert} INSERT; tampak tidak lengkap. Tidak diunggah.`);

    console.log('mengompresi...');
    await pipeline(createReadStream(berkasSql), createGzip({ level: 9 }), createWriteStream(berkasGz));
    const ukuranGz = fs.statSync(berkasGz).size;
    console.log(`  ${(ukuranGz / 1024 / 1024).toFixed(2)} MB (${Math.round((1 - ukuranGz / ukuranSql) * 100)}% lebih kecil)`);

    if (dryRun) {
      console.log('\nDry-run: tidak diunggah.');
      if (keepLocal) console.log(`Berkas ada di ${berkasGz}`);
      return;
    }

    console.log('mengunggah...');
    await wrangler([
      'r2', 'object', 'put', `${bucket}/${kunci}`,
      '--file', berkasGz,
      '--content-type', 'application/gzip',
      '--remote',
    ]);

    // Mengunggah tanpa memeriksa hasilnya berarti mengira punya backup padahal belum
    // tentu. Objeknya ditarik kembali lalu dibandingkan bita per bita.
    //
    // Ditarik ke berkas, bukan lewat --pipe: stdout dari execFile dipulangkan sebagai
    // string UTF-8, sehingga bita yang bukan teks teracak dan ukurannya jadi mengecil.
    // Pemeriksaan yang memakai --pipe akan gagal pada berkas yang sebenarnya utuh.
    const berkasUji = path.join(kerja, 'verifikasi.gz');
    await wrangler(['r2', 'object', 'get', `${bucket}/${kunci}`, '--remote', '--file', berkasUji]);
    const ukuranR2 = fs.statSync(berkasUji).size;
    if (ukuranR2 !== ukuranGz) {
      fail(`Ukuran di R2 (${ukuranR2}) tidak sama dengan yang diunggah (${ukuranGz}).`);
    }
    if (!fs.readFileSync(berkasUji).equals(fs.readFileSync(berkasGz))) {
      fail('Isi berkas di R2 berbeda dengan yang diunggah.');
    }

    // Bita yang sama belum berarti bisa dipulihkan. Yang ditarik dari R2 dibuka lalu
    // benar-benar dimuat ke SQLite kosong di memori — tidak menyentuh apa pun yang
    // hidup — supaya backup ini terbukti bisa dijalankan, bukan sekadar tersimpan.
    const berkasPulih = path.join(kerja, 'verifikasi.sql');
    await pipeline(createReadStream(berkasUji), createGunzip(), createWriteStream(berkasPulih));

    const uji = new DatabaseSync(':memory:');
    uji.exec('PRAGMA foreign_keys = OFF;');
    uji.exec(fs.readFileSync(berkasPulih, 'utf8'));
    const tabelPulih = uji.prepare(
      "select count(*) c from sqlite_master where type='table' and name not like 'sqlite_%'").get().c;
    const santriPulih = uji.prepare('select count(*) c from santri').get().c;
    uji.close();

    if (tabelPulih < 30 || santriPulih < 1) {
      fail(`Backup tidak dapat dipulihkan dengan benar: ${tabelPulih} tabel, ${santriPulih} santri.`);
    }
    console.log(`  dipulihkan ke SQLite sementara: ${tabelPulih} tabel, ${santriPulih} santri`);

    console.log(`\nSelesai. r2://${bucket}/${kunci} terverifikasi ${(ukuranR2 / 1024 / 1024).toFixed(2)} MB`);
    console.log('Pulihkan dengan: wrangler d1 execute <db> --remote --file <dump.sql>');
  } finally {
    if (keepLocal) console.log(`\nBerkas kerja disisakan di ${kerja}`);
    else fs.rmSync(kerja, { recursive: true, force: true });
  }
};

main().catch((error) => fail(error.message));
