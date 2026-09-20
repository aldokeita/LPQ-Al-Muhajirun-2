// Menguji pengalihan URL Storage terhadap salinan data produksi, tanpa menyentuh apa pun.
//
// Yang dijaga: seluruh URL dalam satu nilai ikut dialihkan, bukan hanya yang pertama.
// heroSlides memuat empat URL sekaligus, dan cara yang hanya menangani kemunculan pertama
// akan meninggalkan tiga sisanya menunjuk ke proyek yang sudah tidak melayani apa-apa.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-storage-url-rewrite.mjs <schema.sql> <data.sql>

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const [, , schemaPath, dataPath] = process.argv;
if (!schemaPath || !dataPath) {
  console.error('Pemakaian: node --experimental-sqlite scripts/test-storage-url-rewrite.mjs <schema.sql> <data.sql>');
  process.exit(1);
}

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync(schemaPath, 'utf8'));
sqlite.exec(fs.readFileSync(dataPath, 'utf8'));

let passed = 0;
let failed = 0;
const check = (label, actual, expected = true) => {
  const ok = actual === expected;
  if (ok) passed += 1; else failed += 1;
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${label}${ok ? '' : ` (dapat ${JSON.stringify(actual)}, harus ${JSON.stringify(expected)})`}`);
};

// Host diambil dari datanya sendiri, supaya uji ini tidak bergantung pada berkas env.
const contoh = sqlite.prepare("select content from website_content where content like '%supabase.co%' limit 1").get();
const host = String(contoh.content).match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];

const PREFIX_BY_BUCKET = { avatars: 'avatars', 'website-assets': 'website-assets', 'music-files': 'music-files' };
const rewrites = [];
for (const [bucket, prefix] of Object.entries(PREFIX_BY_BUCKET)) {
  for (const visibility of ['public', 'sign', 'authenticated']) {
    rewrites.push({ from: `${host}/storage/v1/object/${visibility}/${bucket}/`, to: `/api/files/${prefix}/` });
  }
}

const run = () => {
  console.log(`host terdeteksi: ${host}\n`);

  console.log('sebelum dialihkan:');
  const sebelum = sqlite.prepare("select count(*) c from website_content where content like '%supabase.co%'").get().c;
  check('ada baris yang memuat URL Supabase', sebelum > 0, true);

  // Baris yang memuat lebih dari satu URL adalah kasus yang paling mudah salah.
  const banyakUrl = sqlite.prepare("select key, content from website_content where content like '%supabase.co%'")
    .all()
    .map((r) => ({ key: r.key, jumlah: (String(r.content).match(/supabase\.co/g) || []).length }))
    .filter((r) => r.jumlah > 1);
  check('ada baris dengan lebih dari satu URL', banyakUrl.length > 0, true);
  for (const r of banyakUrl) console.log(`    ${r.key}: ${r.jumlah} URL`);
  console.log('');

  console.log('mengalihkan:');
  for (const { from, to } of rewrites) {
    sqlite.prepare(`update "website_content" set "content" = replace("content", ?, ?) where instr("content", ?) > 0`)
      .run(from, to, from);
  }

  const sesudah = sqlite.prepare("select count(*) c from website_content where content like '%supabase.co%'").get().c;
  check('tidak ada URL Supabase yang tersisa', sesudah, 0);

  const menunjukR2 = sqlite.prepare("select count(*) c from website_content where content like '%/api/files/website-assets/%'").get().c;
  check('baris yang sama kini menunjuk ke R2', menunjukR2, sebelum);

  // Path aslinya harus utuh: yang berubah hanya bagian sebelum path.
  const logo = sqlite.prepare("select content from website_content where key = 'logoUrl'").get();
  check('path berkasnya tetap utuh',
    String(logo.content).includes('migrated-content/logoUrl/073806af7689f5a7946c.webp'), true);
  check('alamatnya berbentuk jalur Worker',
    String(logo.content).includes('/api/files/website-assets/migrated-content/logoUrl/'), true);

  // Inti pengujian: seluruh URL dalam satu nilai ikut dialihkan.
  for (const r of banyakUrl) {
    const isi = sqlite.prepare('select content from website_content where key = ?').get(r.key).content;
    check(`${r.key}: keempat URL-nya ikut dialihkan`,
      (String(isi).match(/\/api\/files\/website-assets\//g) || []).length, r.jumlah);
  }
  console.log('');

  console.log('dijalankan dua kali:');
  // Aman diulang: jalan kedua tidak boleh mengubah apa pun lagi.
  const sebelumUlang = sqlite.prepare("select count(*) c from website_content where content like '%/api/files/%'").get().c;
  for (const { from, to } of rewrites) {
    sqlite.prepare(`update "website_content" set "content" = replace("content", ?, ?) where instr("content", ?) > 0`)
      .run(from, to, from);
  }
  check('tidak ada yang berubah lagi',
    sqlite.prepare("select count(*) c from website_content where content like '%/api/files/%'").get().c, sebelumUlang);
  // Yang berbahaya bukan dua alamat dalam satu nilai — heroSlides memang punya empat —
  // melainkan satu alamat yang awalannya tertempel dua kali.
  check('tidak ada awalan yang tertempel ganda',
    sqlite.prepare("select count(*) c from website_content where content like '%/api/files/website-assets//api/files/%'").get().c, 0);
  const total = sqlite.prepare("select count(*) c from website_content where content like '%/api/files/website-assets/%'").get().c;
  check('jumlah baris yang menunjuk R2 tidak bertambah', total, sebelum);
  console.log('');

  console.log(`lulus: ${passed}, gagal: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
