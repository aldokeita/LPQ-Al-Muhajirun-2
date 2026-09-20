// Penulis data berpagar.
//
// Tiga hal yang dijaga di sini dan tidak boleh dipercayakan ke klien:
//
// 1. Kolom audit. created_by, updated_by, created_at, updated_at, dan id ditetapkan
//    server. Kalau klien boleh mengirimnya, siapa pun bisa mengaku sebagai orang lain
//    di jejak audit, dan jejak itulah yang dipakai menelusuri siapa mengubah nilai santri.
//
// 2. Kolom scope. Mengubah santri_id atau class_id sebuah baris berarti memindahkannya
//    ke wilayah orang lain. Hanya admin yang boleh, karena guru yang bisa mengubahnya
//    dapat menarik baris milik kelas lain ke dalam jangkauannya sendiri.
//
// 3. Pemeriksaan sebelum dan sesudah. Pada update, baris lama diperiksa lebih dulu;
//    tanpa itu seseorang bisa mengubah baris yang sebenarnya tidak boleh ia sentuh.

import { SCHEMA_COLUMNS, columnExists, isJsonColumn, tableExists } from './schema-manifest.js';
import { QueryError } from './query.js';
import { getPolicy } from '../auth/policies.js';

// Ditetapkan server, tidak pernah diambil dari klien.
const SERVER_OWNED = new Set(['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at']);

const quote = (identifier) => `"${identifier}"`;
const nowIso = () => new Date().toISOString();

const requireWritableTable = (table, command) => {
  if (typeof table !== 'string' || !tableExists(table)) throw new QueryError(`Tabel "${table}" tidak dikenal.`);
  const policy = getPolicy(table);
  if (!policy) throw new QueryError(`Tabel "${table}" tidak punya kebijakan.`, 500);
  if (policy.internal) throw new QueryError('Tabel ini hanya boleh disentuh kode internal.', 403);
  if (!Array.isArray(policy[command]) || policy[command].length === 0) {
    throw new QueryError(`Perintah ${command} tidak diizinkan pada tabel ini.`, 403);
  }
  return policy;
};

const sanitizeValues = (table, values, { allowServerOwned = false } = {}) => {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new QueryError('values harus berupa objek.');
  }
  const clean = {};
  for (const [column, value] of Object.entries(values)) {
    if (!columnExists(table, column)) throw new QueryError(`Kolom "${column}" tidak dikenal pada tabel "${table}".`);
    if (!allowServerOwned && SERVER_OWNED.has(column)) continue;

    // Kolom jsonb dan array dirangkai menjadi teks JSON di sini. Tanpa ini, sebuah objek
    // akan tersimpan sebagai "[object Object]" tanpa memunculkan galat apa pun.
    if (isJsonColumn(table, column)) {
      clean[column] = value === null || value === undefined ? null : JSON.stringify(value);
      continue;
    }

    if (value !== null && typeof value === 'object') {
      throw new QueryError(`Nilai kolom "${column}" harus berupa nilai sederhana atau null.`);
    }
    clean[column] = value;
  }
  if (Object.keys(clean).length === 0) throw new QueryError('Tidak ada kolom yang bisa ditulis.');
  return clean;
};

const loadRow = async (db, table, id) => {
  const columns = SCHEMA_COLUMNS[table].map(quote).join(', ');
  return db.prepare(`select ${columns} from ${quote(table)} where "id" = ? limit 1`).bind(id).first();
};

export const insertRow = async (db, authorizer, { table, values }) => {
  const policy = requireWritableTable(table, 'insert');
  const clean = sanitizeValues(table, values);

  const row = { ...clean };
  if (columnExists(table, 'id')) row.id = crypto.randomUUID();
  const timestamp = nowIso();
  for (const column of ['created_at', 'updated_at']) {
    if (columnExists(table, column)) row[column] = timestamp;
  }
  for (const column of ['created_by', 'updated_by']) {
    if (columnExists(table, column)) row[column] = authorizer.ctx.userId;
  }

  // Baris diperiksa dalam bentuk akhirnya, termasuk kolom scope yang dikirim klien.
  if (policy.scopeColumn && row[policy.scopeColumn] === undefined) {
    throw new QueryError(`Kolom "${policy.scopeColumn}" wajib diisi untuk tabel ini.`);
  }

  // Tabel yang membuka penambahan untuk umum melewati pemeriksaan peran hanya ketika
  // pengirimnya memang belum login. Pengguna yang sudah login tetap diperiksa seperti biasa.
  const anonymousPublicInsert = policy.publicInsert && !authorizer.ctx.userId;
  if (!anonymousPublicInsert) await authorizer.assert(table, 'insert', row);

  const columns = Object.keys(row);
  const sql = `insert into ${quote(table)} (${columns.map(quote).join(', ')}) values (${columns.map(() => '?').join(', ')})`;
  await db.prepare(sql).bind(...columns.map((c) => row[c])).run();
  return { id: row.id ?? null };
};

