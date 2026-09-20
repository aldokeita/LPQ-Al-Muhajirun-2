// Verifikasi password dan jalur pemindahan bcrypt ke PBKDF2.
//
// PBKDF2 dipilih karena WebCrypto menyediakannya secara native, tanpa dependensi tambahan.
//
// Jumlah iterasinya ditentukan oleh anggaran CPU Workers Free: 10 ms per permintaan, dan
// permintaan login juga harus menyisakan waktu untuk membaca akun dari D1, menandatangani
// sesi, dan menyusun cookie. Hasil pengukuran: 100.000 iterasi ~12 ms, 50.000 ~6 ms,
// 30.000 ~4 ms. Angka 30.000 dipilih agar muat berikut sisa pekerjaannya.
//
// Ini memang lebih lemah dari anjuran umum untuk PBKDF2-SHA256, dan itu konsekuensi sadar
// dari bertahan di paket gratis. Yang menahan serangan tebak-menebak lewat jaringan bukan
// jumlah iterasi melainkan pembatas percobaan login di auth_rate_limits; iterasi hanya
// memperlambat penyerang yang sudah memegang salinan basis data.
//
// 602 akun warisan Supabase memakai bcrypt $2a$ cost 10, sekitar 50 ms CPU — lima kali
// anggaran itu. Jalur bcrypt tetap ada dan dilewati sekali saja per akun: begitu login
// pertama berhasil, password-nya disimpan ulang sebagai PBKDF2 dan bcrypt tidak pernah
// dipanggil lagi untuk akun tersebut.
//
// Itu bersandar pada kelonggaran yang dinyatakan dokumentasi Workers: isolate mentoleransi
// pelampauan batas yang jarang, dan baru menghentikan Worker yang melampauinya terus
// menerus. Dengan 29 akun berpassword yang masing-masing melewati bcrypt satu kali, itu
// memang jarang — tetapi kelonggarannya tidak dijamin. Kalau sebuah login gagal dengan
// Error 1102, akun itu perlu direset password-nya oleh admin, dan sesudah reset ia
// langsung tersimpan sebagai PBKDF2.
import bcrypt from 'bcryptjs';

export const PBKDF2_ITERATIONS = 30000;
const PBKDF2_HASH = 'SHA-256';
const PBKDF2_KEY_BITS = 256;
const SALT_BYTES = 16;

const toBase64 = (bytes) => {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

// Perbandingan waktu tetap: keluar lebih awal saat byte berbeda akan membocorkan
// berapa banyak byte awal yang sudah benar.
const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
};

const deriveBits = async (password, salt, iterations) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: PBKDF2_HASH },
    key,
    PBKDF2_KEY_BITS,
  );
  return new Uint8Array(bits);
};

// Format tersimpan: pbkdf2$sha256$<iterasi>$<salt base64>$<turunan base64>
export const hashPbkdf2 = async (password, iterations = PBKDF2_ITERATIONS) => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveBits(password, salt, iterations);
  return `pbkdf2$sha256$${iterations}$${toBase64(salt)}$${toBase64(derived)}`;
};

export const verifyPbkdf2 = async (password, stored) => {
  const parts = String(stored).split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 1) return false;
  const derived = await deriveBits(password, fromBase64(parts[3]), iterations);
  return timingSafeEqual(derived, fromBase64(parts[4]));
};

export const verifyBcrypt = async (password, stored) => bcrypt.compare(password, stored);

export const detectAlgorithm = (stored) => {
  if (typeof stored !== 'string' || stored === '') return null;
  if (stored.startsWith('pbkdf2$')) return 'pbkdf2';
  if (/^\$2[aby]?\$/.test(stored)) return 'bcrypt';
  return null;
};

// Memulangkan juga apakah password perlu disimpan ulang, supaya pemanggil bisa
// memindahkan akun ke PBKDF2 tepat setelah login berhasil.
export const verifyPassword = async (password, stored, declaredAlgorithm = null) => {
  const algorithm = detectAlgorithm(stored) ?? declaredAlgorithm;
  if (!algorithm) return { valid: false, algorithm: null, needsRehash: false };

  if (algorithm === 'pbkdf2') {
    const valid = await verifyPbkdf2(password, stored);
    // Iterasi yang berbeda dari angka sekarang memicu penyimpanan ulang, ke arah mana pun.
    // Bukan hanya yang terlalu rendah: hash yang tersimpan dengan iterasi lebih tinggi dari
    // anggaran akan memakan CPU berlebih di setiap login, bukan sekali saja.
    const iterations = Number(String(stored).split('$')[2]);
    return { valid, algorithm, needsRehash: valid && iterations !== PBKDF2_ITERATIONS };
  }

  const valid = await verifyBcrypt(password, stored);
  return { valid, algorithm, needsRehash: valid };
};

// Menyimpan ulang password sebagai PBKDF2. Dipanggil hanya setelah verifikasi berhasil,
// karena hash baru hanya bisa dibuat dari password asli yang baru saja terbukti benar.
export const rehashToPbkdf2 = async (db, userId, password) => {
  const stored = await hashPbkdf2(password);
  await db
    .prepare('update "users" set "encrypted_password" = ?, "password_algorithm" = ?, "updated_at" = ? where "id" = ?')
    .bind(stored, 'pbkdf2', new Date().toISOString(), userId)
    .run();
  return stored;
};
