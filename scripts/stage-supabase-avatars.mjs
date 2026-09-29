// Menyusun ulang hasil unduhan Storage Supabase menjadi bentuk yang dipahami R2.
//
// Kenapa perlu langkah tersendiri: path di Storage Supabase TIDAK sama dengan nilai
// avatar_path yang tersimpan di basis data. Storage-nya berisi
//
//   avatars/santri/<id>.jpeg
//   avatars/santri-profile/<id>-<timestamp>.JPEG      (versi lama, bisa lebih dari satu)
//   avatars/guru/<id>/<timestamp>.jpg
//   avatars/<id>-avatar                                (satu berkas tanpa ekstensi)
//
// sedangkan basis data meminta avatars/santri/<id>/profile.webp dan
// avatars/guru/<id>/profile.webp. Menyalin path-untuk-path seperti
// restore-storage-to-r2.mjs akan menaruh berkasnya di alamat yang tidak pernah diminta
// siapa pun, dan kartu santri tetap kosong.
//
// Jadi pencocokannya lewat id pemilik, bukan lewat path, lalu berkasnya ditulis ke
// alamat yang memang diminta basis data. Dengan begitu tidak ada satu baris pun di
// basis data yang perlu diubah.
//
// Gambarnya sekalian diubah ke WebP: alamat yang diminta memang berakhiran .webp, dan
// foto ponsel 200-400 KB tidak ada gunanya untuk lambang yang tampil beberapa ratus
// piksel. Berkas aslinya tidak disentuh — skrip ini hanya membaca folder sumber.
//
// Pemakaian:
//   node scripts/stage-supabase-avatars.mjs --from "<folder unduhan>/<ref>"
//   node scripts/stage-supabase-avatars.mjs --from ... --dry-run
//
// Keluarannya siap diunggah:
//   node scripts/restore-storage-to-r2.mjs --from _private_reference/storage-final

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import sharp from 'sharp';

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const dryRun = args.includes('--dry-run');

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

const sumber = getArg('--from', '');
if (!sumber) fail('Tentukan folder hasil unduhan dengan --from.');
const sumberDir = path.resolve(sumber);
if (!fs.existsSync(sumberDir)) fail(`Folder sumber tidak ditemukan: ${sumberDir}`);

const tujuanDir = path.join(root, '_private_reference', 'storage-final');
const tujuanStorage = path.join(tujuanDir, 'storage');

// Sisi terpanjang hasil konversi. Kartu absensi menampilkan avatar paling besar sekitar
// 400 px, jadi 512 masih tajam di layar rapat tanpa membawa berat yang percuma.
const SISI_MAKS = 512;
const KUALITAS = 82;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const wranglerEntry = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
if (!fs.existsSync(wranglerEntry)) fail('wrangler tidak ditemukan. Jalankan npm install lebih dulu.');

// Basis data produksi yang menentukan alamat mana yang harus diisi, bukan tebakan.
const bacaD1 = async (sql) => {
  const { stdout } = await run(
    process.execPath,
    [wranglerEntry, 'd1', 'execute', 'lpq-al-muhajirun', '--remote', '--command', sql, '--json'],
    { cwd: root, maxBuffer: 64 * 1024 * 1024 },
  );
  const mulai = stdout.indexOf('[');
  const parsed = JSON.parse(stdout.slice(mulai));
  return parsed[0]?.results ?? [];
};

// Mengumpulkan berkas sumber per id pemilik. Kalau satu pemilik punya beberapa versi,
// yang dipakai yang paling baru — itu yang terakhir dilihat pengguna sebelum Supabase
// berhenti melayani.
const indekskan = (berkas, ambilId) => {
  const peta = new Map();
  for (const f of berkas) {
    const id = ambilId(f);
    if (!id || !UUID.test(id)) continue;
    const ada = peta.get(id.toLowerCase());
    if (!ada || f.mtimeMs > ada.mtimeMs) peta.set(id.toLowerCase(), f);
  }
  return peta;
};