export const updateRow = async (db, authorizer, { table, id, values }) => {
  const policy = requireWritableTable(table, 'update');
  if (typeof id !== 'string' || id === '') throw new QueryError('id wajib diisi.');
  const clean = sanitizeValues(table, values);

  const existing = await loadRow(db, table, id);
  if (!existing) throw new QueryError('Baris tidak ditemukan.', 404);

  // Baris lama diperiksa lebih dulu: yang menentukan hak adalah keadaan sekarang,
  // bukan keadaan yang diinginkan pengirim.
  await authorizer.assert(table, 'update', existing);

  if (policy.scopeColumn && Object.prototype.hasOwnProperty.call(clean, policy.scopeColumn)) {
    if (clean[policy.scopeColumn] !== existing[policy.scopeColumn]) {
      const isAdmin = await authorizer.can(table, 'delete', existing);
      if (!isAdmin) throw new QueryError(`Kolom "${policy.scopeColumn}" tidak boleh dipindahkan.`, 403);
      // Wilayah tujuan juga harus boleh disentuh, agar baris tidak bisa dilempar
      // ke tempat yang pengirimnya sendiri tak berhak.
      await authorizer.assert(table, 'update', { ...existing, ...clean });
    }
  }

  if (columnExists(table, 'updated_at')) clean.updated_at = nowIso();
  if (columnExists(table, 'updated_by')) clean.updated_by = authorizer.ctx.userId;

  const columns = Object.keys(clean);
  const sql = `update ${quote(table)} set ${columns.map((c) => `${quote(c)} = ?`).join(', ')} where "id" = ?`;
  await db.prepare(sql).bind(...columns.map((c) => clean[c]), id).run();
  return { id };
};

// Upsert dijalankan sebagai pencarian lalu insert atau update, bukan sebagai
// INSERT ... ON CONFLICT. Alasannya otorisasi: kalau barisnya sudah ada, yang menentukan
// hak adalah baris yang ada sekarang, dan itu hanya bisa diperiksa setelah dibaca.
// Menyusunnya sebagai satu statement akan melewatkan pemeriksaan itu.
export const upsertRow = async (db, authorizer, { table, values, conflictColumn = 'id' }) => {
  requireWritableTable(table, 'insert');
  requireWritableTable(table, 'update');
  if (!columnExists(table, conflictColumn)) {
    throw new QueryError(`Kolom konflik "${conflictColumn}" tidak dikenal pada tabel "${table}".`);
  }

  const clean = sanitizeValues(table, values);
  // Kolom konflik yang kosong berarti baris baru: tidak ada yang bisa ditabrakkan.
  // Ini juga perilaku upsert lama ketika id tidak disertakan.
  const key = clean[conflictColumn] ?? values?.[conflictColumn] ?? null;
  if (key === null || key === undefined) {
    return { ...(await insertRow(db, authorizer, { table, values })), inserted: true };
  }

  const existing = await db
    .prepare(`select "id" from ${quote(table)} where ${quote(conflictColumn)} = ? limit 1`)
    .bind(key)
    .first();

  if (existing) return { ...(await updateRow(db, authorizer, { table, id: existing.id, values })), inserted: false };
  return { ...(await insertRow(db, authorizer, { table, values })), inserted: true };
};

export const deleteRow = async (db, authorizer, { table, id }) => {
  requireWritableTable(table, 'delete');
  if (typeof id !== 'string' || id === '') throw new QueryError('id wajib diisi.');

  const existing = await loadRow(db, table, id);
  if (!existing) throw new QueryError('Baris tidak ditemukan.', 404);
  await authorizer.assert(table, 'delete', existing);

  // Tabel yang punya deleted_at memakai penghapusan lunak, sama seperti sebelumnya,
  // supaya jejak dan relasi historis tidak putus.
  if (columnExists(table, 'deleted_at')) {
    const values = { deleted_at: nowIso() };
    if (columnExists(table, 'updated_at')) values.updated_at = values.deleted_at;
    if (columnExists(table, 'updated_by')) values.updated_by = authorizer.ctx.userId;
    const columns = Object.keys(values);
    await db
      .prepare(`update ${quote(table)} set ${columns.map((c) => `${quote(c)} = ?`).join(', ')} where "id" = ?`)
      .bind(...columns.map((c) => values[c]), id)
      .run();
    return { id, soft: true };
  }

  await db.prepare(`delete from ${quote(table)} where "id" = ?`).bind(id).run();
  return { id, soft: false };
};
