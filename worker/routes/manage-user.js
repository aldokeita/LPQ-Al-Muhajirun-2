// Pengelolaan akun, menggantikan Edge Function manage-user.
//
// Enam aksi: create, update, deactivate, archive, restore, delete. Seluruhnya khusus admin,
// sama seperti sebelumnya.
//
// Perbedaan mendasar dari versi Supabase: tidak ada auth.admin. Akun dibuat sebagai baris
// di tabel users, pemblokiran ditulis ke banned_until, dan penghapusan mengandalkan
// ON DELETE CASCADE. Karena D1 punya batch bertransaksi, pembuatan akun tidak lagi perlu
// menghapus akun yang terlanjur jadi ketika langkah berikutnya gagal — seluruhnya batal
// bersama.
//
// Satu langkah lama yang sengaja ditinggalkan: menyelaraskan password santri dengan nomor
// induknya. Login santri sekarang membandingkan nomor induk langsung dari tabel santri,
// jadi tidak ada password yang perlu diselaraskan.

import { createAuthContext, currentUserRole } from '../auth/predicates.js';
import { hashPbkdf2 } from '../auth/password.js';
import { readSessionCookie, verifySession } from '../auth/session.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const ok = (data, status = 200) => json({ ok: true, data }, status);
const fail = (code, message, status = 400) => json({ ok: false, error: { code, message } }, status);

const nowIso = () => new Date().toISOString();
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value ?? {}, key);
const internalEmailFor = (userId) => `santri+${userId}@auth.lpqalmuhajirun.local`;

// Pemblokiran seratus tahun, meniru ban_duration 876000h di Supabase.
const BAN_UNTIL = () => new Date(Date.now() + 876000 * 60 * 60 * 1000).toISOString();

const VALID_ACTIONS = new Set(['create', 'update', 'deactivate', 'archive', 'restore', 'delete']);
const VALID_ROLES = new Set(['santri', 'guru', 'pentashih', 'admin']);

class ManageUserError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const requireText = (value, label) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new ManageUserError('VALIDATION_ERROR', `${label} wajib diisi.`);
  return text;
};

const normalizeNomorInduk = (value) => {
  if (typeof value !== 'string') throw new ManageUserError('VALIDATION_ERROR', 'Nomor Induk Qiroati wajib diisi.');
  const trimmed = value.trim();
  if (!trimmed) throw new ManageUserError('VALIDATION_ERROR', 'Nomor Induk Qiroati wajib diisi.');
  if (/\s/.test(trimmed)) throw new ManageUserError('VALIDATION_ERROR', 'Nomor Induk Qiroati tidak boleh mengandung spasi.');
  return trimmed;
};

const normalizeOptionalNomorInduk = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/\s/.test(trimmed)) throw new ManageUserError('VALIDATION_ERROR', 'Nomor Induk Qiroati tidak boleh mengandung spasi.');
  return trimmed;
};

const normalizeSantriCategory = (value) => {
  const normalized = String(value ?? 'Anak').trim().toLowerCase();
  if (normalized === 'anak' || normalized === 'tpq') return 'Anak';
  if (normalized === 'ptpt') return 'PTPT';
  if (normalized === 'dewasa') return 'Dewasa';
  throw new ManageUserError('INVALID_SANTRI_CATEGORY', 'Kategori santri harus TPQ, PTPT, atau Dewasa.');
};

const boolToInt = (value) => (value ? 1 : 0);

const insertStatement = (db, table, row) => {
  const columns = Object.keys(row);
  return db
    .prepare(`insert into "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) values (${columns.map(() => '?').join(', ')})`)
    .bind(...columns.map((c) => row[c]));
};

const updateStatement = (db, table, id, values) => {
  const columns = Object.keys(values);
  return db
    .prepare(`update "${table}" set ${columns.map((c) => `"${c}" = ?`).join(', ')} where "id" = ?`)
    .bind(...columns.map((c) => values[c]), id);
};

// --- create --------------------------------------------------------------------------

