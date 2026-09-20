// Satu-satunya tempat yang memetakan nama tier ke berkas lambangnya.
//
// Nama-namanya tidak ditulis ulang di sini: ia diambil dari konfigurasi level
// bawaan di santriLevel.js, supaya urutan dan ejaannya tidak pernah bisa
// menyimpang dari yang dipakai resolver poin. Menambah tier cukup dilakukan di
// sana, lalu menaruh berkas gambarnya.
//
// Nama berkas diturunkan dari nama tier, bukan didaftar satu per satu:
// "Gold IV" -> "gold-iv.webp", "Elite Heroic" -> "elite-heroic.webp".

// Impor relatif, bukan lewat alias @, supaya berkas ini juga bisa dimuat langsung
// oleh skrip Node yang membangun berkas lambangnya.
import { createDefaultSantriLevelConfig } from './santriLevel.js';

export const TIER_ASSET_DIR = '/assets/tiers';

export const tierAssetBasename = (name) => String(name || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '-');

const defaultLevels = createDefaultSantriLevelConfig().male;

export const SANTRI_TIER_DEFINITIONS = defaultLevels.map((level, index) => ({
  order: index + 1,
  name: level.name,
  min: level.min,
  max: level.max,
}));

export const SANTRI_TIER_ASSETS = Object.freeze(
  Object.fromEntries(
    SANTRI_TIER_DEFINITIONS.map((tier) => [
      tier.name.toLowerCase(),
      `${TIER_ASSET_DIR}/${tierAssetBasename(tier.name)}.webp`,
    ]),
  ),
);

// Label dari basis data bisa datang dengan spasi berlebih atau huruf besar yang
// berbeda, jadi pencocokannya dinormalkan lebih dulu. Label yang tidak dikenal
// memulangkan null, dan pemanggilnya yang memutuskan mau menampilkan apa.
export const getSantriTierAsset = (tierName) => {
  const kunci = String(tierName || '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!kunci) return null;
  return SANTRI_TIER_ASSETS[kunci] || null;
};

// Tier diambil dari levelInfo yang sudah diresolusi di tempat lain, karena di
// situlah konfigurasi putra dan putri serta poin santri sudah diperhitungkan.
// Nama level yang tidak punya lambang tetap dipulangkan apa adanya supaya kartu
// LEVEL tetap menampilkannya; yang kosong hanya lambangnya.
export const resolveSantriTier = (levelInfo) => {
  const name = levelInfo?.label || levelInfo?.name || null;
  const asset = getSantriTierAsset(name);
  return {
    name: name || null,
    asset,
    accentColor: levelInfo?.accentColor || levelInfo?.color || null,
  };
};
