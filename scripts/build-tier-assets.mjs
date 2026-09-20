// Menyalin lambang tier dari berkas PNG sumber menjadi WebP teroptimasi.
//
// PNG aslinya berukuran sekitar 1,5 MB per berkas — terlalu berat untuk lambang
// yang tampil sebesar ibu jari di kartu absensi. Skrip ini hanya membaca berkas
// sumber; ia tidak pernah menulis, memindahkan, atau menghapus apa pun di sana.
//
//   node scripts/build-tier-assets.mjs "<folder sumber>" [--probe]
//
// --probe hanya melaporkan dimensi dan batas isi tanpa menulis keluaran.
//
// Tepi transparannya sengaja TIDAK dipangkas. Seluruh berkas sumber berukuran sama
// (1254x1254), jadi ruang kosong di tepinya adalah bagian dari komposisi: lambang
// yang bentuknya lebih ramping memang digambar lebih ramping. Memangkasnya akan
// memperbesar lambang ramping itu relatif terhadap yang lebar, sehingga ukurannya
// justru berbeda-beda antar tier — persis yang tidak kita inginkan. Dibiarkan utuh,
// semuanya menjadi bujur sangkar yang identik dan menempati kotak yang sama persis.

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

import { SANTRI_TIER_DEFINITIONS, tierAssetBasename } from '../src/lib/santriTier.js';

const [, , sumberArg, ...opsi] = process.argv;
const probeSaja = opsi.includes('--probe');

const SUMBER = sumberArg || 'D:\\Project\\LPQ Al-Fath Maulana\\Tier Ranked LPQ';
const TUJUAN = path.join('public', 'assets', 'tiers');

// Sisi terpanjang keluaran. Lambang tampil paling besar sekitar 72 px pada kartu,
// jadi 256 px masih tajam di layar 3x tanpa membawa berat yang percuma.
const SISI_MAKS = 256;

if (!fs.existsSync(SUMBER)) {
  console.error(`Folder sumber tidak ditemukan: ${SUMBER}`);
  process.exit(2);
}

if (!probeSaja) fs.mkdirSync(TUJUAN, { recursive: true });

const berkasSumber = fs.readdirSync(SUMBER).filter((f) => f.toLowerCase().endsWith('.png'));

// Dicocokkan tanpa peduli besar kecil huruf, supaya "Gold IV.png" dan "gold iv.png"
// sama-sama ketemu.
const indeksSumber = new Map(berkasSumber.map((f) => [path.parse(f).name.trim().toLowerCase(), f]));

let dibuat = 0;
let hilang = 0;
let totalSebelum = 0;
let totalSesudah = 0;

for (const tier of SANTRI_TIER_DEFINITIONS) {
  const asal = indeksSumber.get(tier.name.toLowerCase());
  if (!asal) {
    console.error(`  TIDAK ADA SUMBER  ${tier.name}`);
    hilang += 1;
    continue;
  }

  const jalurAsal = path.join(SUMBER, asal);
  const ukuranAsal = fs.statSync(jalurAsal).size;
  totalSebelum += ukuranAsal;

  if (probeSaja) {
    const m = await sharp(jalurAsal).metadata();
    console.log(
      `${tier.name.padEnd(16)} ${String(m.width).padStart(4)}x${String(m.height).padEnd(4)}`
      + ` alpha=${m.hasAlpha} ${m.format}`,
    );
    continue;
  }

  const namaKeluaran = `${tierAssetBasename(tier.name)}.webp`;
  const jalurKeluaran = path.join(TUJUAN, namaKeluaran);

  await sharp(jalurAsal)
    .resize({
      width: SISI_MAKS,
      height: SISI_MAKS,
      fit: 'inside',           // rasio aspek isi dipertahankan, tidak pernah diregangkan
      withoutEnlargement: true,
      fastShrinkOnLoad: false, // pengecilan bertahap, supaya tepi lambang tetap tajam
    })
    .webp({ quality: 90, effort: 6, alphaQuality: 100 })
    .toFile(jalurKeluaran);

  const ukuranBaru = fs.statSync(jalurKeluaran).size;
  totalSesudah += ukuranBaru;
  dibuat += 1;

  const keluaran = await sharp(jalurKeluaran).metadata();
  console.log(
    `  ${namaKeluaran.padEnd(20)} ${String(keluaran.width).padStart(3)}x${String(keluaran.height).padEnd(3)}`
    + ` ${(ukuranBaru / 1024).toFixed(1).padStart(6)} KB   (dari ${(ukuranAsal / 1024 / 1024).toFixed(2)} MB)`,
  );
}

if (probeSaja) process.exit(0);

console.log(`\n${dibuat} WebP dibuat di ${TUJUAN}`);
console.log(
  `ukuran: ${(totalSebelum / 1024 / 1024).toFixed(1)} MB PNG -> `
  + `${(totalSesudah / 1024).toFixed(0)} KB WebP`,
);
if (hilang) {
  console.error(`${hilang} tier tidak punya berkas sumber.`);
  process.exit(1);
}
