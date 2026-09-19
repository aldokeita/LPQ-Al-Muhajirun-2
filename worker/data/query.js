// Pembaca data berpagar.
//
// Otorisasi disusun menjadi bagian dari klausa WHERE, bukan penyaringan setelah query.
// Ini penting: kalau baris disaring setelah LIMIT, seorang guru yang meminta 100 santri
// bisa menerima 3 — dan halaman berikutnya melewatkan baris yang seharusnya terlihat.
// RLS dulu menyaring sebelum LIMIT, dan sifat itu dipertahankan di sini.
//
// Nama tabel dan kolom tidak bisa diparameterkan, jadi semuanya dicocokkan dengan
// manifest yang dihasilkan dari skema sebelum dirangkai. Nilai selalu diparameterkan.

import { SCHEMA_COLUMNS, columnExists, tableExists } from './schema-manifest.js';
import { getPolicy } from '../auth/policies.js';
import { currentUserRole } from '../auth/predicates.js';

export const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;

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

  const scoped = rules.filter((rule) => SCOPE_SQL[rule]);
  if (scoped.length === 0 || !policy.scopeColumn || !ctx.userId) {
    throw new QueryError('Akses ditolak.', 403);
  }

  const column = `${quote(table)}.${quote(policy.scopeColumn)}`;
  const fragments = [];
  const params = [];
  for (const rule of scoped) {
    const built = SCOPE_SQL[rule](column);
    fragments.push(`(${built.sql})`);
    params.push(...built.params(ctx.userId, todayWib()));
  }
  return { sql: `(${fragments.join(' or ')})`, params };
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

const buildFilters = (table, filters) => {
  if (filters === undefined || filters === null) return { sql: [], params: [] };
  if (!Array.isArray(filters)) throw new QueryError('filters harus berupa array.');

  const sql = [];
  const params = [];
  for (const filter of filters) {
    const { column, op, value } = filter ?? {};
    if (!columnExists(table, column)) throw new QueryError(`Kolom "${column}" tidak dikenal pada tabel "${table}".`);
    const qualified = `${quote(table)}.${quote(column)}`;

    if (op === 'is_null') { sql.push(`${qualified} is null`); continue; }
    if (op === 'not_null') { sql.push(`${qualified} is not null`); continue; }
    if (op === 'in') {
      if (!Array.isArray(value) || value.length === 0) throw new QueryError('Operator "in" butuh array tidak kosong.');
      if (value.length > MAX_LIMIT) throw new QueryError('Operator "in" melebihi batas jumlah nilai.');
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

  if (ctx.userId) {
    const clause = await buildAuthorizationClause(ctx, table, policy);
    if (clause) { where.push(clause.sql); params.push(...clause.params); }
  } else {
    // Tanpa login hanya baris publik yang boleh terbaca, dan hanya untuk tabel
    // yang memang punya jalur publik.
    const publicRead = authorizer.publicRead(table);
    if (!publicRead) throw new QueryError('Akses ditolak.', 403);
    where.push(`(${publicRead.where})`);
    params.push(...publicRead.params);
  }

  let orderSql = '';
  if (body?.order) {
    const { column, ascending = true } = body.order;
    if (!columnExists(table, column)) throw new QueryError(`Kolom urut "${column}" tidak dikenal.`);
    orderSql = ` order by ${quote(table)}.${quote(column)} ${ascending ? 'asc' : 'desc'}`;
  }

  const limit = Math.min(Math.max(Number.isInteger(body?.limit) ? body.limit : DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Number.isInteger(body?.offset) && body.offset > 0 ? body.offset : 0;

  const selectList = columns.map((c) => `${quote(table)}.${quote(c)}`).join(', ');
  const whereSql = where.length > 0 ? ` where ${where.join(' and ')}` : '';
  const sql = `select ${selectList} from ${quote(table)}${whereSql}${orderSql} limit ? offset ?`;

  const result = await db.prepare(sql).bind(...params, limit, offset).all();
  return { rows: result.results ?? [], limit, offset };
};
