// Sepuluh predikat yang menopang seluruh 92 policy RLS di Postgres.
//
// Setiap predikat di sini adalah terjemahan langsung dari function bersangkutan di
// supabase/migrations. Kalau salah satunya melonggar, data santri ikut terbuka —
// tidak ada lagi RLS di belakangnya sejak lepas dari Postgres.
//
// Perbedaan yang disengaja dari versi Postgres: tanggal dibandingkan dalam WIB, bukan UTC.
// current_date di Supabase mengikuti server yang berjalan UTC, sehingga jendela penugasan
// pentashih bergeser hingga tujuh jam di hari pergantian. Lembaga ini berada di WIB dan
// tanggal penugasan dimaksudkan sebagai tanggal setempat, jadi perilakunya dibetulkan.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const today = () => new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);

// Hasil predikat di-cache per request: satu permintaan bisa memeriksa santri yang sama
// berkali-kali, dan tiap pemeriksaan adalah satu query D1.
export const createAuthContext = (db, userId) => ({
  db,
  userId: userId ?? null,
  cache: new Map(),
  role: undefined,
});

const cached = async (ctx, key, resolve) => {
  if (ctx.cache.has(key)) return ctx.cache.get(key);
  const value = await resolve();
  ctx.cache.set(key, value);
  return value;
};

const exists = async (ctx, sql, params) => {
  const row = await ctx.db.prepare(sql).bind(...params).first();
  return row !== null && row !== undefined;
};

// select up.role from user_profiles up where up.id = auth.uid() and up.status = 'active'
export const currentUserRole = async (ctx) => {
  if (!ctx.userId) return null;
  if (ctx.role !== undefined) return ctx.role;
  const row = await ctx.db
    .prepare('select "role" from "user_profiles" where "id" = ? and "status" = ? limit 1')
    .bind(ctx.userId, 'active')
    .first();
  ctx.role = row?.role ?? null;
  return ctx.role;
};

const hasRole = (name) => async (ctx) => (await currentUserRole(ctx)) === name;

export const isAdmin = hasRole('admin');
export const isGuru = hasRole('guru');
export const isPentashih = hasRole('pentashih');
export const isSantri = hasRole('santri');

// select auth.uid() = target_santri_id
export const userOwnsSantriRecord = async (ctx, santriId) =>
  Boolean(ctx.userId) && ctx.userId === santriId;

export const guruHasClassAccess = async (ctx, classId) => {
  if (!ctx.userId || !classId) return false;
  return cached(ctx, `guru:class:${classId}`, () =>
    exists(
      ctx,
      'select 1 from "classes" where "id" = ? and "id_guru" = ? and "deleted_at" is null limit 1',
      [classId, ctx.userId],
    ));
};

// Guru pengampu kelas itu sendiri: classes.id_guru = auth.uid().
//
// Berbeda dari guruHasClassAccess, yang menerima id kelas lalu mencarinya di tabel
// classes. Yang ini menerima nilai kolom id_guru pada baris yang sedang diperiksa, jadi
// tidak perlu membaca apa pun — dan itu memang bunyi cabang policy aslinya, tanpa syarat
// tambahan apa pun.
export const isClassOwner = async (ctx, idGuru) =>
  Boolean(ctx.userId) && ctx.userId === idGuru;

// Baris yang ditujukan kepada pemanggil, ketika kolomnya berbeda dari kolom kepemilikan
// utama — misalnya murojaah_submissions, yang terlihat oleh santri pengirim lewat
// santri_id sekaligus oleh guru tujuan lewat target_guru_id.
export const isRecipient = async (ctx, recipientId) =>
  Boolean(ctx.userId) && ctx.userId === recipientId;

// Guru yang mengajar pemanggil: ada kelas milik guru ini yang memuat pemanggil sebagai
// santri aktif. Cabang ketiga policy guru.
export const teachesCaller = async (ctx, guruId) => {
  if (!ctx.userId || !guruId) return false;
  return cached(ctx, `guru:mengajar:${guruId}`, () =>
    exists(
      ctx,
      `select 1 from "classes" c
         join "class_memberships" cm on cm."class_id" = c."id" and cm."status" = 'active'
        where c."id_guru" = ? and cm."santri_id" = ? limit 1`,
      [guruId, ctx.userId],
    ));
};

