// Dua jalur login yang berbeda sifatnya.
//
// Santri (551 akun aktif) masuk dengan nama panggilan atau nomor induk, dan nomor induk
// itu sendiri yang berlaku sebagai kata sandi. Ini bukan rahasia: nomor induk tercetak di
// kartu dan nama panggilan diketahui teman sekelas. Sistem lama sudah bekerja begitu —
// Edge Function-nya bahkan menyetel ulang password Supabase menjadi nomor induk ketika
// keduanya berbeda. Di sini sifat itu dinyatakan terang-terangan alih-alih disamarkan
// sebagai password yang di-hash, sehingga tidak ada yang keliru mengira ia terlindungi.
//
// Karena kredensialnya bisa ditebak, pembatasan percobaan adalah satu-satunya penjaga
// yang nyata di jalur ini, dan karenanya wajib.
//
// Guru dan admin (29 akun) memakai password sungguhan dengan bcrypt atau PBKDF2.

import { rehashToPbkdf2, verifyPassword } from './password.js';

const RATE_LIMIT = { maxAttempts: 5, windowSeconds: 300, blockSeconds: 900 };

const nowIso = () => new Date().toISOString();

export const normalizeNomorInduk = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  return trimmed;
};

export const sha256Hex = async (value) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

// Terjemahan consume_auth_rate_limit. Jendela bergulir per kombinasi tujuan, IP, dan alias;
// setelah ambang terlampaui, kombinasi itu diblokir selama blockSeconds.
export const consumeRateLimit = async (db, { purpose, ipHash, aliasHash }, options = {}) => {
  const { maxAttempts, windowSeconds, blockSeconds } = { ...RATE_LIMIT, ...options };
  if (!purpose || !ipHash || !aliasHash) throw new Error('purpose, ipHash, dan aliasHash wajib diisi.');

  const now = Date.now();
  const nowText = new Date(now).toISOString();

  await db
    .prepare(`insert or ignore into "auth_rate_limits"
                ("id", "purpose", "ip_hash", "alias_hash", "window_start", "attempts", "created_at", "updated_at")
              values (?, ?, ?, ?, ?, 0, ?, ?)`)
    .bind(crypto.randomUUID(), purpose, ipHash, aliasHash, nowText, nowText, nowText)
    .run();

  const row = await db
    .prepare(`select "id", "window_start", "attempts", "blocked_until"
                from "auth_rate_limits"
               where "purpose" = ? and "ip_hash" = ? and "alias_hash" = ?`)
    .bind(purpose, ipHash, aliasHash)
    .first();

  if (row?.blocked_until && Date.parse(row.blocked_until) > now) {
    return { allowed: false, blockedUntil: row.blocked_until, attempts: row.attempts };
  }

  const windowExpired = !row?.window_start || Date.parse(row.window_start) < now - windowSeconds * 1000;
  if (windowExpired) {
    await db
      .prepare('update "auth_rate_limits" set "window_start" = ?, "attempts" = 1, "blocked_until" = null, "updated_at" = ? where "id" = ?')
      .bind(nowText, nowText, row.id)
      .run();
    return { allowed: true, blockedUntil: null, attempts: 1 };
  }

  const attempts = (row.attempts ?? 0) + 1;
  const blockedUntil = attempts > maxAttempts ? new Date(now + blockSeconds * 1000).toISOString() : null;
  await db
    .prepare('update "auth_rate_limits" set "attempts" = ?, "blocked_until" = ?, "updated_at" = ? where "id" = ?')
    .bind(attempts, blockedUntil, nowText, row.id)
    .run();

  return { allowed: blockedUntil === null, blockedUntil, attempts };
};