const createUser = async (db, actorId, { role, profile, initialPassword }) => {
  const displayName = requireText(profile.nama_lengkap ?? profile.nama, 'Nama');
  const password = requireText(initialPassword, 'Password awal');
  const santriCategory = role === 'santri' ? normalizeSantriCategory(profile.kategori) : null;
  const isAdultSantri = role === 'santri' && santriCategory === 'Dewasa';
  const nomorInduk = role === 'santri'
    ? (isAdultSantri ? normalizeOptionalNomorInduk(profile.nomor_induk_qiroati) : normalizeNomorInduk(profile.nomor_induk_qiroati))
    : null;

  if (nomorInduk) {
    const existing = await db
      .prepare(`select "id" from "auth_login_aliases" where "alias_type" = 'nomor_induk_qiroati' and "normalized_alias" = ? limit 1`)
      .bind(nomorInduk)
      .first();
    if (existing) throw new ManageUserError('DUPLICATE_NOMOR_INDUK', 'Nomor Induk Qiroati sudah digunakan.', 409);
  }

  const userId = crypto.randomUUID();
  const email = role === 'santri' ? internalEmailFor(userId) : requireText(profile.email, 'Email');
  const timestamp = nowIso();
  const statements = [];

  statements.push(insertStatement(db, 'users', {
    id: userId,
    email,
    encrypted_password: await hashPbkdf2(password),
    password_algorithm: 'pbkdf2',
    email_confirmed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  statements.push(insertStatement(db, 'user_profiles', {
    id: userId,
    role,
    display_name: displayName,
    email: role === 'santri' ? null : email,
    phone: profile.no_hp ?? profile.no_hp_ortu ?? null,
    status: 'active',
    created_by: actorId,
    updated_by: actorId,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  if (role === 'santri') {
    statements.push(insertStatement(db, 'santri', {
      id: userId,
      nomor_induk_qiroati: nomorInduk,
      nama_lengkap: displayName,
      nama_panggilan: profile.nama_panggilan ?? null,
      kategori: santriCategory,
      jenis_kelamin: profile.jenis_kelamin ?? null,
      tanggal_lahir: profile.tanggal_lahir ?? null,
      tempat_lahir: profile.tempat_lahir ?? null,
      tanggal_pendaftaran: profile.tanggal_pendaftaran ?? null,
      nama_ayah: profile.nama_ayah ?? null,
      nama_ibu: profile.nama_ibu ?? null,
      alamat: profile.alamat ?? null,
      no_hp_ortu: profile.no_hp_ortu ?? null,
      no_kk: profile.no_kk ?? null,
      no_nik: profile.no_nik ?? null,
      rfid_tag: profile.rfid_tag ?? null,
      sesi_mengaji: profile.sesi_mengaji ?? null,
      jilid: profile.jilid ?? null,
      foto_url: profile.foto_url ?? null,
      avatar_path: profile.avatar_path ?? null,
      berkas_foto: boolToInt(profile.berkas_foto),
      berkas_akta: boolToInt(profile.berkas_akta),
      berkas_kk: boolToInt(profile.berkas_kk),
      berkas_form: boolToInt(profile.berkas_form),
      link_qiroati: profile.link_qiroati ?? null,
      default_spp_amount: profile.default_spp_amount ?? null,
      points: profile.points ?? 0,
      current_class_id: profile.current_class_id ?? null,
      status: 'Aktif',
      created_by: actorId,
      updated_by: actorId,
      created_at: timestamp,
      updated_at: timestamp,
    }));

    if (nomorInduk) {
      statements.push(insertStatement(db, 'auth_login_aliases', {
        id: crypto.randomUUID(),
        auth_user_id: userId,
        alias_type: 'nomor_induk_qiroati',
        alias_value: nomorInduk,
        normalized_alias: nomorInduk,
        internal_email: email,
        is_active: 1,
        created_at: timestamp,
        updated_at: timestamp,
      }));
    }
  } else {
    statements.push(insertStatement(db, 'guru', {
      id: userId,
      nama: displayName,
      email,
      no_hp: profile.no_hp ?? null,
      alamat: profile.alamat ?? null,
      foto_url: profile.avatar_path ? null : (profile.foto_url ?? null),
      avatar_path: profile.avatar_path ?? null,
      jabatan: profile.jabatan ?? null,
      roles: JSON.stringify(role === 'pentashih' ? ['Pentashih'] : []),
      status: 'active',
      created_by: actorId,
      updated_by: actorId,
      created_at: timestamp,
      updated_at: timestamp,
    }));
  }

  await db.batch(statements);
  return { user_id: userId, role };
};

// --- archive dan restore --------------------------------------------------------------

// Terjemahan set_santri_archive_state. Tiga tabel disentuh sekaligus, jadi dikirim
// sebagai satu batch.
const setSantriArchiveState = async (db, actorId, { santriId, archived, reason }) => {
  const santri = await db
    .prepare('select "id", "deleted_at" from "santri" where "id" = ? limit 1')
    .bind(santriId)
    .first();
  if (!santri) throw new ManageUserError('P0002', 'Data santri tidak ditemukan.', 404);

  const timestamp = nowIso();
  const trimmedReason = String(reason ?? '').trim();

  await db.batch([
    db.prepare(`update "santri" set "status" = ?, "deleted_at" = ?, "archive_reason" = ?, "archived_by" = ?,
                 "updated_by" = ?, "updated_at" = ? where "id" = ?`)
      .bind(
        archived ? 'Nonaktif' : 'Aktif',
        archived ? (santri.deleted_at ?? timestamp) : null,
        archived ? (trimmedReason || null) : null,
        archived ? actorId : null,
        actorId, timestamp, santriId,
      ),
    db.prepare('update "user_profiles" set "status" = ?, "updated_by" = ?, "updated_at" = ? where "id" = ?')
      .bind(archived ? 'inactive' : 'active', actorId, timestamp, santriId),
    db.prepare('update "auth_login_aliases" set "is_active" = ?, "updated_at" = ? where "auth_user_id" = ?')
      .bind(archived ? 0 : 1, timestamp, santriId),
    db.prepare('update "users" set "banned_until" = ?, "updated_at" = ? where "id" = ?')
      .bind(archived ? BAN_UNTIL() : null, timestamp, santriId),
  ]);

  const after = await db
    .prepare('select "id", "status", "current_class_id" from "santri" where "id" = ? limit 1')
    .bind(santriId)
    .first();

  return { user_id: santriId, archived, current_class_id: after?.current_class_id ?? null };
};

// --- update ---------------------------------------------------------------------------

const SANTRI_FIELDS = [
  'nama_lengkap', 'nama_panggilan', 'kategori', 'jenis_kelamin', 'tanggal_lahir', 'tempat_lahir',
  'tanggal_pendaftaran', 'nama_ayah', 'nama_ibu', 'alamat', 'no_hp_ortu', 'no_kk', 'no_nik',
  'rfid_tag', 'current_class_id', 'sesi_mengaji', 'jilid', 'foto_url', 'avatar_path',
  'berkas_foto', 'berkas_akta', 'berkas_kk', 'berkas_form', 'link_qiroati', 'default_spp_amount',
  'status', 'points', 'order_in_class',
];
const BOOLEAN_SANTRI_FIELDS = new Set(['berkas_foto', 'berkas_akta', 'berkas_kk', 'berkas_form']);

const updateSantri = async (db, actorId, targetUserId, profile) => {
  const updates = { updated_by: actorId, updated_at: nowIso() };
  for (const field of SANTRI_FIELDS) {
    if (!hasOwn(profile, field)) continue;
    updates[field] = BOOLEAN_SANTRI_FIELDS.has(field) ? boolToInt(profile[field]) : (profile[field] ?? null);
  }
  if (hasOwn(profile, 'kategori')) updates.kategori = normalizeSantriCategory(profile.kategori);

  const statements = [];

  if (hasOwn(profile, 'nomor_induk_qiroati')) {
    let effectiveCategory = hasOwn(profile, 'kategori') ? normalizeSantriCategory(profile.kategori) : null;
    if (!effectiveCategory) {
      const current = await db.prepare('select "kategori" from "santri" where "id" = ? limit 1').bind(targetUserId).first();
      effectiveCategory = normalizeSantriCategory(current?.kategori);
    }
    const nomorInduk = effectiveCategory === 'Dewasa'
      ? normalizeOptionalNomorInduk(profile.nomor_induk_qiroati)
      : normalizeNomorInduk(profile.nomor_induk_qiroati);

    if (!nomorInduk) {
      updates.nomor_induk_qiroati = null;
      statements.push(
        db.prepare(`delete from "auth_login_aliases" where "auth_user_id" = ? and "alias_type" = 'nomor_induk_qiroati'`)
          .bind(targetUserId),
      );
    } else {
      const duplicate = await db
        .prepare(`select "auth_user_id" from "auth_login_aliases"
                   where "alias_type" = 'nomor_induk_qiroati' and "normalized_alias" = ? and "auth_user_id" <> ? limit 1`)
        .bind(nomorInduk, targetUserId)
        .first();
      if (duplicate) throw new ManageUserError('DUPLICATE_NOMOR_INDUK', 'Nomor Induk Qiroati sudah digunakan.', 409);

      updates.nomor_induk_qiroati = nomorInduk;

      const existingAlias = await db
        .prepare(`select "id", "internal_email" from "auth_login_aliases"
                   where "auth_user_id" = ? and "alias_type" = 'nomor_induk_qiroati' and "is_active" = 1 limit 1`)
        .bind(targetUserId)
        .first();

      const internalEmail = existingAlias?.internal_email ?? internalEmailFor(targetUserId);
      const timestamp = nowIso();
      statements.push(existingAlias
        ? updateStatement(db, 'auth_login_aliases', existingAlias.id, {
          alias_value: nomorInduk, normalized_alias: nomorInduk, internal_email: internalEmail,
          is_active: 1, updated_at: timestamp,
        })
        : insertStatement(db, 'auth_login_aliases', {
          id: crypto.randomUUID(), auth_user_id: targetUserId, alias_type: 'nomor_induk_qiroati',
          alias_value: nomorInduk, normalized_alias: nomorInduk, internal_email: internalEmail,
          is_active: 1, created_at: timestamp, updated_at: timestamp,
        }));
    }
  }

  const existing = await db.prepare('select "id" from "santri" where "id" = ? limit 1').bind(targetUserId).first();
  if (!existing) throw new ManageUserError('SANTRI_UPDATE_FAILED', 'Data santri gagal diperbarui.');

  statements.push(updateStatement(db, 'santri', targetUserId, updates));

  const profileUpdate = { updated_by: actorId, updated_at: nowIso() };
  if (hasOwn(profile, 'nama_lengkap')) profileUpdate.display_name = profile.nama_lengkap;
  if (hasOwn(profile, 'no_hp_ortu')) profileUpdate.phone = profile.no_hp_ortu;
  if (hasOwn(profile, 'status')) {
    profileUpdate.status = String(profile.status).toLowerCase() === 'nonaktif' ? 'inactive' : 'active';
  }
  statements.push(updateStatement(db, 'user_profiles', targetUserId, profileUpdate));

  await db.batch(statements);
  return { user_id: targetUserId, updated: true };
};

// --- router ----------------------------------------------------------------------------

// Reset password oleh admin, menggantikan Edge Function reset-user-password.
//
// Password baru selalu disimpan sebagai PBKDF2, bukan bcrypt, sehingga akun yang
// di-reset tidak pernah menambah beban bcrypt di kemudian hari.
const resetPassword = async (db, { targetUserId, newPassword }) => {
  const target = requireText(targetUserId, 'Target user id');
  const password = requireText(newPassword, 'Password baru');
  if (password.length < 8) throw new ManageUserError('WEAK_PASSWORD', 'Password baru minimal 8 karakter.');

  const user = await db.prepare('select "id" from "users" where "id" = ? limit 1').bind(target).first();
  if (!user) throw new ManageUserError('RESET_PASSWORD_FAILED', 'Password gagal direset.');

  await db
    .prepare('update "users" set "encrypted_password" = ?, "password_algorithm" = ?, "updated_at" = ? where "id" = ?')
    .bind(await hashPbkdf2(password), 'pbkdf2', nowIso(), target)
    .run();

  return { target_user_id: target, password_updated: true };
};

export const handleResetPassword = async (request, env, url) => {
  if (url.pathname !== '/api/reset-user-password') return null;
  if (request.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.', 405);

  const payload = await verifySession(env.SESSION_SECRET, readSessionCookie(request));
  if (!payload) return fail('UNAUTHORIZED', 'Session tidak valid.', 401);

  const ctx = createAuthContext(env.DB, payload.sub);
  if ((await currentUserRole(ctx)) !== 'admin') return fail('FORBIDDEN', 'Akses ditolak.', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('VALIDATION_ERROR', 'Body harus berupa JSON.');
  }

  try {
    return ok(await resetPassword(env.DB, {
      targetUserId: body.target_user_id,
      newPassword: body.new_password,
    }));
  } catch (error) {
    if (error instanceof ManageUserError) return fail(error.code, error.message, error.status);
    console.error('[reset-user-password] gagal:', error.message);
    return fail('RESET_PASSWORD_FAILED', 'Password gagal direset.');
  }
};

export const handleManageUser = async (request, env, url) => {
  if (url.pathname !== '/api/manage-user') return null;
  if (request.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.', 405);

  const payload = await verifySession(env.SESSION_SECRET, readSessionCookie(request));
  if (!payload) return fail('UNAUTHORIZED', 'Session tidak valid.', 401);

  const ctx = createAuthContext(env.DB, payload.sub);
  if ((await currentUserRole(ctx)) !== 'admin') return fail('FORBIDDEN', 'Akses ditolak.', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('VALIDATION_ERROR', 'Body harus berupa JSON.');
  }

  try {
    const action = requireText(body.action, 'Action');
    if (!VALID_ACTIONS.has(action)) return fail('VALIDATION_ERROR', 'Action tidak valid.');
    const role = requireText(body.role, 'Role');
    if (!VALID_ROLES.has(role)) return fail('VALIDATION_ERROR', 'Role tidak valid.');
    const profile = body.profile ?? {};

    if (action === 'create') {
      return ok(await createUser(env.DB, payload.sub, { role, profile, initialPassword: body.initial_password }), 201);
    }

    const targetUserId = requireText(body.target_user_id, 'Target user id');

    if (role === 'santri' && ['deactivate', 'archive', 'restore'].includes(action)) {
      const archived = action !== 'restore';
      return ok(await setSantriArchiveState(env.DB, payload.sub, {
        santriId: targetUserId,
        archived,
        reason: body.reason ?? (archived ? 'Diarsipkan oleh admin' : null),
      }));
    }

    if (['archive', 'restore'].includes(action)) {
      return fail('VALIDATION_ERROR', 'Arsip dan pemulihan akun hanya tersedia untuk santri.');
    }

    // Penghapusan permanen mengandalkan ON DELETE CASCADE dari users ke tabel terkait.
    if (action === 'delete') {
      if (role !== 'santri') return fail('VALIDATION_ERROR', 'Penghapusan permanen hanya tersedia untuk santri.');
      await env.DB.prepare('delete from "users" where "id" = ?').bind(targetUserId).run();
      return ok({ user_id: targetUserId, deleted: true });
    }

    if (action === 'deactivate') {
      const timestamp = nowIso();
      await env.DB.batch([
        env.DB.prepare('update "user_profiles" set "status" = ?, "updated_by" = ?, "updated_at" = ? where "id" = ?')
          .bind('inactive', payload.sub, timestamp, targetUserId),
        env.DB.prepare('update "users" set "banned_until" = ?, "updated_at" = ? where "id" = ?')
          .bind(BAN_UNTIL(), timestamp, targetUserId),
      ]);
      return ok({ user_id: targetUserId, deactivated: true });
    }

    if (role === 'santri') return ok(await updateSantri(env.DB, payload.sub, targetUserId, profile));

    await env.DB
      .prepare('update "user_profiles" set "display_name" = ?, "updated_by" = ?, "updated_at" = ? where "id" = ?')
      .bind(profile.display_name ?? null, payload.sub, nowIso(), targetUserId)
      .run();
    return ok({ user_id: targetUserId, updated: true });
  } catch (error) {
    if (error instanceof ManageUserError) return fail(error.code, error.message, error.status);
    console.error('[manage-user] gagal:', error.message);
    return fail('MANAGE_USER_FAILED', 'Operasi akun gagal.');
  }
};
