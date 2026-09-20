// Pembaca data berpagar.
//
// Otorisasi disusun menjadi bagian dari klausa WHERE, bukan penyaringan setelah query.
// Ini penting: kalau baris disaring setelah LIMIT, seorang guru yang meminta 100 santri
// bisa menerima 3 — dan halaman berikutnya melewatkan baris yang seharusnya terlihat.
// RLS dulu menyaring sebelum LIMIT, dan sifat itu dipertahankan di sini.
//
// Nama tabel dan kolom tidak bisa diparameterkan, jadi semuanya dicocokkan dengan
// manifest yang dihasilkan dari skema sebelum dirangkai. Nilai selalu diparameterkan.

import { SCHEMA_COLUMNS, columnExists, isJsonColumn, isMoneyColumn, tableExists } from './schema-manifest.js';
import { getPolicy } from '../auth/policies.js';
import { currentUserRole } from '../auth/predicates.js';

export const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;

// D1 menerima paling banyak 100 parameter terikat dalam satu query. Batas ini dipasang
// di bawahnya agar masih ada ruang untuk filter lain, limit, dan offset.
export const MAX_IN_VALUES = 80;

export class QueryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'QueryError';
    this.status = status;
  }
}

const OPERATORS = {
  eq: (col) => `${col} = ?`,
  neq: (col) => `${col} <> ?`,
  gt: (col) => `${col} > ?`,
  gte: (col) => `${col} >= ?`,
  lt: (col) => `${col} < ?`,
  lte: (col) => `${col} <= ?`,
  like: (col) => `${col} LIKE ?`,
  ilike: (col) => `lower(${col}) LIKE lower(?)`,
};

const quote = (identifier) => `"${identifier}"`;

// Predikat berbasis baris diterjemahkan menjadi potongan SQL agar ikut menyaring
// sebelum LIMIT diterapkan.
const SCOPE_SQL = {
  owner: (column) => ({ sql: `${column} = ?`, params: (userId) => [userId] }),
  guruClass: (column) => ({
    sql: `exists (select 1 from "classes" c where c."id" = ${column} and c."id_guru" = ? and c."deleted_at" is null)`,
    params: (userId) => [userId],
  }),
  guruSantri: (column) => ({
    sql: `exists (select 1 from "class_memberships" cm join "classes" c on c."id" = cm."class_id"
                   where cm."santri_id" = ${column} and cm."status" = 'active'
                     and c."id_guru" = ? and c."deleted_at" is null)`,
    params: (userId) => [userId],
  }),
  pentashihClass: (column) => ({
    sql: `exists (select 1 from "pentashih_class_assignments" pca
                   where pca."class_id" = ${column} and pca."pentashih_id" = ? and pca."is_active" = 1
                     and pca."scope" in ('class', 'both')
                     and (pca."starts_at" is null or pca."starts_at" <= ?)
                     and (pca."ends_at" is null or pca."ends_at" >= ?))`,
    params: (userId, today) => [userId, today, today],
  }),
  pentashihSantri: (column) => ({
    sql: `exists (select 1 from "class_memberships" cm
                   join "pentashih_class_assignments" pca on pca."class_id" = cm."class_id"
                   where cm."santri_id" = ${column} and cm."status" = 'active'
                     and pca."pentashih_id" = ? and pca."is_active" = 1
                     and pca."scope" in ('class', 'both')
                     and (pca."starts_at" is null or pca."starts_at" <= ?)
                     and (pca."ends_at" is null or pca."ends_at" >= ?))`,
    params: (userId, today) => [userId, today, today],
  }),
  pentashihMmq: (column) => ({
    sql: `exists (select 1 from "pentashih_class_assignments" pca
                   where pca."mmq_schedule_id" = ${column} and pca."pentashih_id" = ? and pca."is_active" = 1
                     and pca."scope" in ('mmq', 'both')
                     and (pca."starts_at" is null or pca."starts_at" <= ?)
                     and (pca."ends_at" is null or pca."ends_at" >= ?))`,
    params: (userId, today) => [userId, today, today],
  }),
};

const ROLE_RULES = { admin: 'admin', guru: 'guru', pentashih: 'pentashih', santri: 'santri' };
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const todayWib = () => new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);

