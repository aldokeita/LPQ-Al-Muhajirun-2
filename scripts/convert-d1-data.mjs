// Mengubah data dump Postgres (format COPY) menjadi INSERT untuk Cloudflare D1.
//
// Pemakaian:
//   node scripts/convert-d1-data.mjs <folder-backup> <output.sql>
//
// Membaca 04-data-public.sql dan 05-data-auth.sql dari folder backup. Tabel users diisi
// dari auth.users; sisanya dari schema public. Urutan penulisan mengikuti ketergantungan
// foreign key agar bisa dimuat dengan PRAGMA foreign_keys menyala.

import fs from 'node:fs';
import path from 'node:path';

const [, , backupDir, outputPath] = process.argv;
if (!backupDir || !outputPath) {
  console.error('Pemakaian: node scripts/convert-d1-data.mjs <folder-backup> <output.sql>');
  process.exit(1);
}

const warnings = [];

const MONEY_COLUMNS = new Set(['payments.jumlah', 'expenses.jumlah', 'santri.default_spp_amount']);
const ARRAY_COLUMNS = new Set(['guru.roles', 'santri.juz_hafalan']);
const BOOLEAN_LITERALS = { t: '1', f: '0' };

// Kolom auth.users yang dibawa ke tabel users; selebihnya token internal Supabase.
const USER_COLUMNS = [
  'id', 'email', 'phone', 'encrypted_password', 'email_confirmed_at',
  'last_sign_in_at', 'banned_until', 'raw_user_meta_data', 'created_at', 'updated_at', 'deleted_at',
];

// Nilai di dalam blok COPY memakai escape milik Postgres.
const decodeCopyValue = (raw) => {
  if (raw === '\\N') return null;
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] !== '\\') {
      out += raw[i];
      continue;
    }
    i += 1;
    const next = raw[i];
    if (next === 'n') out += '\n';
    else if (next === 't') out += '\t';
    else if (next === 'r') out += '\r';
    else if (next === 'b') out += '\b';
    else if (next === 'f') out += '\f';
    else if (next === 'v') out += '\v';
    else if (next === '\\') out += '\\';
    else out += next;
  }
  return out;
};

// Postgres menulis timestamp sebagai "2026-08-16 21:09:28.033125+00"; D1 menyimpan ISO-8601 UTC.
const toIsoTimestamp = (value, qualified) => {
  const m = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d+))?(?:([+-]\d{2})(?::?(\d{2}))?)?$/);
  if (!m) {
    warnings.push(`${qualified}: timestamp "${value}" tidak dikenali, disimpan apa adanya.`);
    return value;
  }
  const [, date, time, fraction, offsetHour, offsetMinute] = m;
  const millis = (fraction || '').padEnd(3, '0').slice(0, 3);
  if (!offsetHour || offsetHour === '+00') return `${date}T${time}.${millis}Z`;
  // Offset non-UTC dinormalkan agar perbandingan leksikografis tetap sama dengan kronologis.
  const iso = new Date(`${date}T${time}.${millis}${offsetHour}:${offsetMinute || '00'}`);
  return `${iso.toISOString().slice(0, 23)}Z`;
};

// Literal array Postgres: {a,b} atau {"a b","c,d"}.
const parsePostgresArray = (value) => {
  const body = value.replace(/^\{/, '').replace(/\}$/, '');
  if (!body) return [];
  const items = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '\\') { current += body[i + 1]; i += 1; }
      else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { items.push(current); current = ''; }
    else current += ch;
  }
  items.push(current);
  return items;
};

const sqlLiteral = (value) => {
  if (value === null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
};

const convertValue = (raw, table, column, columnTypes) => {
  const decoded = decodeCopyValue(raw);
  if (decoded === null) return 'NULL';
  const qualified = `${table}.${column}`;
  const type = columnTypes.get(qualified);

  if (ARRAY_COLUMNS.has(qualified)) return sqlLiteral(JSON.stringify(parsePostgresArray(decoded)));
  if (MONEY_COLUMNS.has(qualified)) {
    const amount = Number(decoded);
    if (Number.isNaN(amount)) {
      warnings.push(`${qualified}: nilai uang "${decoded}" bukan angka.`);
      return 'NULL';
    }
    return String(Math.round(amount * 100));
  }
  if (type === 'boolean') {
    const mapped = BOOLEAN_LITERALS[decoded];
    if (mapped === undefined) {
      warnings.push(`${qualified}: nilai boolean "${decoded}" tidak dikenali.`);
      return 'NULL';
    }
    return mapped;
  }
  if (type === 'timestamp') return sqlLiteral(toIsoTimestamp(decoded, qualified));
  if (type === 'integer') return String(decoded);
  return sqlLiteral(decoded);
};

// Tipe kolom diambil dari skema D1 yang dihasilkan, supaya kedua skrip tidak bisa berselisih.
const readColumnTypes = (schemaPath) => {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const types = new Map();
  for (const m of schema.matchAll(/CREATE TABLE "([a-z_0-9]+)" \(\n([\s\S]*?)\n\);/g)) {
    for (const line of m[2].split('\n')) {
      const cm = line.trim().match(/^"([a-z_0-9]+)" (INTEGER|TEXT)\b/);
      if (!cm) continue;
      types.set(`${m[1]}.${cm[1]}`, cm[2] === 'INTEGER' ? 'integer' : 'text');
    }
  }
  return types;
};

// Tipe asli dari dump Postgres dipakai untuk membedakan boolean dan timestamp,
// yang di D1 sama-sama menjadi INTEGER atau TEXT.
const readSourceTypes = (schemaDumpPath) => {
  const sql = fs.readFileSync(schemaDumpPath, 'utf8');
  const types = new Map();
  for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"public"\."([a-z_0-9]+)" \(\n([\s\S]*?)\n\);/g)) {
    for (const line of m[2].split('\n')) {
      const cm = line.trim().match(/^"([a-z_0-9]+)"\s+(.+?)(?:\s+DEFAULT|\s+NOT NULL|,?$)/i);
      if (!cm) continue;
      const pg = cm[2].replace(/"/g, '').toLowerCase();
      let kind = 'text';
      if (pg === 'boolean') kind = 'boolean';
      else if (pg.startsWith('timestamp')) kind = 'timestamp';
      else if (['integer', 'smallint', 'bigint'].includes(pg)) kind = 'integer';
      types.set(`${m[1]}.${cm[1]}`, kind);
    }
  }
  return types;
};

