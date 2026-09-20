// Menerjemahkan dump schema Postgres (pg_dump) menjadi SQL Cloudflare D1.
//
// SQLite tidak bisa menambahkan constraint lewat ALTER TABLE, sedangkan pg_dump memancarkan
// primary key, unique, dan foreign key sebagai statement terpisah. Generator ini menyatukan
// kembali semuanya ke dalam CREATE TABLE.
//
// Pemakaian:
//   node scripts/generate-d1-schema.mjs <schema-dump.sql> <output.sql>
//
// Hasilnya wajib direview manusia: keputusan tipe (terutama uang) tidak bisa disimpulkan
// otomatis dari dump dan sudah dipatok di docs/51-d1-schema-mapping.md.

import fs from 'node:fs';
import path from 'node:path';

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Pemakaian: node scripts/generate-d1-schema.mjs <schema-dump.sql> <output.sql>');
  process.exit(1);
}

const sql = fs.readFileSync(inputPath, 'utf8');
const warnings = [];

// Kolom uang: disimpan sebagai INTEGER dalam satuan sen, bukan REAL.
// SQLite tidak punya desimal presisi dan floating point melahirkan selisih rupiah.
const MONEY_COLUMNS = new Set(['payments.jumlah', 'expenses.jumlah', 'santri.default_spp_amount']);

