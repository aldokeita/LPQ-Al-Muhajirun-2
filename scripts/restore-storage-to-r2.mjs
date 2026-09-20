// Menyalin hasil backup Storage Supabase ke bucket R2, sekali jalan.
//
// Ini separuh kedua dari pemindahan berkas. Separuh pertamanya
// scripts/backup-supabase-storage.mjs, yang mengunduh seluruh objek ke
// _private_reference/backup-<stamp>/storage/<bucket>/<path> berikut manifest ber-sha256.
//
// Dipisah dua bukan karena kerapian, melainkan karena kedua sisinya bisa gagal dengan
// cara yang sama sekali berbeda. Mengunduh dari Supabase menghabiskan kuota egress yang
// justru sedang bermasalah, jadi begitu sebuah berkas ada di disk ia tidak boleh ditarik
// ulang. Mengunggah ke R2 aman diulang sebanyak apa pun.
//
// Nama bucket dipetakan ke awalan di dalam satu bucket R2, sesuai worker/routes/files.js:
//   avatars        -> avatars/
//   website-assets -> website-assets/
//   music-files    -> music-files/
//
// Pemakaian:
//   node scripts/restore-storage-to-r2.mjs --from _private_reference/backup-<stamp>
//   node scripts/restore-storage-to-r2.mjs --from ... --dry-run     (periksa saja)
//
// Aman diulang: objek yang sudah ada di R2 dengan ukuran sama akan dilewati.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const privateRoot = path.join(root, '_private_reference');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const hasFlag = (name) => args.includes(name);

const bucketName = getArg('--bucket', 'lpq-al-muhajirun-files');
const dryRun = hasFlag('--dry-run');
const concurrency = Math.max(1, Number(getArg('--concurrency', '4')));

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

const sourceDir = path.resolve(getArg('--from', ''));
if (!getArg('--from', '')) fail('Tentukan folder backup dengan --from.');
if (path.relative(privateRoot, sourceDir).startsWith('..')) {
  fail('Folder backup harus berada di dalam _private_reference.');
}

const manifestPath = path.join(sourceDir, 'storage-manifest.json');
if (!fs.existsSync(manifestPath)) {
  fail(`storage-manifest.json tidak ditemukan di ${sourceDir}. Jalankan backup-supabase-storage.mjs lebih dulu.`);
}

// Nama bucket Supabase dipetakan ke awalan R2. Bucket di luar daftar ini tidak dipakai
// aplikasi, jadi dilewati dengan catatan alih-alih disalin diam-diam ke tempat yang
// aturan aksesnya tidak pernah ditentukan.
const PREFIX_BY_BUCKET = {
  avatars: 'avatars',
  'website-assets': 'website-assets',
  'music-files': 'music-files',
};

// Harus sama dengan isSafePath di worker/routes/files.js. Berkas yang path-nya tidak
// memenuhi ini tidak akan pernah bisa diambil lewat /api/files, jadi lebih baik
// dilaporkan sekarang daripada tersimpan dan tak terjangkau.
const isServablePath = (key) => (
  key.length > 0
  && key.length <= 512
  && !key.startsWith('/')
  && !key.includes('//')
  && !key.split('/').some((part) => part === '' || part === '.' || part === '..')
  && /^[A-Za-z0-9._/-]+$/.test(key)
);

const EXTENSION_TYPES = {
  webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  pdf: 'application/pdf', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav',
  m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm',
};

// mimetype dari manifest dipakai lebih dulu; kalau kosong, ditebak dari ekstensi.
const contentTypeFor = (object) => {
  if (object.mimetype && object.mimetype !== 'application/octet-stream') return object.mimetype;
  const ext = path.extname(object.path).slice(1).toLowerCase();
  return EXTENSION_TYPES[ext] || 'application/octet-stream';
};

// Wrangler dipanggil sebagai skrip Node, bukan lewat npx. Di Windows, menjalankan
// pembungkus .cmd dari execFile gagal dengan EINVAL, dan menyalakan shell untuk
// mengatasinya berarti menyerahkan nama berkas ke penafsiran shell.
const wranglerEntry = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
if (!fs.existsSync(wranglerEntry)) {
  fail(`wrangler tidak ditemukan di ${wranglerEntry}. Jalankan npm install lebih dulu.`);
}

const wrangler = async (wranglerArgs) => run(
  process.execPath,
  [wranglerEntry, ...wranglerArgs],
  { cwd: root, maxBuffer: 16 * 1024 * 1024 },
);

