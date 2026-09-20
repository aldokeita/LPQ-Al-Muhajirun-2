// Memeriksa pemetaan tier santri dan berkas lambangnya.
//
// Yang dijaga di sini: setiap tier punya berkas, berkasnya benar-benar ada dan
// berbentuk WebP beralfa dengan ukuran seragam, pencocokan namanya tidak peduli
// huruf besar-kecil, dan kartu absensi memang memakai TierEmblem dengan urutan
// lambang -> pembatas -> nama.
//
//   node scripts/test-santri-tier.mjs

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import {
  SANTRI_TIER_DEFINITIONS,
  SANTRI_TIER_ASSETS,
  getSantriTierAsset,
  resolveSantriTier,
  tierAssetBasename,
} from '../src/lib/santriTier.js';

let lulus = 0;
let gagal = 0;
const check = (label, actual, expected = true) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) lulus += 1; else gagal += 1;
  console.log(`  ${ok ? 'OK  ' : 'GAGAL'}  ${label}`);
  if (!ok) console.log(`        diharapkan ${JSON.stringify(expected)}, didapat ${JSON.stringify(actual)}`);
};

const DIR = path.join('public', 'assets', 'tiers');

console.log('definisi tier:');
check('ada 22 tier', SANTRI_TIER_DEFINITIONS.length, 22);
check('dimulai dari Bronze I', SANTRI_TIER_DEFINITIONS[0].name, 'Bronze I');
check('diakhiri Grandmaster', SANTRI_TIER_DEFINITIONS[21].name, 'Grandmaster');
check('tidak ada nama kembar',
  new Set(SANTRI_TIER_DEFINITIONS.map((t) => t.name)).size, 22);
check('setiap tier punya pemetaan berkas',
  SANTRI_TIER_DEFINITIONS.every((t) => Boolean(getSantriTierAsset(t.name))), true);
console.log('');

console.log('penurunan nama berkas:');
check('Bronze I -> bronze-i', tierAssetBasename('Bronze I'), 'bronze-i');
check('Gold IV -> gold-iv', tierAssetBasename('Gold IV'), 'gold-iv');
check('Elite Heroic -> elite-heroic', tierAssetBasename('Elite Heroic'), 'elite-heroic');
check('Grandmaster -> grandmaster', tierAssetBasename('Grandmaster'), 'grandmaster');
console.log('');

console.log('pencocokan nama tidak peduli huruf besar-kecil:');
const rujukan = SANTRI_TIER_ASSETS['bronze i'];
check('huruf kecil semua', getSantriTierAsset('bronze i'), rujukan);
check('huruf besar semua', getSantriTierAsset('BRONZE I'), rujukan);
check('campuran', getSantriTierAsset('BrOnZe i'), rujukan);
check('spasi berlebih di tepi', getSantriTierAsset('  Bronze I  '), rujukan);
check('spasi ganda di tengah', getSantriTierAsset('Bronze  I'), rujukan);
console.log('');

console.log('cadangan ketika tier tidak dikenal:');
check('label kosong', getSantriTierAsset(''), null);
check('null', getSantriTierAsset(null), null);
check('tak terdefinisi', getSantriTierAsset(undefined), null);
check('nama level lama', getSantriTierAsset('Mythic'), null);
check('nama warisan', getSantriTierAsset('Pemula'), null);
console.log('');

console.log('resolveSantriTier:');
{
  const dikenal = resolveSantriTier({ label: 'Grandmaster', accentColor: '#1d4ed8' });
  check('nama diteruskan', dikenal.name, 'Grandmaster');
  check('berkas ditemukan', dikenal.asset, SANTRI_TIER_ASSETS.grandmaster);
  check('accent diteruskan', dikenal.accentColor, '#1d4ed8');

  // name dipakai kalau label tidak ada, karena resolver level memulangkan name.
  const lewatName = resolveSantriTier({ name: 'Silver II', accentColor: '#76869b' });
  check('name dipakai saat label kosong', lewatName.asset, SANTRI_TIER_ASSETS['silver ii']);

  const takDikenal = resolveSantriTier({ label: 'Mythic', accentColor: '#000' });
  check('nama tetap dipulangkan', takDikenal.name, 'Mythic');
  check('berkas null supaya cadangan dipakai', takDikenal.asset, null);

  const kosong = resolveSantriTier(null);
  check('levelInfo null tidak melempar', kosong.asset, null);
  check('nama null saat levelInfo kosong', kosong.name, null);
  check('accent null saat levelInfo kosong', kosong.accentColor, null);
}
console.log('');