const ENUM_VALUES = {};
for (const m of sql.matchAll(/CREATE TYPE "public"\."([a-z_0-9]+)" AS ENUM \(\n([\s\S]*?)\n\);/g)) {
  ENUM_VALUES[m[1]] = m[2].split('\n').map((l) => l.trim().replace(/[,']/g, '')).filter(Boolean);
}

// Membuang cast Postgres dan mengutip ulang identifier agar bisa dibaca SQLite.
const stripCasts = (expr) =>
  expr
    .replace(/::"?public"?\."?[a-z_0-9]+"?/g, '')
    .replace(/::"?[a-z_0-9]+"?(\[\])?/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Postgres menulis keanggotaan himpunan sebagai = ANY (ARRAY[...]); SQLite memakai IN (...).
const rewriteAnyArray = (expr) =>
  expr.replace(/=\s*ANY\s*\(\s*ARRAY\[([^\]]*)\]\s*\)/gi, (_, items) => {
    const values = items
      .split(',')
      .map((v) => stripCasts(v.trim()))
      .filter(Boolean);
    return `IN (${values.join(', ')})`;
  });

// pg_dump mengutip nama fungsi bawaan. SQLite tidak mengenalinya dalam bentuk terkutip,
// dan btrim tidak ada padanannya kecuali trim.
const FUNCTION_MAP = { btrim: 'trim', length: 'length', lower: 'lower', upper: 'upper' };

const rewriteFunctions = (expr) =>
  expr.replace(/"([a-z_][a-z_0-9]*)"\s*\(/g, (whole, name) => {
    const mapped = FUNCTION_MAP[name];
    if (mapped) return `${mapped}(`;
    warnings.push(`Fungsi "${name}" dipakai dalam ekspresi tetapi tidak ada di daftar padanan SQLite.`);
    return whole;
  });

// SQLite tidak punya operator regex. Predikat "tidak mengandung spasi putih" diterjemahkan
// menjadi pemeriksaan eksplisit atas keenam karakter yang dicakup \s di Postgres:
// spasi, tab (9), newline (10), vertical tab (11), form feed (12), dan carriage return (13).
const WHITESPACE_CODES = [9, 10, 11, 12, 13];

const rewriteNoWhitespaceRegex = (expr) =>
  expr.replace(/("?[a-z_0-9]+"?)\s*!~\s*'\\s'/gi, (_, column) => {
    warnings.push(`${column}: operator regex !~ '\\s' diterjemahkan menjadi pemeriksaan spasi eksplisit.`);
    const checks = WHITESPACE_CODES.map((code) => `instr(${column}, char(${code})) = 0`);
    return [`${column} NOT LIKE '% %'`, ...checks].join(' AND ');
  });

const convertCheck = (expr) => {
  let out = rewriteAnyArray(expr);
  out = stripCasts(out);
  out = rewriteFunctions(out);
  out = rewriteNoWhitespaceRegex(out);
  out = out.replace(/\(\s*0\s*\)/g, '0');
  if (/[!~]~|~\s*'/.test(out)) {
    warnings.push(`Ekspresi masih memuat operator regex Postgres: ${out.slice(0, 80)}`);
  }
  return out;
};

// Tabel users menggantikan auth.users milik Supabase, yang 61 foreign key menunjuk padanya.
// Hanya kolom yang benar-benar dipakai yang dibawa; sisanya token internal Supabase.
// password_algorithm menopang rencana rehash bertahap di docs/51-d1-schema-mapping.md.
const USERS_TABLE = `CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "encrypted_password" TEXT,
  "password_algorithm" TEXT NOT NULL DEFAULT 'bcrypt' CHECK ("password_algorithm" IN ('bcrypt', 'pbkdf2')),
  "email_confirmed_at" TEXT,
  "last_sign_in_at" TEXT,
  "banned_until" TEXT,
  "raw_user_meta_data" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "deleted_at" TEXT,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users" ("email") WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX "users_phone_key" ON "users" ("phone") WHERE "phone" IS NOT NULL;
`;

const normalizeType = (pgType) =>
  pgType
    .replace(/"public"\./g, '')
    .replace(/public\./g, '')
    .replace(/"/g, '')
    .toLowerCase()
    .trim();

const mapType = (pgType, qualified) => {
  const t = normalizeType(pgType);
  if (MONEY_COLUMNS.has(qualified)) return 'INTEGER';
  if (t.startsWith('numeric')) {
    warnings.push(`${qualified}: numeric di luar daftar kolom uang, dipetakan ke INTEGER — periksa satuannya.`);
    return 'INTEGER';
  }
  if (t === 'uuid' || t === 'text' || t === 'date' || t.startsWith('character varying')) return 'TEXT';
  if (t.startsWith('timestamp') || t.startsWith('time ')) return 'TEXT';
  if (t === 'boolean') return 'INTEGER';
  if (t === 'integer' || t === 'smallint' || t === 'bigint') return 'INTEGER';
  if (t === 'jsonb' || t === 'json') return 'TEXT';
  if (t.endsWith('[]')) return 'TEXT';
  if (ENUM_VALUES[t]) return 'TEXT';
  warnings.push(`${qualified}: tipe "${t}" tidak dikenali, dipetakan ke TEXT.`);
  return 'TEXT';
};

const mapDefault = (def, pgType, qualified) => {
  if (!def) return null;
  const d = def.trim();
  // UUID dibuat di Worker lewat crypto.randomUUID(); SQLite tidak punya padanannya.
  if (/gen_random_uuid/.test(d)) return null;
  if (/^"?now"?\(\)$/i.test(d)) return "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";
  if (/^CURRENT_DATE$/i.test(d)) return "(date('now'))";
  if (/^false$/i.test(d)) return '0';
  if (/^true$/i.test(d)) return '1';
  if (/^'\{\}'::"?jsonb"?$/i.test(d)) return "'{}'";
  if (/^'\{\}'::"?text"?\[\]$/i.test(d)) return "'[]'";
  if (MONEY_COLUMNS.has(qualified)) {
    const numeric = d.match(/^-?\d+(\.\d+)?$/);
    if (numeric) return String(Math.round(Number(d) * 100));
  }
  const stripped = stripCasts(d);
  if (/^-?\d+(\.\d+)?$/.test(stripped) || /^'.*'$/.test(stripped)) return stripped;
  warnings.push(`${qualified}: default "${d}" tidak diterjemahkan, dihilangkan.`);
  return null;
};

// --- Parsing -------------------------------------------------------------------------

const tables = new Map();
for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"public"\."([a-z_0-9]+)" \(\n([\s\S]*?)\n\);/g)) {
  const name = m[1];
  const columns = [];
  const checks = [];
  for (const raw of m[2].split('\n')) {
    const line = raw.trim().replace(/,$/, '');
    if (!line) continue;
    const checkMatch = line.match(/^CONSTRAINT "([^"]+)" CHECK \(([\s\S]*)\)$/i);
    if (checkMatch) {
      checks.push({ name: checkMatch[1], expression: checkMatch[2] });
      continue;
    }
    if (/^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|EXCLUDE)\b/i.test(line)) continue;
    const cm = line.match(/^"([a-z_0-9]+)"\s+(.+)$/i);
    if (!cm) continue;
    const rest = cm[2];
    const pgType = rest.split(/\s+(?=DEFAULT\b|NOT NULL\b|GENERATED\b|COLLATE\b|CONSTRAINT\b)/i)[0].trim();
    columns.push({
      name: cm[1],
      pgType,
      notNull: /\bNOT NULL\b/i.test(rest),
      pgDefault: (rest.match(/DEFAULT\s+(.+?)(?:\s+NOT NULL)?$/i) || [])[1] || null,
    });
  }
  tables.set(name, { name, columns, checks, primaryKey: null, uniques: [], foreignKeys: [] });
}

// pg_dump memancarkan constraint sebagai ALTER TABLE dua baris.
const alterRe = /ALTER TABLE (?:ONLY )?"public"\."([a-z_0-9]+)"\n\s+ADD CONSTRAINT "([^"]+)" ([\s\S]*?);\n/g;
for (const m of sql.matchAll(alterRe)) {
  const table = tables.get(m[1]);
  if (!table) continue;
  const body = m[3].replace(/\s+/g, ' ').trim();

  const pk = body.match(/^PRIMARY KEY \(([^)]+)\)$/i);
  if (pk) {
    table.primaryKey = pk[1].split(',').map((c) => c.trim());
    continue;
  }
  const uq = body.match(/^UNIQUE \(([^)]+)\)$/i);
  if (uq) {
    table.uniques.push({ name: m[2], columns: uq[1].split(',').map((c) => c.trim()) });
    continue;
  }
  // Referensi ke auth.users dialihkan ke tabel users bikinan sendiri.
  const fk = body.match(/^FOREIGN KEY \(([^)]+)\) REFERENCES "(public|auth)"\."([a-z_0-9]+)"\(([^)]+)\)(.*)$/i);
  if (fk) {
    const schema = fk[2].toLowerCase();
    const refTable = fk[3];
    if (schema === 'auth' && refTable !== 'users') {
      warnings.push(`${m[1]}: foreign key "${m[2]}" menunjuk ke auth.${refTable} yang tidak dimigrasikan — dilewati.`);
      continue;
    }
    table.foreignKeys.push({
      name: m[2],
      columns: fk[1].split(',').map((c) => c.trim()),
      refTable: schema === 'auth' ? 'users' : refTable,
      refColumns: fk[4].split(',').map((c) => c.trim()),
      actions: fk[5].trim(),
      external: schema === 'auth',
    });
    continue;
  }
  warnings.push(`${m[1]}: constraint "${m[2]}" tidak dikenali dan dilewati — ${body.slice(0, 80)}`);
}