// Memulangkan null bila pemohon boleh melihat seluruh baris, atau { sql, params }
// bila aksesnya terbatas. Melempar bila tidak boleh melihat apa pun.
const buildAuthorizationClause = async (ctx, table, policy) => {
  const rules = policy.select ?? [];
  if (rules.length === 0) throw new QueryError('Akses ditolak.', 403);

  const role = await currentUserRole(ctx);
  // Predikat berbasis peran berlaku untuk seluruh baris sekaligus.
  if (rules.some((rule) => ROLE_RULES[rule] && ROLE_RULES[rule] === role)) return null;

  // Sebagian tabel memakai kolom scope berbeda untuk predikat berbeda. View
  // payment_status_summary, misalnya, memeriksa kepemilikan lewat santri_id sekaligus
  // akses guru lewat class_id.
  const columnFor = (rule) => policy.scopeColumns?.[rule] ?? policy.scopeColumn ?? null;

  const scoped = rules.filter((rule) => SCOPE_SQL[rule] && columnFor(rule));
  if (scoped.length === 0 || !ctx.userId) throw new QueryError('Akses ditolak.', 403);

  const fragments = [];
  const params = [];
  for (const rule of scoped) {
    const built = SCOPE_SQL[rule](`${quote(table)}.${quote(columnFor(rule))}`);
    fragments.push(`(${built.sql})`);
    params.push(...built.params(ctx.userId, todayWib()));
  }
  return { sql: `(${fragments.join(' or ')})`, params };
};

// Menyusun syarat baris yang boleh dibaca, menggabungkan hak berdasarkan peran dengan
// hak baca publik.
//
// Ini memperbaiki salah terjemahan. Di Postgres, tabel konten publik punya dua policy
// terpisah yang keduanya PERMISSIVE, dan yang kedua berlaku untuk "authenticated" juga:
//
//   ... FOR SELECT TO "anon"          USING ("is_public")
//   ... FOR SELECT TO "authenticated" USING ("is_public" OR "public"."is_admin"())
//
// Versi sebelumnya hanya memakai syarat publik ketika pemanggilnya belum login, sehingga
// santri, guru, dan pentashih yang sudah login justru tidak melihat apa pun di
// website_content, news, announcements, dan music_files — padahal pengunjung tanpa login
// melihatnya. Sekarang syarat publik ikut di-OR-kan untuk pengguna yang sudah login.
//
// Memulangkan null bila seluruh baris boleh dilihat, atau { sql, params } bila terbatas.
// Melempar bila tidak ada jalan sama sekali.
const buildReadClause = async (ctx, table, policy) => {
  const publicRead = policy.publicFilter
    ? {
      sql: `(${policy.publicFilter})`,
      params: policy.publicFilterParams ? policy.publicFilterParams() : [],
    }
    : null;

  if (!ctx.userId) {
    if (!publicRead) throw new QueryError('Akses ditolak.', 403);
    return publicRead;
  }

  let scoped;
  try {
    scoped = await buildAuthorizationClause(ctx, table, policy);
  } catch (error) {
    // Peran pemanggil tidak memberi hak apa pun, tetapi barisnya mungkin publik.
    if (publicRead && error instanceof QueryError && error.status === 403) return publicRead;
    throw error;
  }

  if (scoped === null) return null;
  if (!publicRead) return scoped;
  return {
    sql: `(${scoped.sql} or ${publicRead.sql})`,
    params: [...scoped.params, ...publicRead.params],
  };
};

const validateColumns = (table, requested) => {
  if (!Array.isArray(requested) || requested.length === 0) return SCHEMA_COLUMNS[table];
  for (const column of requested) {
    if (typeof column !== 'string' || !columnExists(table, column)) {
      throw new QueryError(`Kolom "${column}" tidak dikenal pada tabel "${table}".`);
    }
  }
  return requested;
};

const MAX_FILTER_DEPTH = 3;

