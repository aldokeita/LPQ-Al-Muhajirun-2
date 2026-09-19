// RPC perpindahan kelas, diterjemahkan dari plpgsql.
//
// Perpindahan menyentuh tiga tabel sekaligus: keanggotaan lama ditutup, keanggotaan baru
// dibuka, data santri disinkronkan, dan mutasinya dicatat. Semuanya dikirim sebagai satu
// batch D1 agar tidak ada keadaan setengah jadi — santri yang kehilangan kelas lama tanpa
// mendapat kelas baru adalah kerusakan yang sulit ditelusuri belakangan.

import { currentUserRole } from '../auth/predicates.js';
import { RpcError } from './santri.js';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const todayWib = () => new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

const ACTIVE_STATUSES = new Set(['aktif', 'active']);
const isActiveStatus = (status) => ACTIVE_STATUSES.has(String(status ?? '').trim().toLowerCase());

const countActiveMemberships = async (db, santriId) => {
  const row = await db
    .prepare(`select count(*) as n from "class_memberships" where "santri_id" = ? and "status" = 'active'`)
    .bind(santriId)
    .first();
  return row?.n ?? 0;
};

const loadTargetClass = async (db, classId) => {
  const row = await db
    .prepare('select "id", "sesi", "is_active", "deleted_at" from "classes" where "id" = ? limit 1')
    .bind(classId)
    .first();
  if (!row) throw new RpcError('Kelas tujuan tidak ditemukan.', 404);
  if (row.is_active !== 1 || row.deleted_at !== null) throw new RpcError('Kelas tujuan tidak aktif.');
  return row;
};

// Keanggotaan aktif terbaru yang menentukan kelas asal.
const loadActiveMembership = async (db, santriId) =>
  db
    .prepare(`select "id", "class_id", "order_in_class" from "class_memberships"
               where "santri_id" = ? and "status" = 'active'
               order by "created_at" desc limit 1`)
    .bind(santriId)
    .first();

const nextOrderInClass = async (db, classId) => {
  const row = await db
    .prepare(`select coalesce(max("order_in_class"), 0) + 1 as n from "class_memberships"
               where "class_id" = ? and "status" = 'active'`)
    .bind(classId)
    .first();
  return row?.n ?? 1;
};

