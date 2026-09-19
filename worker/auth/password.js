// Verifikasi password dan jalur pemindahan bcrypt ke PBKDF2.
//
// 602 akun warisan Supabase memakai bcrypt $2a$ cost 10, yang menghabiskan sekitar 50 ms
// CPU per verifikasi. Paket Workers Free hanya memberi 10 ms CPU per request, jadi jalur
// bcrypt mensyaratkan Workers Paid. Setelah sebuah akun login sekali, password-nya
// disimpan ulang sebagai PBKDF2 dan bcrypt tidak pernah dipanggil lagi untuk akun itu.
//
// PBKDF2 dipilih karena WebCrypto menyediakannya secara native, tanpa dependensi tambahan.

import bcrypt from 'bcryptjs';

export const PBKDF2_ITERATIONS = 100000;
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
    // Iterasi yang tertinggal dari standar sekarang juga memicu penyimpanan ulang.
    const iterations = Number(String(stored).split('$')[2]);
    return { valid, algorithm, needsRehash: valid && iterations < PBKDF2_ITERATIONS };
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