// Memeriksa apakah objeknya sudah ada di R2 dengan ukuran yang sama, supaya jalan ulang
// tidak mengunggah ulang ribuan berkas.
const existingSize = async (key) => {
  try {
    const { stdout } = await wrangler(['r2', 'object', 'get', `${bucketName}/${key}`, '--remote', '--pipe']);
    return Buffer.byteLength(stdout, 'binary');
  } catch {
    return null;
  }
};

const uploadObject = async (key, filePath, contentType) => {
  await wrangler([
    'r2', 'object', 'put', `${bucketName}/${key}`,
    '--file', filePath,
    '--content-type', contentType,
    // Berkas ini dialamati lewat path yang tetap, jadi aman disimpan lama oleh peramban.
    '--cache-control', 'public, max-age=604800',
    '--remote',
  ]);
};

const runPool = async (items, worker) => {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
};

const main = async () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`Sumber  : ${sourceDir}`);
  console.log(`Tujuan  : R2 bucket ${bucketName}`);
  if (dryRun) console.log('Mode    : dry-run, tidak ada yang diunggah\n');
  else console.log('');

  const pekerjaan = [];
  const dilewati = [];

  for (const bucket of manifest.buckets ?? []) {
    const prefix = PREFIX_BY_BUCKET[bucket.id];
    if (!prefix) {
      dilewati.push({ bucket: bucket.id, alasan: 'bucket tidak dipakai aplikasi' });
      continue;
    }

    for (const object of bucket.objects ?? []) {
      const key = `${prefix}/${object.path}`;
      const filePath = path.join(sourceDir, 'storage', bucket.id, ...object.path.split('/'));

      if (!fs.existsSync(filePath)) {
        dilewati.push({ bucket: bucket.id, path: object.path, alasan: 'berkasnya tidak ada di hasil backup' });
        continue;
      }
      if (!isServablePath(key)) {
        // Worker menolak path semacam ini saat diambil, jadi mengunggahnya hanya akan
        // menghasilkan berkas yang tidak pernah bisa ditampilkan.
        dilewati.push({ bucket: bucket.id, path: object.path, alasan: 'path memuat karakter yang tidak dilayani Worker' });
        continue;
      }

      pekerjaan.push({ key, filePath, contentType: contentTypeFor(object), size: fs.statSync(filePath).size });
    }
  }

  const totalBytes = pekerjaan.reduce((sum, item) => sum + item.size, 0);
  console.log(`${pekerjaan.length} objek siap disalin (~${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
  if (dilewati.length > 0) console.log(`${dilewati.length} objek dilewati`);

  if (dryRun) {
    for (const item of dilewati.slice(0, 20)) {
      console.log(`  lewat: ${item.bucket}/${item.path ?? ''} — ${item.alasan}`);
    }
    if (dilewati.length > 20) console.log(`  ... dan ${dilewati.length - 20} lainnya`);
    console.log('\nDry-run selesai. Hilangkan --dry-run untuk benar-benar menyalin.');
    return;
  }

  let selesai = 0;
  let sudahAda = 0;
  const gagal = [];

  await runPool(pekerjaan, async (item) => {
    try {
      const ada = await existingSize(item.key);
      if (ada !== null && ada === item.size) {
        sudahAda += 1;
      } else {
        await uploadObject(item.key, item.filePath, item.contentType);
      }
    } catch (error) {
      gagal.push({ key: item.key, error: String(error.stderr || error.message).slice(0, 300) });
    }
    selesai += 1;
    if (selesai % 10 === 0 || selesai === pekerjaan.length) {
      process.stdout.write(`  ${selesai}/${pekerjaan.length}\r`);
    }
  });

  console.log(`\nSelesai ${selesai}/${pekerjaan.length} (${sudahAda} sudah ada, ${gagal.length} gagal)`);

  const laporan = path.join(sourceDir, 'r2-restore-report.json');
  fs.writeFileSync(laporan, `${JSON.stringify({
    ran_at: new Date().toISOString(),
    bucket: bucketName,
    total: pekerjaan.length,
    already_present: sudahAda,
    skipped: dilewati,
    failures: gagal,
  }, null, 2)}\n`);
  console.log(`Laporan: ${laporan}`);

  if (gagal.length > 0) {
    console.error(`${gagal.length} objek GAGAL. Jalankan ulang perintah yang sama untuk mencoba lagi.`);
    process.exit(1);
  }
};

main().catch((error) => fail(error.message));
