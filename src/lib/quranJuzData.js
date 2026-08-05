/**
 * quranJuzData.js — Referensi statis Al-Qur'an untuk fitur Tahfizh PTPT.
 *
 * Menyediakan daftar surah yang berada pada setiap Juz (1-30) dan daftar
 * label Juz untuk checklist admin. Data ini adalah referensi pembagian Juz
 * Al-Qur'an yang tetap (bukan data dinamis dari Supabase), sehingga aman
 * di-hardcode sebagai konstanta.
 */

/** Label Juz 1-30 dalam bentuk "Juz N" (dipakai checklist admin & array juz_hafalan). */
export const ALL_JUZ = Array.from({ length: 30 }, (_, index) => `Juz ${index + 1}`);

/**
 * Surah-surah yang tercakup pada tiap Juz (1-30).
 * Penulisan nama mengikuti gaya yang dipakai migration kurikulum PTPT.
 */
export const JUZ_SURAH_MAP = {
  1: ['Al-Fatihah', 'Al-Baqarah'],
  2: ['Al-Baqarah'],
  3: ['Al-Baqarah', "Ali 'Imran"],
  4: ["Ali 'Imran", "An-Nisa'"],
  5: ["An-Nisa'"],
  6: ["An-Nisa'", "Al-Ma'idah"],
  7: ["Al-Ma'idah", "Al-An'am"],
  8: ["Al-An'am", "Al-A'raf"],
  9: ["Al-A'raf", 'Al-Anfal'],
  10: ['Al-Anfal', 'At-Taubah'],
  11: ['At-Taubah', 'Yunus', 'Hud'],
  12: ['Hud', 'Yusuf'],
  13: ['Yusuf', "Ar-Ra'd", 'Ibrahim'],
  14: ['Al-Hijr', 'An-Nahl'],
  15: ["Al-Isra'", 'Al-Kahf'],
  16: ['Al-Kahf', 'Maryam', 'Thaha'],
  17: ["Al-Anbiya'", 'Al-Hajj'],
  18: ["Al-Mu'minun", 'An-Nur', 'Al-Furqan'],
  19: ['Al-Furqan', "Asy-Syu'ara'", 'An-Naml'],
  20: ['An-Naml', 'Al-Qasas'],
  21: ["Al-'Ankabut", 'Ar-Rum', 'Luqman', 'As-Sajdah'],
  22: ['Al-Ahzab', "Saba'", 'Fatir', 'Ya-Sin'],
  23: ['Ya-Sin', 'As-Saffat', 'Sad', 'Az-Zumar'],
  24: ['Az-Zumar', 'Ghafir', 'Fussilat'],
  25: ['Fussilat', 'Asy-Syura', 'Az-Zukhruf', 'Ad-Dukhan', 'Al-Jatsiyah', 'Al-Ahqaf'],
  26: ['Muhammad', 'Al-Fath', 'Al-Hujurat', 'Qaf', 'Adz-Dzariyat'],
  27: ['At-Tur', 'An-Najm', 'Al-Qamar', 'Ar-Rahman', 'Al-Waqi\'ah', 'Al-Hadid'],
  28: ['Al-Mujadilah', 'Al-Hashr', 'Al-Mumtahanah', 'As-Saff', "Al-Jumu'ah", 'Al-Munafiqun', 'At-Taghabun', 'At-Talaq', 'At-Tahrim'],
  29: ['Al-Mulk', 'Al-Qalam', 'Al-Haqqah', "Al-Ma'arij", 'Nuh', 'Al-Jinn', 'Al-Muzzammil', 'Al-Muddaththir', 'Al-Qiyamah', 'Al-Insan', 'Al-Mursalat'],
  30: ["An-Naba'", "An-Nazi'at", "'Abasa", 'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin', 'Al-Inshiqaq', 'Al-Buruj', "At-Tariq", "Al-A'la", 'Al-Ghashiyah', 'Al-Fajr', 'Al-Balad', 'Ash-Shams', 'Al-Lail', 'Ad-Duha', 'Ash-Sharh', 'At-Tin', "Al-'Alaq", 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', "Al-'Adiyat", "Al-Qari'ah", 'At-Takathur', "Al-'Asr", 'Al-Humazah', 'Al-Fil', 'Quraysh', "Al-Ma'un", 'Al-Kawthar', 'Al-Kafirun', 'An-Nasr', 'Al-Masad', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas'],
};

/** Ambil nomor Juz dari label "Juz N". Kembalikan null bila bukan format valid. */
export const parseJuzNumber = (label) => {
  const match = String(label || '').trim().match(/^juz\s+(\d{1,2})$/i);
  return match ? Number(match[1]) : null;
};

/** Daftar surah pada sebuah Juz — menerima "Juz 5" atau angka 5. */
export const getSurahNamesForJuz = (juz) => {
  const number = typeof juz === 'number' ? juz : parseJuzNumber(juz);
  return number && JUZ_SURAH_MAP[number] ? JUZ_SURAH_MAP[number] : [];
};

/** Normalisasi daftar juz_hafalan (array teks) menjadi array angka Juz yang valid & unik. */
export const normalizeJuzHafalan = (juzList = []) => {
  const numbers = (Array.isArray(juzList) ? juzList : [])
    .map(parseJuzNumber)
    .filter((number) => number !== null && number >= 1 && number <= 30);
  return [...new Set(numbers)].sort((a, b) => a - b);
};

/** Ubah array angka Juz menjadi label "Juz N" yang terurut. */
export const juzNumbersToLabels = (numbers = []) =>
  normalizeJuzHafalan(numbers.map((number) => `Juz ${number}`)).map((number) => `Juz ${number}`);