const kumpulkan = (dir) => {
  if (!fs.existsSync(dir)) return [];
  const keluar = [];
  const tumpuk = [dir];
  while (tumpuk.length) {
    const sekarang = tumpuk.pop();
    for (const entri of fs.readdirSync(sekarang, { withFileTypes: true })) {
      const penuh = path.join(sekarang, entri.name);
      if (entri.isDirectory()) tumpuk.push(penuh);
      else keluar.push({ penuh, nama: entri.name, mtimeMs: fs.statSync(penuh).mtimeMs });
    }
  }
  return keluar;
};

const stemTanpaEkstensi = (nama) => nama.replace(/\.[^.]+$/, '');

const main = async () => {
  const avatarsDir = path.join(sumberDir, 'avatars');
  if (!fs.existsSync(avatarsDir)) fail(`Tidak ada folder avatars di ${sumberDir}`);

  console.log(`Sumber : ${sumberDir}`);
  console.log(`Tujuan : ${tujuanDir}`);
  if (dryRun) console.log('Mode   : dry-run, tidak ada berkas ditulis\n'); else console.log('');

  // --- indeks berkas sumber, per jenis pemilik -------------------------------
  const santriDatar = kumpulkan(path.join(avatarsDir, 'santri'))
    .filter((f) => UUID.test(stemTanpaEkstensi(f.nama)));
  const santriLama = kumpulkan(path.join(avatarsDir, 'santri-profile'));
  const guruBersarang = kumpulkan(path.join(avatarsDir, 'guru'));
  const akar = fs.readdirSync(avatarsDir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => ({
      penuh: path.join(avatarsDir, e.name),
      nama: e.name,
      mtimeMs: fs.statSync(path.join(avatarsDir, e.name)).mtimeMs,
    }));

  // Dua tata letak yang pernah ditemui, dan keduanya harus dikenali:
  //   santri/<id>.jpeg                  (proyek wqnyoesvwnqfjqsbzmsi)
  //   santri/<id>/profile.webp          (proyek csvjeetirzdgebeoglqe, sudah sesuai avatar_path)
  // Karena itu id dicari dari nama berkas MAUPUN dari nama folder induknya.
  const santriBersarang = kumpulkan(path.join(avatarsDir, 'santri'))
    .filter((f) => UUID.test(path.basename(path.dirname(f.penuh))));

  const petaSantri = new Map([
    // Versi lama lebih dulu supaya berkas yang lebih kanonis bisa menimpanya
    // bila mtime-nya memang lebih baru.
    ...indekskan(santriLama, (f) => f.nama.slice(0, 36)),
    ...indekskan(akar, (f) => stemTanpaEkstensi(f.nama).replace(/-avatar$/i, '')),
    ...indekskan(santriDatar, (f) => stemTanpaEkstensi(f.nama)),
    ...indekskan(santriBersarang, (f) => path.basename(path.dirname(f.penuh))),
  ]);
  const petaGuru = indekskan(guruBersarang, (f) => path.basename(path.dirname(f.penuh)));

  console.log(`berkas sumber: santri ${petaSantri.size} pemilik, guru ${petaGuru.size} pemilik\n`);

  // --- alamat yang diminta basis data ---------------------------------------
  const barisSantri = await bacaD1(
    "select id, avatar_path from santri where avatar_path is not null and avatar_path <> ''");
  const barisGuru = await bacaD1(
    "select id, avatar_path from guru where avatar_path is not null and avatar_path <> ''");
  console.log(`diminta basis data: santri ${barisSantri.length}, guru ${barisGuru.length}\n`);

  const objek = [];
  const hilang = [];
  let ukuranAsal = 0;
  let ukuranBaru = 0;

  const kerjakan = async (baris, peta, label) => {
    for (const row of baris) {
      const sumberBerkas = peta.get(String(row.id).toLowerCase());
      if (!sumberBerkas) {
        hilang.push({ label, id: row.id, alamat: row.avatar_path });
        continue;
      }

      // avatar_path dipakai apa adanya sebagai alamat tujuan. Itulah yang diminta
      // aplikasi, jadi tidak ada baris basis data yang perlu disentuh.
      const tujuan = path.join(tujuanStorage, 'avatars', row.avatar_path);
      ukuranAsal += fs.statSync(sumberBerkas.penuh).size;

      if (!dryRun) {
        fs.mkdirSync(path.dirname(tujuan), { recursive: true });

        // Berkas yang sudah WebP dan sudah cukup kecil disalin apa adanya. Menyandi
        // ulang gambar yang sudah pas hanya menurunkan mutunya tanpa menghemat apa pun.
        const meta = await sharp(sumberBerkas.penuh).metadata();
        const sisiTerbesar = Math.max(meta.width ?? 0, meta.height ?? 0);
        if (meta.format === 'webp' && sisiTerbesar <= SISI_MAKS) {
          fs.copyFileSync(sumberBerkas.penuh, tujuan);
        } else {
          await sharp(sumberBerkas.penuh)
            .rotate()                // hormati orientasi EXIF sebelum data itu dibuang
            .resize({ width: SISI_MAKS, height: SISI_MAKS, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: KUALITAS })
            .toFile(tujuan);
        }
        ukuranBaru += fs.statSync(tujuan).size;
      }

      objek.push({ path: row.avatar_path, mimetype: 'image/webp' });
    }
  };

  await kerjakan(barisSantri, petaSantri, 'santri');
  await kerjakan(barisGuru, petaGuru, 'guru');

  // --- website-assets disalin apa adanya ------------------------------------
  // Berkas ini dirujuk lewat URL lengkap di dalam website_content, dan nama berkasnya
  // bagian dari URL itu. Mengubah ekstensinya akan memutus rujukan yang justru sedang
  // diperbaiki rewrite-storage-urls.mjs.
  const objekAset = [];
  const asetDir = path.join(sumberDir, 'website-assets');
  for (const f of kumpulkan(asetDir)) {
    const relatif = path.relative(asetDir, f.penuh).split(path.sep).join('/');
    if (!dryRun) {
      const tujuan = path.join(tujuanStorage, 'website-assets', relatif);
      fs.mkdirSync(path.dirname(tujuan), { recursive: true });
      fs.copyFileSync(f.penuh, tujuan);
    }
    objekAset.push({ path: relatif });
  }

  // --- manifest, bentuknya sama dengan yang dihasilkan backup-supabase-storage --
  const manifest = {
    dibuat: new Date().toISOString(),
    sumber: sumberDir,
    catatan: 'Avatar dipetakan ulang lewat id pemilik ke avatar_path dari D1, lalu diubah ke WebP.',
    buckets: [
      { id: 'avatars', objects: objek },
      { id: 'website-assets', objects: objekAset },
    ],
  };

  if (!dryRun) {
    fs.mkdirSync(tujuanDir, { recursive: true });
    fs.writeFileSync(path.join(tujuanDir, 'storage-manifest.json'), JSON.stringify(manifest, null, 2));
  }

  // --- laporan ---------------------------------------------------------------
  console.log(`avatar disiapkan   : ${objek.length}`);
  console.log(`website-assets     : ${objekAset.length}`);
  if (!dryRun && ukuranAsal > 0) {
    console.log(`ukuran avatar      : ${(ukuranAsal / 1024 / 1024).toFixed(1)} MB -> ${(ukuranBaru / 1024 / 1024).toFixed(1)} MB WebP`);
  }

  if (hilang.length) {
    console.log(`\nTIDAK ADA BERKASNYA (${hilang.length}) — basis data menunjuk avatar yang tidak ada di unduhan:`);
    for (const h of hilang.slice(0, 10)) console.log(`  ${h.label} ${h.id}  -> ${h.alamat}`);
    if (hilang.length > 10) console.log(`  ... dan ${hilang.length - 10} lagi`);
  }

  const tanpaBaris = [...petaSantri.keys()].filter(
    (id) => !barisSantri.some((r) => String(r.id).toLowerCase() === id)).length
    + [...petaGuru.keys()].filter(
      (id) => !barisGuru.some((r) => String(r.id).toLowerCase() === id)).length;
  if (tanpaBaris) {
    console.log(`\n${tanpaBaris} berkas sumber tidak punya baris di basis data — dilewati, bukan galat.`);
  }

  if (!dryRun) {
    console.log(`\nSiap diunggah:\n  node scripts/restore-storage-to-r2.mjs --from _private_reference/storage-final`);
  }
};

main().catch((error) => fail(error.message));
