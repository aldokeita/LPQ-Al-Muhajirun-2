// Mengalihkan URL Storage Supabase yang masih tersimpan di database ke alamat R2 baru.
//
// Menyalin berkasnya saja tidak cukup: sebagian isi database menyimpan URL lengkapnya,
// bukan path-nya, jadi foto tetap tidak muncul sampai URL itu ikut dialihkan.
//
// Yang TIDAK perlu disentuh, dan sengaja tidak disentuh:
//   santri.avatar_path dan guru.avatar_path menyimpan path, bukan URL, dan lapisan
//   frontend sudah menyusun alamatnya sendiri dari situ. Itu mencakup mayoritas foto.
//
// Yang perlu dialihkan hanyalah kolom yang menyimpan URL utuh:
//   website_content.content  konten situs, termasuk logo, slide, dan galeri
//   music_files.file_url     berkas audio pemutar musik
//   santri.foto_url          foto lama sebelum ada avatar_path
//   guru.foto_url            idem
//
// Pemakaian:
//   node scripts/rewrite-storage-urls.mjs --dry-run            (lihat dulu, tidak mengubah)
//   node scripts/rewrite-storage-urls.mjs --apply              (ubah D1 produksi)
//   node scripts/rewrite-storage-urls.mjs --apply --local      (ubah D1 lokal)
//
// Aman diulang: URL yang sudah dialihkan tidak cocok lagi dengan polanya.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const apply = hasFlag('--apply');
const local = hasFlag('--local');
const database = 'lpq-al-muhajirun';

if (!apply && !hasFlag('--dry-run')) {
  console.error('Tentukan --dry-run atau --apply.');
  process.exit(1);
}

// Alamat proyek Supabase dibaca dari berkas env backup yang sudah ada, supaya tidak
// ditanam di dalam skrip dan tetap benar kalau proyeknya berbeda.
const readSupabaseUrl = () => {
  const fromArg = getArg('--supabase-url', '');
  if (fromArg) return fromArg.replace(/\/+$/, '');

  const envFile = path.join(root, '_private_reference', 'backup.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*SUPABASE_URL\s*=\s*(.+?)\s*$/);
      if (match) return match[1].replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
    }
  }
  return '';
};

const supabaseUrl = readSupabaseUrl();
if (!supabaseUrl) {
  console.error('SUPABASE_URL tidak ditemukan. Isi _private_reference/backup.env atau pakai --supabase-url.');
  process.exit(1);
}

// Tanda kutip tunggal dilipatgandakan karena nilainya ditanam langsung di dalam SQL.
const sqlText = (value) => `'${String(value).replace(/'/g, "''")}'`;

// Bucket Supabase -> awalan R2, sama dengan pemetaan di restore-storage-to-r2.mjs.
const PREFIX_BY_BUCKET = {
  avatars: 'avatars',
  'website-assets': 'website-assets',
  'music-files': 'music-files',
};

// Bentuk URL Supabase: <host>/storage/v1/object/<public|sign|authenticated>/<bucket>/<path>
//
// Yang diganti adalah awalannya yang utuh, termasuk nama host, dengan replace(). Pemilihan
// itu disengaja: replace() mengganti SELURUH kemunculan dalam satu nilai, dan satu baris
// website_content bisa memuat beberapa URL sekaligus — heroSlides memuat empat. Cara yang
// hanya menangani kemunculan pertama akan meninggalkan sisanya menunjuk ke Supabase.
const rewrites = [];
for (const [bucket, prefix] of Object.entries(PREFIX_BY_BUCKET)) {
  for (const visibility of ['public', 'sign', 'authenticated']) {
    rewrites.push({
      from: `${supabaseUrl}/storage/v1/object/${visibility}/${bucket}/`,
      to: `/api/files/${prefix}/`,
    });
  }
}

const buildSql = (table, column) => rewrites.map(({ from, to }) => ({
  label: `${from.replace(supabaseUrl, '…')} -> ${to}`,
  check: `select count(*) as c from "${table}" where instr("${column}", ${sqlText(from)}) > 0`,
  update: `update "${table}" set "${column}" = replace("${column}", ${sqlText(from)}, ${sqlText(to)}) `
    + `where instr("${column}", ${sqlText(from)}) > 0`,
}));

const TARGETS = [
  ['website_content', 'content'],
  ['music_files', 'file_url'],
  ['santri', 'foto_url'],
  ['guru', 'foto_url'],
];

// Wrangler dipanggil sebagai skrip Node, bukan lewat npx. Di Windows, menjalankan
// pembungkus .cmd dari execFile gagal dengan EINVAL, dan menyalakan shell untuk
// mengatasinya berarti menyerahkan perintah SQL ini ke penafsiran shell.
const wranglerEntry = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
if (!fs.existsSync(wranglerEntry)) {
  console.error(`wrangler tidak ditemukan di ${wranglerEntry}. Jalankan npm install lebih dulu.`);
  process.exit(1);
}

const d1 = async (sql) => {
  const { stdout } = await run(process.execPath, [
    wranglerEntry, 'd1', 'execute', database,
    local ? '--local' : '--remote',
    '--json', '--command', sql,
  ], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(stdout);
};

const main = async () => {
  console.log(`Basis data: ${database} (${local ? 'lokal' : 'produksi'})`);
  console.log(apply ? 'Mode      : MENGUBAH\n' : 'Mode      : dry-run, tidak mengubah apa pun\n');

  let totalTersentuh = 0;

  for (const [table, column] of TARGETS) {
    for (const statement of buildSql(table, column)) {
      const hasil = await d1(statement.check);
      const jumlah = hasil?.[0]?.results?.[0]?.c ?? 0;
      if (jumlah === 0) continue;

      totalTersentuh += jumlah;
      console.log(`${table}.${column}: ${jumlah} baris — ${statement.label}`);

      if (apply) {
        const ubah = await d1(statement.update);
        const berubah = ubah?.[0]?.meta?.changes ?? 0;
        console.log(`  -> ${berubah} baris dialihkan`);
      }
    }
  }

  if (totalTersentuh === 0) {
    console.log('Tidak ada URL Supabase yang tersisa. Tidak ada yang perlu diubah.');
    return;
  }

  console.log(`\nTotal ${totalTersentuh} baris memuat URL Supabase.`);
  if (!apply) console.log('Jalankan ulang dengan --apply untuk benar-benar mengalihkannya.');
};

main().catch((error) => {
  console.error(`ERROR: ${error.stderr || error.message}`);
  process.exit(1);
});