// Membaca seluruh blok COPY dari sebuah file dump.
const readCopyBlocks = function* (filePath, schemaFilter) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let current = null;
  for (const line of lines) {
    if (current === null) {
      const m = line.match(/^COPY "?([a-z_]+)"?\."?([a-z_0-9]+)"? \(([^)]+)\) FROM stdin;$/);
      if (m && m[1] === schemaFilter) {
        current = { table: m[2], columns: m[3].split(',').map((c) => c.trim().replace(/"/g, '')), rows: [] };
      }
      continue;
    }
    if (line === '\\.') {
      yield current;
      current = null;
      continue;
    }
    current.rows.push(line.split('\t'));
  }
};

const schemaPath = path.join('migrations-d1', '0001_initial_schema.sql');
const columnTypes = readColumnTypes(schemaPath);
const sourceTypes = readSourceTypes(path.join(backupDir, '02-schema-public.sql'));
for (const [key, kind] of sourceTypes) columnTypes.set(key, kind);

// Urutan pemuatan mengikuti urutan CREATE TABLE di skema, yang sudah tersusun
// sesuai ketergantungan foreign key.
const tableOrder = [...fs.readFileSync(schemaPath, 'utf8').matchAll(/CREATE TABLE "([a-z_0-9]+)" \(/g)].map((m) => m[1]);

const statements = new Map();
const counts = new Map();

const emit = (table, columns, rows) => {
  if (rows.length === 0) return;
  const lines = [];
  for (const row of rows) {
    const values = columns.map((col, i) => convertValue(row[i] ?? '\\N', table, col, columnTypes));
    lines.push(`INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});`);
  }
  statements.set(table, lines);
  counts.set(table, rows.length);
};

// users diisi lebih dulu karena 61 foreign key menunjuk padanya.
for (const block of readCopyBlocks(path.join(backupDir, '05-data-auth.sql'), 'auth')) {
  if (block.table !== 'users') continue;
  const keep = USER_COLUMNS.filter((c) => block.columns.includes(c));
  const indices = keep.map((c) => block.columns.indexOf(c));
  const rows = block.rows.map((row) => indices.map((i) => row[i]));
  for (const col of keep) {
    if (['created_at', 'updated_at', 'email_confirmed_at', 'last_sign_in_at', 'banned_until', 'deleted_at'].includes(col)) {
      columnTypes.set(`users.${col}`, 'timestamp');
    }
  }
  emit('users', keep, rows);
}

for (const block of readCopyBlocks(path.join(backupDir, '04-data-public.sql'), 'public')) {
  emit(block.table, block.columns, block.rows);
}

const out = [];
out.push('-- Data Cloudflare D1, dihasilkan dari dump produksi Supabase.');
out.push('-- Dibuat oleh scripts/convert-d1-data.mjs. Jangan diedit langsung.');
out.push('');
out.push('PRAGMA foreign_keys = ON;');
out.push('');

let total = 0;
for (const table of ['users', ...tableOrder.filter((t) => t !== 'users')]) {
  const lines = statements.get(table);
  if (!lines) continue;
  out.push(`-- ${table}: ${lines.length} baris`);
  out.push(...lines);
  out.push('');
  total += lines.length;
  statements.delete(table);
}
for (const [table, lines] of statements) {
  warnings.push(`Tabel "${table}" tidak ada di skema D1 tetapi punya data — ditulis di akhir.`);
  out.push(`-- ${table}: ${lines.length} baris (tidak ada di skema)`);
  out.push(...lines);
  out.push('');
  total += lines.length;
}

fs.writeFileSync(outputPath, out.join('\n'));

console.log(`tabel : ${counts.size}`);
console.log(`baris : ${total}`);
console.log(`\nditulis ke ${outputPath}`);
if (warnings.length) {
  console.log(`\n=== ${warnings.length} peringatan ===`);
  const shown = warnings.slice(0, 20);
  for (const w of shown) console.log(`  - ${w}`);
  if (warnings.length > shown.length) console.log(`  ... dan ${warnings.length - shown.length} lainnya`);
}