console.log('berkas lambang:');
{
  const adaDir = fs.existsSync(DIR);
  check('folder public/assets/tiers ada', adaDir, true);

  if (adaDir) {
    const dimensi = new Set();
    let semuaAda = true;
    let semuaAlfa = true;
    let semuaWebp = true;
    let total = 0;

    for (const tier of SANTRI_TIER_DEFINITIONS) {
      const relatif = getSantriTierAsset(tier.name);
      const jalur = path.join(DIR, path.basename(relatif));
      if (!fs.existsSync(jalur)) {
        semuaAda = false;
        console.log(`        hilang: ${jalur}`);
        continue;
      }
      total += fs.statSync(jalur).size;
      // eslint-disable-next-line no-await-in-loop
      const m = await sharp(jalur).metadata();
      if (!m.hasAlpha) semuaAlfa = false;
      if (m.format !== 'webp') semuaWebp = false;
      dimensi.add(`${m.width}x${m.height}`);
    }

    check('seluruh 22 berkas ada', semuaAda, true);
    check('seluruhnya berformat webp', semuaWebp, true);
    check('seluruhnya mempertahankan transparansi', semuaAlfa, true);
    check('seluruhnya berdimensi sama', dimensi.size, 1);
    check('dimensinya 256x256', [...dimensi][0], '256x256');
    // Batas longgar; yang dijaga adalah tidak ada yang lolos dalam ukuran PNG penuh.
    check(`total wajar untuk web (${(total / 1024).toFixed(0)} KB < 1500 KB)`, total < 1500 * 1024, true);

    const asing = fs.readdirSync(DIR).filter((f) => !f.endsWith('.webp'));
    check('tidak ada berkas selain webp di folder itu', asing, []);
  }
}
console.log('');

console.log('pemakaian di kartu absensi:');
{
  const kartu = fs.readFileSync(
    path.join('src', 'components', 'dashboard', 'shared', 'AttendanceProfileCard.jsx'),
    'utf8',
  );
  check('mengimpor TierEmblem', kartu.includes("import TierEmblem from '@/components/dashboard/shared/TierEmblem'"), true);
  check('merender TierEmblem', /<TierEmblem\s/.test(kartu), true);
  check('meneruskan levelInfo ke TierEmblem', /<TierEmblem\s+levelInfo=\{levelInfo\}/.test(kartu), true);
  check('punya baris identitas', kartu.includes('attendance-profile-card__identity'), true);

  // Urutannya harus lambang -> pembatas -> teks.
  const iEmblem = kartu.indexOf('<TierEmblem');
  const iDivider = kartu.indexOf('attendance-profile-card__identity-divider');
  const iText = kartu.indexOf('attendance-profile-card__identity-text');
  check('urutan lambang sebelum pembatas', iEmblem > -1 && iEmblem < iDivider, true);
  check('urutan pembatas sebelum nama', iDivider > -1 && iDivider < iText, true);

  // Nama tier hanya boleh muncul sebagai teks di kartu LEVEL, bukan di baris identitas.
  const identitas = kartu.slice(kartu.indexOf('__identity"'), kartu.indexOf('__identity-text') + 400);
  check('baris identitas tidak memuat teks nama tier', /pointLevel|tier\.name/.test(identitas), false);

  const emblem = fs.readFileSync(
    path.join('src', 'components', 'dashboard', 'shared', 'TierEmblem.jsx'),
    'utf8',
  );
  check('lambang punya alt text tier', emblem.includes('Simbol tier ${name}'), true);
  check('punya label cadangan', emblem.includes('Simbol tier belum tersedia'), true);
  check('menangani gagal muat', emblem.includes('onError'), true);
  check('dimensi ditulis eksplisit',
    /width=\{UKURAN_INTRINSIK\}[\s\S]{0,60}height=\{UKURAN_INTRINSIK\}/.test(emblem), true);
  // Ukuran kotaknya harus milik stylesheet: menyetelnya inline akan mengalahkan
  // media query dan membuat crest berukuran sama di ponsel maupun desktop.
  check('ukuran tidak disetel lewat gaya inline', emblem.includes("'--tier-emblem-size'"), false);
  check('memakai pemetaan terpusat', emblem.includes("from '@/lib/santriTier'"), true);
}
console.log('');

console.log(`lulus: ${lulus}, gagal: ${gagal}`);
process.exit(gagal === 0 ? 0 : 1);
