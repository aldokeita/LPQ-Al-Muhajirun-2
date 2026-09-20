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

import { SCHEMA_COLUMNS, columnExists, isJsonColumn, isMoneyColumn, tableExists } from './schema-manifest.js';
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

    // Uang dikirim dalam rupiah desimal dan disimpan sebagai sen bulat.
    if (isMoneyColumn(table, column)) {
      if (value === null || value === undefined || value === '') {
        clean[column] = null;
        continue;
      }
      const amount = Number(value);
      if (!Number.isFinite(amount)) throw new QueryError(`Nilai kolom "${column}" bukan angka.`);
      clean[column] = Math.round(amount * 100);
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

// Tidak semua tabel berkunci tunggal "id". santri_character_strengths, misalnya, berkunci
// gabungan (santri_id, strength_key) dan tidak punya kolom id sama sekali. Karena itu
// pemilihan baris dinyatakan sebagai objek kunci, bukan satu nilai.
const buildKey = (table, { id = null, where = null }) => {
  const key = where && typeof where === 'object' && !Array.isArray(where)
    ? where
    : (id !== null && id !== undefined ? { id } : null);

  if (!key || Object.keys(key).length === 0) throw new QueryError('Kunci baris wajib diisi.');

  for (const column of Object.keys(key)) {
    if (!columnExists(table, column)) throw new QueryError(`Kolom kunci "${column}" tidak dikenal pada tabel "${table}".`);
    const value = key[column];
    if (value === null || value === undefined || typeof value === 'object') {
      throw new QueryError(`Nilai kunci "${column}" tidak valid.`);
    }
  }

  const columns = Object.keys(key);
  return {
    clause: columns.map((c) => `${quote(c)} = ?`).join(' and '),
    params: columns.map((c) => key[c]),
    describe: columns.map((c) => `${c}=${key[c]}`).join(', '),
  };
};

const loadRow = async (db, table, key) => {
  const columns = SCHEMA_COLUMNS[table].map(quote).join(', ');
  return db
    .prepare(`select ${columns} from ${quote(table)} where ${key.clause} limit 1`)
    .bind(...key.params)
    .first();
};

// Menyiapkan satu baris sisipan lengkap dengan kolom audit, lalu memeriksa haknya.
// Dipisahkan dari penulisannya supaya sisipan banyak baris bisa memeriksa seluruhnya
// lebih dulu, baru menulis sekali jalan.
const prepareInsert = async (db, authorizer, table, values) => {
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
  //
  // Kolom scope yang tidak disertakan diisi null, bukan ditolak. Postgres pun begitu:
  // policy-nya berbunyi is_admin() OR guru_has_class_access(class_id), sehingga admin
  // tetap boleh menyisip baris tanpa kelas — misalnya kehadiran guru, yang memang tidak
  // terikat kelas mana pun. Menolaknya di sini akan menutup jalur yang dulu terbuka.
  //
  // Bagi yang bukan admin ini tidak melonggarkan apa pun: predikat berbasis kelas
  // memulangkan false untuk null, jadi barisnya tetap ditolak.
  if (policy.scopeColumn && row[policy.scopeColumn] === undefined && columnExists(table, policy.scopeColumn)) {
    row[policy.scopeColumn] = null;
  }

  // Tabel yang membuka penambahan untuk umum melewati pemeriksaan peran hanya ketika
  // pengirimnya memang belum login. Pengguna yang sudah login tetap diperiksa seperti biasa.
  const anonymousPublicInsert = policy.publicInsert && !authorizer.ctx.userId;
  if (!anonymousPublicInsert) await authorizer.assert(table, 'insert', row);

  const columns = Object.keys(row);
  const sql = `insert into ${quote(table)} (${columns.map(quote).join(', ')}) values (${columns.map(() => '?').join(', ')})`;
  return { id: row.id ?? null, statement: db.prepare(sql).bind(...columns.map((c) => row[c])) };
};

export const insertRow = async (db, authorizer, { table, values }) => {
  const { id, statement } = await prepareInsert(db, authorizer, table, values);
  await statement.run();
  return { id };
};

// D1 membatasi satu permintaan pada jumlah statement tertentu; angka ini dipilih jauh
// di bawahnya dan sekaligus menjaga permintaan tetap ringan.
const MAX_BATCH_ROWS = 100;

// Sisipan banyak baris sekaligus. Dulu beberapa pembayaran ditulis dalam satu perintah
// insert, jadi kegagalan di tengah tidak pernah meninggalkan sebagian baris tersimpan.
// db.batch menjalankan seluruh statement dalam satu transaksi, sehingga sifat itu tetap.
export const insertRows = async (db, authorizer, { table, values }) => {
  if (!Array.isArray(values) || values.length === 0) {
    throw new QueryError('values harus berupa larik berisi minimal satu baris.');
  }
  if (values.length > MAX_BATCH_ROWS) {
    throw new QueryError(`Sekali kirim paling banyak ${MAX_BATCH_ROWS} baris.`);
  }

  // Seluruh baris diperiksa lebih dulu. Kalau satu saja ditolak, tidak ada yang ditulis.
  const prepared = [];
  for (const row of values) prepared.push(await prepareInsert(db, authorizer, table, row));

  await db.batch(prepared.map((p) => p.statement));
  return { ids: prepared.map((p) => p.id) };
};

export const updateRow = async (db, authorizer, { table, id = null, where = null, values }) => {
  const policy = requireWritableTable(table, 'update');
  const key = buildKey(table, { id, where });
  const clean = sanitizeValues(table, values);

  const existing = await loadRow(db, table, key);
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
  const sql = `update ${quote(table)} set ${columns.map((c) => `${quote(c)} = ?`).join(', ')} where ${key.clause}`;
  await db.prepare(sql).bind(...columns.map((c) => clean[c]), ...key.params).run();
  return { id: existing.id ?? null, key: key.describe };
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

  // Pemilihan baris memakai kolom konflik itu sendiri, bukan "id", agar tabel berkunci
  // gabungan tanpa kolom id tetap bisa dilayani.
  const existing = await db
    .prepare(`select ${quote(conflictColumn)} from ${quote(table)} where ${quote(conflictColumn)} = ? limit 1`)
    .bind(key)
    .first();

  if (existing) {
    const result = await updateRow(db, authorizer, { table, where: { [conflictColumn]: key }, values });
    return { ...result, inserted: false };
  }
  return { ...(await insertRow(db, authorizer, { table, values })), inserted: true };
};

const prepareDelete = async (db, authorizer, table, { id = null, where = null }) => {
  requireWritableTable(table, 'delete');
  const key = buildKey(table, { id, where });

  const existing = await loadRow(db, table, key);
  if (!existing) throw new QueryError('Baris tidak ditemukan.', 404);
  await authorizer.assert(table, 'delete', existing);

  // Tabel yang punya deleted_at memakai penghapusan lunak, sama seperti sebelumnya,
  // supaya jejak dan relasi historis tidak putus.
  if (columnExists(table, 'deleted_at')) {
    const values = { deleted_at: nowIso() };
    if (columnExists(table, 'updated_at')) values.updated_at = values.deleted_at;
    if (columnExists(table, 'updated_by')) values.updated_by = authorizer.ctx.userId;
    const columns = Object.keys(values);
    const statement = db
      .prepare(`update ${quote(table)} set ${columns.map((c) => `${quote(c)} = ?`).join(', ')} where ${key.clause}`)
      .bind(...columns.map((c) => values[c]), ...key.params);
    return { result: { id: existing.id ?? null, key: key.describe, soft: true }, statement };
  }

  const statement = db.prepare(`delete from ${quote(table)} where ${key.clause}`).bind(...key.params);
  return { result: { id: existing.id ?? null, key: key.describe, soft: false }, statement };
};

export const deleteRow = async (db, authorizer, { table, id = null, where = null }) => {
  const { result, statement } = await prepareDelete(db, authorizer, table, { id, where });
  await statement.run();
  return result;
};

// Penghapusan banyak baris sekaligus, menggantikan delete().in('id', ids) yang dulu
// berjalan sebagai satu perintah. Seperti sisipan banyak baris, seluruhnya diperiksa
// lebih dulu lalu ditulis dalam satu transaksi.
export const deleteRows = async (db, authorizer, { table, ids }) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new QueryError('ids harus berupa larik berisi minimal satu nilai.');
  }
  if (ids.length > MAX_BATCH_ROWS) {
    throw new QueryError(`Sekali kirim paling banyak ${MAX_BATCH_ROWS} baris.`);
  }

  const prepared = [];
  for (const id of ids) prepared.push(await prepareDelete(db, authorizer, table, { id }));

  await db.batch(prepared.map((p) => p.statement));
  return { deleted: prepared.map((p) => p.result) };
};