const buildFilters = (table, filters, depth = 0) => {
  if (filters === undefined || filters === null) return { sql: [], params: [] };
  if (!Array.isArray(filters)) throw new QueryError('filters harus berupa array.');
  if (depth > MAX_FILTER_DEPTH) throw new QueryError('Filter bersarang terlalu dalam.');

  const sql = [];
  const params = [];
  for (const filter of filters) {
    // Kelompok OR: { or: [ ...filter ] }. Kedalamannya dibatasi agar permintaan
    // tidak bisa merangkai ekspresi yang berlipat tanpa batas.
    if (filter && Array.isArray(filter.or)) {
      if (filter.or.length === 0) throw new QueryError('Kelompok "or" tidak boleh kosong.');
      const nested = buildFilters(table, filter.or, depth + 1);
      sql.push(`(${nested.sql.join(' or ')})`);
      params.push(...nested.params);
      continue;
    }

    const { column, op, value: rawValue } = filter ?? {};
    if (!columnExists(table, column)) throw new QueryError(`Kolom "${column}" tidak dikenal pada tabel "${table}".`);
    const qualified = `${quote(table)}.${quote(column)}`;

    // Uang dikirim pemanggil dalam rupiah desimal dan disimpan sebagai sen bulat, sama
    // seperti pada penulisan. Tanpa konversi di sini, menyaring jumlah = 50000 akan
    // dibandingkan dengan 5000000 dan tidak pernah menemukan apa pun — gagal diam-diam,
    // bukan dengan galat.
    //
    // Hanya operator pembanding yang dikonversi. Pencocokan teks seperti like dibiarkan
    // apa adanya, karena mencocokkan potongan angka tidak punya arti dalam sen.
    const COMPARISONS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in']);
    const toCents = (amount) => {
      const number = Number(amount);
      if (!Number.isFinite(number)) throw new QueryError(`Nilai kolom "${column}" bukan angka.`);
      return Math.round(number * 100);
    };
    const value = isMoneyColumn(table, column) && COMPARISONS.has(op) && rawValue !== null && rawValue !== undefined
      ? (Array.isArray(rawValue) ? rawValue.map(toCents) : toCents(rawValue))
      : rawValue;

    if (op === 'is_null') { sql.push(`${qualified} is null`); continue; }
    if (op === 'not_null') { sql.push(`${qualified} is not null`); continue; }
    if (op === 'in') {
      if (!Array.isArray(value) || value.length === 0) throw new QueryError('Operator "in" butuh array tidak kosong.');
      // D1 membatasi 100 parameter terikat per query. Sisanya disisakan untuk filter lain
      // beserta limit dan offset, jadi ambangnya ditaruh di bawah batas itu.
      if (value.length > MAX_IN_VALUES) {
        throw new QueryError(`Operator "in" dibatasi ${MAX_IN_VALUES} nilai sekali jalan karena batas parameter D1.`);
      }
      sql.push(`${qualified} in (${value.map(() => '?').join(', ')})`);
      params.push(...value);
      continue;
    }
    // Kolom array disimpan sebagai JSON, jadi keanggotaannya diuji lewat json_each.
    if (op === 'contains') {
      sql.push(`exists (select 1 from json_each(${qualified}) where "value" = ?)`);
      params.push(value);
      continue;
    }
    const builder = OPERATORS[op];
    if (!builder) throw new QueryError(`Operator "${op}" tidak diizinkan.`);
    if (value === undefined || value === null || typeof value === 'object') {
      throw new QueryError(`Nilai untuk operator "${op}" tidak valid.`);
    }
    sql.push(builder(qualified));
    params.push(value);
  }
  return { sql, params };
};

// Menghitung baris, memakai klausa otorisasi yang sama persis dengan pembacaan.
// Tanpa itu, hitungan akan membocorkan berapa banyak baris yang sebenarnya tidak boleh
// dilihat pemanggil — jumlah santri, jumlah pembayaran, dan seterusnya.
export const runCount = async (db, ctx, authorizer, body) => {
  const { table, where, params } = await buildSelection(db, ctx, authorizer, body);
  if (where === null) return { count: 0 };

  const whereSql = where.length > 0 ? ` where ${where.join(' and ')}` : '';
  const row = await db.prepare(`select count(*) as n from ${quote(table)}${whereSql}`).bind(...params).first();
  return { count: row?.n ?? 0 };
};

// Bagian yang sama antara membaca dan menghitung: validasi tabel, filter, dan otorisasi.
// where bernilai null berarti pemanggil tidak berhak melihat baris apa pun.
const buildSelection = async (db, ctx, authorizer, body) => {
  const table = body?.table;
  if (typeof table !== 'string' || !tableExists(table)) throw new QueryError(`Tabel "${table}" tidak dikenal.`);

  const policy = getPolicy(table);
  if (!policy) throw new QueryError(`Tabel "${table}" tidak punya kebijakan.`, 500);
  if (policy.internal) throw new QueryError('Tabel ini hanya boleh disentuh kode internal.', 403);

  const { sql: filterSql, params: filterParams } = buildFilters(table, body?.filters);
  const where = [...filterSql];
  const params = [...filterParams];

  // Tanpa sesi dan tanpa jalur publik, hitungannya nol — bukan galat. Itu perilaku yang
  // sama dengan pembacaan, dan sama dengan yang dilakukan RLS.
  if (!ctx.userId && !policy.publicFilter) return { table, policy, where: null, params: [] };

  const clause = await buildReadClause(ctx, table, policy);
  if (clause) { where.push(clause.sql); params.push(...clause.params); }

  return { table, policy, where, params };
};