// Pentashih yang memegang salah satu kelas guru ini. Cabang keempat policy guru.
export const pentashihOfGuru = async (ctx, guruId) => {
  if (!ctx.userId || !guruId) return false;
  return cached(ctx, `pentashih:guru:${guruId}`, () =>
    exists(
      ctx,
      `select 1 from "classes" c
         join "pentashih_class_assignments" pca on pca."class_id" = c."id"
        where c."id_guru" = ? and pca."pentashih_id" = ? and pca."is_active" = 1
          and pca."scope" in ('class', 'both')
          and (pca."starts_at" is null or pca."starts_at" <= ?)
          and (pca."ends_at" is null or pca."ends_at" >= ?)
        limit 1`,
      [guruId, ctx.userId, today(), today()],
    ));
};

// Santri yang terdaftar aktif di kelas itu. Cabang keempat policy classes.
export const santriBelongsToClass = async (ctx, classId) => {
  if (!ctx.userId || !classId) return false;
  return cached(ctx, `santri:class:${classId}`, () =>
    exists(
      ctx,
      `select 1 from "class_memberships"
        where "class_id" = ? and "santri_id" = ? and "status" = 'active' limit 1`,
      [classId, ctx.userId],
    ));
};

export const guruHasSantriAccess = async (ctx, santriId) => {
  if (!ctx.userId || !santriId) return false;
  return cached(ctx, `guru:santri:${santriId}`, () =>
    exists(
      ctx,
      `select 1
         from "class_memberships" cm
         join "classes" c on c."id" = cm."class_id"
        where cm."santri_id" = ?
          and cm."status" = 'active'
          and c."id_guru" = ?
          and c."deleted_at" is null
        limit 1`,
      [santriId, ctx.userId],
    ));
};

// scope 'both' mencakup kelas sekaligus MMQ, jadi kedua predikat menerimanya.
export const pentashihHasClassAccess = async (ctx, classId) => {
  if (!ctx.userId || !classId) return false;
  return cached(ctx, `pentashih:class:${classId}`, () =>
    exists(
      ctx,
      `select 1
         from "pentashih_class_assignments"
        where "pentashih_id" = ?
          and "class_id" = ?
          and "is_active" = 1
          and "scope" in ('class', 'both')
          and ("starts_at" is null or "starts_at" <= ?)
          and ("ends_at" is null or "ends_at" >= ?)
        limit 1`,
      [ctx.userId, classId, today(), today()],
    ));
};

export const pentashihHasMmqAccess = async (ctx, scheduleId) => {
  if (!ctx.userId || !scheduleId) return false;
  return cached(ctx, `pentashih:mmq:${scheduleId}`, () =>
    exists(
      ctx,
      `select 1
         from "pentashih_class_assignments"
        where "pentashih_id" = ?
          and "mmq_schedule_id" = ?
          and "is_active" = 1
          and "scope" in ('mmq', 'both')
          and ("starts_at" is null or "starts_at" <= ?)
          and ("ends_at" is null or "ends_at" >= ?)
        limit 1`,
      [ctx.userId, scheduleId, today(), today()],
    ));
};

// Versi Postgres memanggil pentashih_has_class_access per keanggotaan; di sini kedua
// query disatukan agar satu pemeriksaan tetap satu perjalanan ke D1.
export const pentashihHasSantriAccess = async (ctx, santriId) => {
  if (!ctx.userId || !santriId) return false;
  return cached(ctx, `pentashih:santri:${santriId}`, () =>
    exists(
      ctx,
      `select 1
         from "class_memberships" cm
         join "pentashih_class_assignments" pca on pca."class_id" = cm."class_id"
        where cm."santri_id" = ?
          and cm."status" = 'active'
          and pca."pentashih_id" = ?
          and pca."is_active" = 1
          and pca."scope" in ('class', 'both')
          and (pca."starts_at" is null or pca."starts_at" <= ?)
          and (pca."ends_at" is null or pca."ends_at" >= ?)
        limit 1`,
      [santriId, ctx.userId, today(), today()],
    ));
};

export const PREDICATES = {
  admin: isAdmin,
  guru: isGuru,
  pentashih: isPentashih,
  santri: isSantri,
  owner: userOwnsSantriRecord,
  recipient: isRecipient,
  classOwner: isClassOwner,
  santriClass: santriBelongsToClass,
  guruTeachesCaller: teachesCaller,
  pentashihOfGuru,
  guruClass: guruHasClassAccess,
  guruSantri: guruHasSantriAccess,
  pentashihClass: pentashihHasClassAccess,
  pentashihSantri: pentashihHasSantriAccess,
  pentashihMmq: pentashihHasMmqAccess,
};

// Predikat yang butuh nilai kolom baris, bukan sekadar peran pengguna.
export const SCOPED_PREDICATES = new Set([
  'owner', 'recipient', 'classOwner', 'santriClass', 'guruTeachesCaller', 'pentashihOfGuru',
  'guruClass', 'guruSantri', 'pentashihClass', 'pentashihSantri', 'pentashihMmq',
]);