export const recordLoginAttempt = async (db, { userId = null, role = null, usernameAttempt = null, status, request = null }) => {
  await db
    .prepare(`insert into "login_logs" ("id", "user_id", "role", "username_attempt", "status", "ip_address", "country", "user_agent", "created_at")
              values (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID(),
      userId,
      role,
      usernameAttempt,
      status,
      request?.headers.get('cf-connecting-ip') ?? null,
      request?.cf?.country ?? null,
      request?.headers.get('user-agent') ?? null,
      nowIso(),
    )
    .run();
};

const activeProfile = async (db, userId) =>
  db.prepare('select "id", "role", "status" from "user_profiles" where "id" = ? and "status" = ? limit 1')
    .bind(userId, 'active')
    .first();

// Santri: identitas dicocokkan lewat alias nomor induk atau nama panggilan, lalu nomor
// induk yang diketik dibandingkan dengan yang tersimpan. Tidak ada hash sama sekali.
export const loginSantri = async (db, { identifier, nomorInduk }) => {
  const normalizedInput = normalizeNomorInduk(nomorInduk);
  const typedIdentifier = typeof identifier === 'string' ? identifier.trim() : '';
  if (!normalizedInput || !typedIdentifier) return { ok: false, reason: 'invalid_input' };

  // Calon akun dicari dari identitas yang DIKETIK, bukan dari nomor induk yang dikirim.
  // Kalau pencarian memakai nomor induk, pencocokan berikutnya membandingkan nilai itu
  // dengan dirinya sendiri dan selalu lolos: siapa pun yang tahu nomor induk seseorang
  // bisa masuk sebagai orang itu, berapa pun nama panggilan yang diketik.
  //
  // Sistem lama memang berperilaku begitu. Di sini disengaja diperketat: nama panggilan
  // dan nomor induk harus merujuk akun yang sama.
  const candidates = [];
  const byAlias = await db
    .prepare(`select "auth_user_id" from "auth_login_aliases"
               where "alias_type" = ? and "normalized_alias" = ? and "is_active" = 1 limit 1`)
    .bind('nomor_induk_qiroati', typedIdentifier)
    .first();
  if (byAlias?.auth_user_id) candidates.push(byAlias.auth_user_id);

  // Nama panggilan tidak unik, jadi hasilnya bisa lebih dari satu dan seluruhnya diuji.
  const rows = await db
    .prepare('select "id" from "santri" where lower("nama_panggilan") = lower(?) and "deleted_at" is null limit 10')
    .bind(typedIdentifier)
    .all();
  for (const row of rows.results ?? []) {
    if (!candidates.includes(row.id)) candidates.push(row.id);
  }

  for (const userId of candidates) {
    const profile = await activeProfile(db, userId);
    if (!profile || profile.role !== 'santri') continue;

    const santri = await db
      .prepare('select "id", "nomor_induk_qiroati" from "santri" where "id" = ? limit 1')
      .bind(userId)
      .first();
    const stored = normalizeNomorInduk(santri?.nomor_induk_qiroati ?? '');
    if (stored && stored === normalizedInput) return { ok: true, userId, role: 'santri' };
  }

  return { ok: false, reason: 'invalid_credentials' };
};

// Guru dan admin: password sungguhan, dengan pemindahan ke PBKDF2 setelah berhasil.
export const loginStaff = async (db, { email, password }) => {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail || typeof password !== 'string' || password === '') {
    return { ok: false, reason: 'invalid_input' };
  }

  const user = await db
    .prepare('select "id", "encrypted_password", "password_algorithm", "banned_until" from "users" where lower("email") = ? and "deleted_at" is null limit 1')
    .bind(normalizedEmail)
    .first();
  if (!user) return { ok: false, reason: 'invalid_credentials' };
  if (user.banned_until && Date.parse(user.banned_until) > Date.now()) return { ok: false, reason: 'banned' };

  const profile = await activeProfile(db, user.id);
  if (!profile || !['guru', 'admin', 'pentashih'].includes(profile.role)) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  const result = await verifyPassword(password, user.encrypted_password, user.password_algorithm);
  if (!result.valid) return { ok: false, reason: 'invalid_credentials' };

  if (result.needsRehash) await rehashToPbkdf2(db, user.id, password);
  return { ok: true, userId: user.id, role: profile.role, rehashed: result.needsRehash };
};