export const runQuery = async (db, ctx, authorizer, body) => {
  const table = body?.table;
  if (typeof table !== 'string' || !tableExists(table)) throw new QueryError(`Tabel "${table}" tidak dikenal.`);

  const policy = getPolicy(table);
  if (!policy) throw new QueryError(`Tabel "${table}" tidak punya kebijakan.`, 500);
  if (policy.internal) throw new QueryError('Tabel ini hanya boleh disentuh kode internal.', 403);

  const columns = validateColumns(table, body?.columns);
  const { sql: filterSql, params: filterParams } = buildFilters(table, body?.filters);

  const where = [...filterSql];
  const params = [...filterParams];

  // Tanpa login hanya baris publik yang boleh terbaca. Tabel tanpa jalur publik
  // memulangkan himpunan kosong, bukan galat — itulah yang dilakukan RLS, dan halaman
  // publik yang membaca tabel tertutup selama ini memang menampilkan bagian kosong.
  // Menggantinya dengan galat akan mengubah halaman yang kosong menjadi halaman rusak.
  if (!ctx.userId && !policy.publicFilter) return { rows: [], limit: DEFAULT_LIMIT, offset: 0 };

  const clause = await buildReadClause(ctx, table, policy);
  if (clause) { where.push(clause.sql); params.push(...clause.params); }

  // Urutan bisa lebih dari satu kolom. Penempatan NULL dinyatakan eksplisit karena
  // Postgres menaruhnya di akhir untuk urutan menaik sedangkan SQLite di awal.
  let orderSql = '';
  const orders = body?.order ? (Array.isArray(body.order) ? body.order : [body.order]) : [];
  if (orders.length > 0) {
    const parts = [];
    for (const entry of orders) {
      const { column, ascending = true, nullsFirst = null } = entry ?? {};
      if (!columnExists(table, column)) throw new QueryError(`Kolom urut "${column}" tidak dikenal.`);
      const qualified = `${quote(table)}.${quote(column)}`;
      if (nullsFirst !== null) {
        parts.push(`case when ${qualified} is null then ${nullsFirst ? 0 : 1} else ${nullsFirst ? 1 : 0} end`);
      }
      parts.push(`${qualified} ${ascending ? 'asc' : 'desc'}`);
    }
    orderSql = ` order by ${parts.join(', ')}`;
  }

  const limit = Math.min(Math.max(Number.isInteger(body?.limit) ? body.limit : DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Number.isInteger(body?.offset) && body.offset > 0 ? body.offset : 0;

  const selectList = columns.map((c) => `${quote(table)}.${quote(c)}`).join(', ');
  const whereSql = where.length > 0 ? ` where ${where.join(' and ')}` : '';
  const sql = `select ${selectList} from ${quote(table)}${whereSql}${orderSql} limit ? offset ?`;

  const result = await db.prepare(sql).bind(...params, limit, offset).all();
  return { rows: decodeColumns(table, result.results ?? []), limit, offset };
};

// Nilai uang tersimpan dalam sen; pemanggil menerima rupiah desimal seperti dulu.
const centsToRupiah = (cents) => (cents === null || cents === undefined ? cents : Number(cents) / 100);

export const decodeColumns = (table, rows) => decodeMoneyColumns(table, decodeJsonColumns(table, rows));

const decodeMoneyColumns = (table, rows) => {
  const money = SCHEMA_COLUMNS[table]?.filter((column) => isMoneyColumn(table, column)) ?? [];
  if (money.length === 0) return rows;
  return rows.map((row) => {
    const copy = { ...row };
    for (const column of money) {
      if (Object.prototype.hasOwnProperty.call(copy, column)) copy[column] = centsToRupiah(copy[column]);
    }
    return copy;
  });
};

// Kolom jsonb dan array Postgres tersimpan sebagai teks JSON. Membongkarnya di sini
// membuat pemanggil menerima objek dan array seperti dulu, tanpa perlu tahu bahwa
// penyimpanannya berubah. Isi yang gagal diurai dipulangkan apa adanya agar data yang
// terlanjur tidak berformat JSON tidak menggagalkan seluruh permintaan.
export const decodeJsonColumns = (table, rows) => {
  const encoded = SCHEMA_COLUMNS[table]?.filter((column) => isJsonColumn(table, column)) ?? [];
  if (encoded.length === 0) return rows;
  return rows.map((row) => {
    const copy = { ...row };
    for (const column of encoded) {
      if (typeof copy[column] !== 'string') continue;
      try {
        copy[column] = JSON.parse(copy[column]);
      } catch {
        // Biarkan apa adanya.
      }
    }
    return copy;
  });
};