// Inti perpindahan, dipakai jalur admin maupun jalur guru.
const performMove = async (db, ctx, { santri, targetClass, fromClassId, reason, defaultReason }) => {
  const today = todayWib();
  const timestamp = nowIso();
  const order = await nextOrderInClass(db, targetClass.id);
  const membershipId = crypto.randomUUID();
  const mutationId = crypto.randomUUID();
  const trimmedReason = String(reason ?? '').trim();

  await db.batch([
    db.prepare(`update "class_memberships" set "status" = 'moved', "end_date" = ?, "updated_by" = ?, "updated_at" = ?
                 where "santri_id" = ? and "status" = 'active'`)
      .bind(today, ctx.userId, timestamp, santri.id),
    db.prepare(`insert into "class_memberships"
                 ("id", "santri_id", "class_id", "start_date", "status", "order_in_class", "created_by", "updated_by", "created_at", "updated_at")
                 values (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`)
      .bind(membershipId, santri.id, targetClass.id, today, order, ctx.userId, ctx.userId, timestamp, timestamp),
    db.prepare(`update "santri" set "current_class_id" = ?, "sesi_mengaji" = coalesce(?, "sesi_mengaji"),
                 "order_in_class" = ?, "updated_by" = ?, "updated_at" = ? where "id" = ?`)
      .bind(targetClass.id, targetClass.sesi, order, ctx.userId, timestamp, santri.id),
    db.prepare(`insert into "class_mutations"
                 ("id", "santri_id", "from_class_id", "to_class_id", "mutation_date", "reason", "created_by", "created_at")
                 values (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(mutationId, santri.id, fromClassId, targetClass.id, today, trimmedReason || defaultReason, ctx.userId, timestamp),
  ]);

  return { mutationId, order };
};

export const moveSantriToClass = async (db, ctx, { santriId, toClassId, reason = null }) => {
  if (!ctx.userId) throw new RpcError('Login diperlukan untuk memindahkan kelas santri.', 401);
  if ((await currentUserRole(ctx)) !== 'admin') {
    throw new RpcError('Hanya admin yang boleh memindahkan kelas santri.', 403);
  }
  if (!santriId) throw new RpcError('Santri wajib dipilih.');
  if (!toClassId) throw new RpcError('Kelas tujuan wajib dipilih.');

  const santri = await db
    .prepare('select "id", "status", "current_class_id", "sesi_mengaji", "order_in_class" from "santri" where "id" = ? limit 1')
    .bind(santriId)
    .first();
  if (!santri) throw new RpcError('Santri tidak ditemukan.', 404);
  if (!isActiveStatus(santri.status)) {
    throw new RpcError('Santri tidak aktif sehingga tidak dapat dipindahkan kelas.');
  }

  const targetClass = await loadTargetClass(db, toClassId);
  const membership = await loadActiveMembership(db, santriId);
  const fromClassId = membership?.class_id ?? santri.current_class_id;

  // Sudah berada di kelas tujuan: tidak ada mutasi baru, hanya penyelarasan data santri.
  if (membership && membership.class_id === toClassId) {
    await db
      .prepare(`update "santri" set "current_class_id" = ?, "sesi_mengaji" = coalesce(?, "sesi_mengaji"),
                 "order_in_class" = coalesce(?, "order_in_class"), "updated_by" = ?, "updated_at" = ? where "id" = ?`)
      .bind(toClassId, targetClass.sesi, membership.order_in_class, ctx.userId, nowIso(), santriId)
      .run();

    return {
      santri_id: santriId,
      from_class_id: fromClassId,
      to_class_id: toClassId,
      mutation_id: null,
      changed: santri.current_class_id !== toClassId,
      message: 'Santri sudah berada di kelas tujuan. Data aktif disinkronkan.',
      active_memberships: await countActiveMemberships(db, santriId),
    };
  }

  const { mutationId } = await performMove(db, ctx, {
    santri, targetClass, fromClassId, reason, defaultReason: 'Mutasi kelas oleh admin',
  });

  return {
    santri_id: santriId,
    from_class_id: fromClassId,
    to_class_id: toClassId,
    mutation_id: mutationId,
    changed: true,
    message: 'Santri berhasil dipindahkan kelas.',
    active_memberships: await countActiveMemberships(db, santriId),
  };
};

// TPQ dan ANAK adalah kategori yang sama dengan dua nama. Perbandingan kategori
// dilakukan setelah penyeragaman ini, persis seperti versi Postgres.
const normalizeCategory = (value) => {
  const upper = String(value ?? '').trim().toUpperCase();
  return upper === 'TPQ' ? 'ANAK' : upper;
};

// Keanggotaan aktif terbaru beserta guru pengampunya.
const loadMembershipWithTeacher = async (db, santriId) =>
  db
    .prepare(`select cm."id", cm."class_id", cm."order_in_class", c."id_guru"
                from "class_memberships" cm
                join "classes" c on c."id" = cm."class_id"
               where cm."santri_id" = ? and cm."status" = 'active'
               order by cm."created_at" desc limit 1`)
    .bind(santriId)
    .first();

const requireGuru = async (ctx, loginAction, roleMessage) => {
  if (!ctx.userId) throw new RpcError(`Login diperlukan untuk ${loginAction}.`, 401);
  if ((await currentUserRole(ctx)) !== 'guru') throw new RpcError(roleMessage, 403);
};

const loadSantriForTransfer = async (db, santriId, columns) => {
  const row = await db.prepare(`select ${columns} from "santri" where "id" = ? limit 1`).bind(santriId).first();
  if (!row) throw new RpcError('Santri tidak ditemukan.', 404);
  if (!isActiveStatus(row.status)) throw new RpcError('Santri tidak aktif sehingga tidak dapat ditransfer.');
  return row;
};

export const getGuruTransferClassOptions = async (db, ctx, { santriId }) => {
  await requireGuru(ctx, 'melihat pilihan kelas', 'Hanya guru pengampu yang dapat melihat pilihan transfer kelas.');
  const santri = await loadSantriForTransfer(db, santriId, '"id", "kategori", "status"');

  const membership = await loadMembershipWithTeacher(db, santriId);
  if (!membership || membership.id_guru !== ctx.userId) {
    throw new RpcError('Guru tidak memiliki akses transfer untuk santri ini.', 403);
  }

  const category = normalizeCategory(santri.kategori);
  // SQLite tidak menjamin NULLS LAST, jadi urutannya dinyatakan eksplisit.
  const result = await db
    .prepare(`select c."id" as class_id, c."nama_kelas" as class_name, c."sesi" as session_name,
                     g."nama" as teacher_name, c."kategori" as category, c."id_guru", c."sort_order"
                from "classes" c
                left join "guru" g on g."id" = c."id_guru"
               where c."is_active" = 1 and c."deleted_at" is null
                 and (case when upper(trim(coalesce(c."kategori", ''))) = 'TPQ'
                           then 'ANAK' else upper(trim(coalesce(c."kategori", ''))) end) = ?
               order by case when c."sort_order" is null then 1 else 0 end, c."sort_order",
                        case when c."sesi" is null then 1 else 0 end, c."sesi", c."nama_kelas"`)
    .bind(category)
    .all();

  return (result.results ?? []).map((row) => ({
    class_id: row.class_id,
    class_name: row.class_name,
    session_name: row.session_name,
    teacher_name: row.teacher_name,
    category: row.category,
    is_current: row.class_id === membership.class_id,
    is_selectable: row.class_id !== membership.class_id,
  }));
};

export const transferSantriToClassByGuru = async (db, ctx, { santriId, toClassId, reason = null }) => {
  await requireGuru(ctx, 'mentransfer santri', 'Hanya guru pengampu yang dapat mentransfer santri.');
  if (!santriId) throw new RpcError('Santri wajib dipilih.');
  if (!toClassId) throw new RpcError('Kelas tujuan wajib dipilih.');

  const santri = await loadSantriForTransfer(db, santriId, '"id", "nama_lengkap", "kategori", "status", "current_class_id"');

  const membership = await loadMembershipWithTeacher(db, santriId);
  if (!membership) throw new RpcError('Santri belum memiliki membership kelas aktif.', 404);
  if (membership.id_guru !== ctx.userId) {
    throw new RpcError('Guru tidak memiliki akses transfer untuk santri ini.', 403);
  }
  if (membership.class_id === toClassId) throw new RpcError('Kelas tujuan harus berbeda dari kelas asal.');

  const targetClass = await db
    .prepare('select "id", "nama_kelas", "sesi", "kategori", "is_active", "deleted_at" from "classes" where "id" = ? limit 1')
    .bind(toClassId)
    .first();
  if (!targetClass) throw new RpcError('Kelas tujuan tidak ditemukan.', 404);
  if (targetClass.is_active !== 1 || targetClass.deleted_at !== null) throw new RpcError('Kelas tujuan tidak aktif.');

  const santriCategory = normalizeCategory(santri.kategori);
  if (santriCategory === '' || normalizeCategory(targetClass.kategori) !== santriCategory) {
    throw new RpcError('Kelas tujuan harus memiliki kategori yang sama dengan santri.');
  }

  // Alasan dipotong 500 karakter, sama seperti left(btrim(p_reason), 500) di versi lama.
  const { mutationId } = await performMove(db, ctx, {
    santri,
    targetClass,
    fromClassId: membership.class_id,
    reason: String(reason ?? '').trim().slice(0, 500),
    defaultReason: 'Transfer kelas oleh guru',
  });

  return {
    santri_id: santriId,
    from_class_id: membership.class_id,
    to_class_id: toClassId,
    mutation_id: mutationId,
    changed: true,
    message: `${santri.nama_lengkap} berhasil ditransfer ke ${targetClass.nama_kelas}.`,
    active_memberships: await countActiveMemberships(db, santriId),
  };
};