// Setiap index berada dalam satu baris di dump ini, jadi polanya ditambatkan per baris.
// Pola lintas baris sebelumnya membuat index parsial dengan kurung bersarang di klausa
// WHERE menelan definisi index berikutnya.
const indexes = [];
// Klausa WHERE tidak selalu berkurung: pg_dump menulis WHERE "is_active" apa adanya
// untuk predikat kolom boolean.
const indexRe = /^CREATE (UNIQUE )?INDEX "([a-z_0-9]+)" ON "public"\."([a-z_0-9]+)" USING "([a-z]+)" \((.+)\)(?: WHERE (.+))?;$/gm;
for (const m of sql.matchAll(indexRe)) {
  let columns = m[5].trim();
  let where = m[6] ? m[6].trim() : null;
  // Pola serakah pada daftar kolom ikut menelan kurung penutup klausa WHERE berkurung.
  if (!where && /\)\s+WHERE\s+\(/i.test(columns)) {
    const split = columns.match(/^(.*)\)\s+WHERE\s+\((.*)$/i);
    columns = split[1].trim();
    where = split[2].trim();
  }
  indexes.push({
    unique: Boolean(m[1]),
    name: m[2],
    table: m[3],
    method: m[4],
    columns: rewriteFunctions(stripCasts(columns)),
    where: where ? rewriteFunctions(stripCasts(where)) : null,
  });
}

const declaredIndexes = (sql.match(/^CREATE (?:UNIQUE )?INDEX "/gm) || []).length;
if (declaredIndexes !== indexes.length) {
  warnings.push(`Index di dump ${declaredIndexes}, terparsing ${indexes.length} — ada yang tidak terbaca polanya.`);
}

// --- Emit ----------------------------------------------------------------------------

const out = [];
out.push('-- Skema Cloudflare D1, dihasilkan dari dump produksi Supabase.');
out.push('-- Dibuat oleh scripts/generate-d1-schema.mjs. Jangan diedit langsung:');
out.push('-- ubah generatornya lalu jalankan ulang, agar tetap bisa direproduksi.');
out.push('--');
out.push('-- Keputusan pemetaan tipe ada di docs/51-d1-schema-mapping.md.');
out.push('-- Kolom uang disimpan sebagai INTEGER dalam satuan sen.');
out.push('-- UUID tidak punya default: dibuat di Worker lewat crypto.randomUUID().');
out.push('');
out.push('-- Kolom array Postgres (text[]) disimpan sebagai array JSON dalam kolom TEXT:');
out.push('--   guru.roles          hanya dibaca utuh lalu disaring di klien');
out.push('--   santri.juz_hafalan  difilter keanggotaannya, pakai:');
out.push('--     WHERE EXISTS (SELECT 1 FROM json_each("santri"."juz_hafalan") WHERE "value" = ?)');
out.push('--');
out.push('-- Index GIN "guru_roles_gin_idx" sengaja tidak dibawa: tidak ada function maupun query');
out.push('-- yang memakainya, jadi tidak ada yang hilang. json_each tidak bisa diindeks di SQLite,');
out.push('-- tetapi santri hanya berisi ratusan baris sehingga pemindaian penuh tetap murah.');
out.push('');
out.push('PRAGMA foreign_keys = ON;');
out.push('');
out.push(USERS_TABLE);

// Urutkan agar tabel yang direferensikan dibuat lebih dulu.
const ordered = [];
const seen = new Set();
const visit = (name, trail = new Set()) => {
  if (seen.has(name) || !tables.has(name)) return;
  if (trail.has(name)) {
    warnings.push(`Siklus foreign key melibatkan "${name}" — urutan pembuatan tabel perlu diperiksa manual.`);
    return;
  }
  trail.add(name);
  for (const fk of tables.get(name).foreignKeys) {
    if (fk.refTable !== name) visit(fk.refTable, trail);
  }
  trail.delete(name);
  if (seen.has(name)) return;
  seen.add(name);
  ordered.push(name);
};
for (const name of [...tables.keys()].sort()) visit(name);

for (const name of ordered) {
  const table = tables.get(name);
  const parts = [];

  for (const col of table.columns) {
    const qualified = `${name}.${col.name}`;
    const type = mapType(col.pgType, qualified);
    const bits = [`  "${col.name}" ${type}`];
    if (col.notNull) bits.push('NOT NULL');
    const def = mapDefault(col.pgDefault, col.pgType, qualified);
    if (def !== null) bits.push(`DEFAULT ${def}`);

    // Enum Postgres menjadi TEXT berpagar CHECK.
    const enumName = normalizeType(col.pgType);
    if (ENUM_VALUES[enumName]) {
      const allowed = ENUM_VALUES[enumName].map((v) => `'${v}'`).join(', ');
      bits.push(`CHECK ("${col.name}" IN (${allowed}))`);
    }
    parts.push(bits.join(' '));
  }

  if (table.primaryKey) {
    parts.push(`  PRIMARY KEY (${table.primaryKey.map((c) => c).join(', ')})`);
  } else {
    warnings.push(`${name}: tidak punya primary key.`);
  }

  for (const uq of table.uniques) parts.push(`  CONSTRAINT "${uq.name}" UNIQUE (${uq.columns.join(', ')})`);
  for (const chk of table.checks) parts.push(`  CONSTRAINT "${chk.name}" CHECK (${convertCheck(chk.expression)})`);
  for (const fk of table.foreignKeys) {
    const actions = fk.actions ? ` ${fk.actions}` : '';
    parts.push(
      `  CONSTRAINT "${fk.name}" FOREIGN KEY (${fk.columns.join(', ')}) REFERENCES "${fk.refTable}" (${fk.refColumns.join(', ')})${actions}`,
    );
  }

  out.push(`CREATE TABLE "${name}" (`);
  out.push(parts.join(',\n'));
  out.push(');');
  out.push('');
}

// Trigger.
//
// Postgres memakai trigger BEFORE yang mengubah NEW sebelum baris ditulis. SQLite tidak
// punya bentuk itu, jadi padanannya trigger AFTER yang menulis ulang kolomnya. Setiap
// trigger diberi penjaga WHEN agar tidak memicu dirinya sendiri bila recursive_triggers
// menyala, sekaligus membuatnya idempoten.
const triggerTables = new Set();
for (const m of sql.matchAll(/CREATE (?:OR REPLACE )?TRIGGER "[a-z_0-9]+"[\s\S]*?ON "public"\."([a-z_0-9]+)"[\s\S]*?EXECUTE FUNCTION "public"\."set_updated_at"/g)) {
  triggerTables.add(m[1]);
}

out.push('-- Trigger updated_at');
out.push('');
const NOW_EXPR = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
for (const table of [...triggerTables].sort()) {
  if (!tables.has(table) || !tables.get(table).columns.some((c) => c.name === 'updated_at')) {
    warnings.push(`Trigger updated_at dilewati: tabel "${table}" tidak punya kolom updated_at.`);
    continue;
  }
  out.push(`CREATE TRIGGER "set_${table}_updated_at" AFTER UPDATE ON "${table}"`);
  out.push(`FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"`);
  out.push('BEGIN');
  out.push(`  UPDATE "${table}" SET "updated_at" = ${NOW_EXPR} WHERE "id" = NEW."id";`);
  out.push('END;');
  out.push('');
}

// Status hafalan selalu diturunkan dari nilainya, tidak pernah dipercayakan ke pemanggil.
if (tables.has('hafalan_progress')) {
  const statusExpr = `CASE WHEN NEW."score" = 4 THEN 'lulus' ELSE 'proses' END`;
  out.push('-- Status hafalan mengikuti nilai');
  out.push('');
  for (const [event, clause] of [['INSERT', 'AFTER INSERT ON "hafalan_progress"'], ['UPDATE', 'AFTER UPDATE OF "score", "status" ON "hafalan_progress"']]) {
    out.push(`CREATE TRIGGER "sync_hafalan_status_on_${event.toLowerCase()}" ${clause}`);
    out.push(`FOR EACH ROW WHEN NEW."status" IS NOT ${statusExpr}`);
    out.push('BEGIN');
    out.push(`  UPDATE "hafalan_progress" SET "status" = ${statusExpr} WHERE "id" = NEW."id";`);
    out.push('END;');
    out.push('');
  }
}

// View.
//
// Di Postgres, view payment_status_summary membawa otorisasinya sendiri di klausa WHERE,
// memanggil is_admin(), user_owns_santri_record(), dan guru_has_class_access(). Fungsi
// itu tidak ada di D1, jadi view dibuat tanpa klausa tersebut dan pemeriksaannya pindah
// ke worker/auth/policies.js. Membiarkan view menyaring sendiri bukan pilihan; membiarkan
// tanpa pengganti berarti tabel pembayaran terbuka.
if (/CREATE OR REPLACE VIEW "public"\."payment_status_summary"/.test(sql)) {
  out.push('-- View');
  out.push('--');
  out.push('-- Otorisasi view ini dipindahkan ke lapisan kebijakan Worker; lihat');
  out.push('-- payment_status_summary di worker/auth/policies.js.');
  out.push('');
  out.push(`CREATE VIEW "payment_status_summary" AS
SELECT
  s."id" AS "santri_id",
  cm."class_id" AS "class_id",
  p."bulan" AS "bulan",
  p."tahun" AS "tahun",
  CASE WHEN EXISTS (
    SELECT 1 FROM "payments" p2
     WHERE p2."santri_id" = s."id"
       AND p2."bulan" IS p."bulan"
       AND p2."tahun" IS p."tahun"
       AND p2."status" = 'paid'
       AND p2."deleted_at" IS NULL
  ) THEN 'Lunas' ELSE 'Belum Lunas' END AS "status"
FROM "santri" s
JOIN "class_memberships" cm ON cm."santri_id" = s."id" AND cm."status" = 'active'
LEFT JOIN "payments" p ON p."santri_id" = s."id" AND p."deleted_at" IS NULL;`);
  out.push('');
} else {
  warnings.push('View payment_status_summary tidak ditemukan di dump — periksa apakah masih ada.');
}

out.push('-- Index');
out.push('');
for (const idx of indexes.sort((a, b) => a.table.localeCompare(b.table) || a.name.localeCompare(b.name))) {
  if (idx.method !== 'btree') {
    warnings.push(`Index "${idx.name}" memakai ${idx.method}, tidak ada padanannya di SQLite — dilewati.`);
    out.push(`-- DILEWATI: "${idx.name}" pada "${idx.table}" memakai ${idx.method}.`);
    continue;
  }
  const where = idx.where ? ` WHERE ${rewriteAnyArray(idx.where)}` : '';
  out.push(`CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX "${idx.name}" ON "${idx.table}" (${idx.columns})${where};`);
}
out.push('');

fs.writeFileSync(outputPath, `${out.join('\n')}`);

// Manifest kolom dipakai lapisan data untuk memvalidasi nama tabel dan kolom sebelum
// merangkainya ke SQL. Nama tabel dan kolom tidak bisa diparameterkan, jadi satu-satunya
// pengaman adalah mencocokkannya dengan daftar yang dihasilkan dari skema ini.
const manifest = {};
// View ikut didaftarkan agar lapisan data mengenali kolomnya; tanpa ini setiap query ke
// view akan ditolak sebagai tabel tak dikenal.
const VIEW_COLUMNS = {
  payment_status_summary: ['santri_id', 'class_id', 'bulan', 'tahun', 'status'],
};
// Kolom jsonb dan array Postgres disimpan sebagai TEXT berisi JSON di D1. Daftarnya ikut
// dihasilkan agar lapisan data bisa membongkar dan merangkainya sendiri, dan tidak ada
// modul yang perlu mengingat kolom mana yang perlu diperlakukan begitu.
const jsonColumns = {};
const moneyColumns = {};
for (const name of ordered) {
  const table = tables.get(name);
  manifest[name] = table.columns.map((c) => c.name);

  const money = table.columns.filter((c) => MONEY_COLUMNS.has(`${name}.${c.name}`)).map((c) => c.name);
  if (money.length > 0) moneyColumns[name] = money;
  const encoded = table.columns
    .filter((c) => {
      const type = normalizeType(c.pgType);
      return type === 'jsonb' || type === 'json' || type.endsWith('[]');
    })
    .map((c) => c.name);
  if (encoded.length > 0) jsonColumns[name] = encoded;
}
Object.assign(manifest, VIEW_COLUMNS);

const manifestPath = outputPath.replace(/\.sql$/, '').replace(/[^/\\]+$/, '') + '../worker/data/schema-manifest.js';
const manifestBody = `// Dihasilkan oleh scripts/generate-d1-schema.mjs. Jangan diedit langsung.
// Daftar kolom sah per tabel, dipakai untuk memvalidasi query sebelum dirangkai ke SQL.

export const SCHEMA_COLUMNS = ${JSON.stringify(manifest, null, 2)};

// Kolom yang isinya JSON: dibongkar saat dibaca, dirangkai saat ditulis.
export const JSON_COLUMNS = ${JSON.stringify(jsonColumns, null, 2)};

// Kolom uang disimpan sebagai INTEGER dalam satuan sen, sementara seluruh aplikasi
// bekerja dengan rupiah desimal. Konversinya dilakukan lapisan data agar tidak ada
// pemanggil yang perlu mengingatnya — salah arah sekali saja menghasilkan angka seratus
// kali lipat atau seperseratusnya, tanpa galat apa pun.
export const MONEY_COLUMNS = ${JSON.stringify(moneyColumns, null, 2)};

export const isMoneyColumn = (table, column) =>
  Object.prototype.hasOwnProperty.call(MONEY_COLUMNS, table) && MONEY_COLUMNS[table].includes(column);

export const isJsonColumn = (table, column) =>
  Object.prototype.hasOwnProperty.call(JSON_COLUMNS, table) && JSON_COLUMNS[table].includes(column);

export const tableExists = (table) => Object.prototype.hasOwnProperty.call(SCHEMA_COLUMNS, table);

export const columnExists = (table, column) =>
  tableExists(table) && SCHEMA_COLUMNS[table].includes(column);
`;
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, manifestBody);
console.log(`manifest kolom -> ${path.normalize(manifestPath)}`);

console.log(`tabel  : ${ordered.length}`);
console.log(`index  : ${indexes.length}`);
console.log(`check  : ${[...tables.values()].reduce((s, t) => s + t.checks.length, 0)}`);
console.log(`unique : ${[...tables.values()].reduce((s, t) => s + t.uniques.length, 0)}`);
console.log(`fk     : ${[...tables.values()].reduce((s, t) => s + t.foreignKeys.length, 0)}`);
console.log(`\nditulis ke ${outputPath}`);
if (warnings.length) {
  console.log(`\n=== ${warnings.length} peringatan ===`);
  for (const w of warnings) console.log(`  - ${w}`);
}
