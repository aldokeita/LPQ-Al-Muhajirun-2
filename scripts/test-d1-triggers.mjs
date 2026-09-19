// Menguji trigger hasil pemindahan dari Postgres.
//
// Postgres memakai trigger BEFORE yang mengubah NEW; SQLite hanya punya AFTER, jadi
// padanannya menulis ulang kolom setelah baris tersimpan. Yang perlu dibuktikan: hasil
// akhirnya sama, dan triggernya tidak memicu dirinya sendiri.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-d1-triggers.mjs <schema.sql>

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import crypto from 'node:crypto';

const schemaPath = process.argv[2];
if (!schemaPath) {
  console.error('Pemakaian: node --experimental-sqlite scripts/test-d1-triggers.mjs <schema.sql>');
  process.exit(1);
}

const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync(schemaPath, 'utf8'));

let passed = 0;
let failed = 0;
const check = (label, actual, expected = true) => {
  const ok = actual === expected;
  if (ok) passed += 1; else failed += 1;
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${label}${ok ? '' : ` (dapat ${JSON.stringify(actual)}, harus ${JSON.stringify(expected)})`}`);
};

const triggers = db.prepare("select count(*) c from sqlite_master where type = 'trigger'").get().c;
console.log(`trigger terpasang: ${triggers}\n`);

console.log('updated_at otomatis:');
const userId = crypto.randomUUID();
db.prepare('insert into users (id, email) values (?, ?)').run(userId, 'pemicu@contoh.test');
const santriId = userId;
db.prepare(`insert into santri (id, nama_lengkap, updated_at) values (?, ?, ?)`)
  .run(santriId, 'Santri Uji', '2020-01-01T00:00:00.000Z');

const before = db.prepare('select updated_at from santri where id = ?').get(santriId).updated_at;
db.prepare("update santri set nama_lengkap = 'Santri Uji Diubah' where id = ?").run(santriId);
const after = db.prepare('select updated_at from santri where id = ?').get(santriId).updated_at;
check('updated_at berubah setelah update', after !== before, true);
check('updated_at berformat ISO', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(after), true);

// Nilai yang ditulis pemanggil secara eksplisit dihormati, tidak ditimpa trigger.
db.prepare("update santri set nama_lengkap = 'Lagi', updated_at = ? where id = ?")
  .run('2030-05-05T05:05:05.000Z', santriId);
const explicit = db.prepare('select updated_at from santri where id = ?').get(santriId).updated_at;
check('nilai eksplisit dari pemanggil dipertahankan', explicit, '2030-05-05T05:05:05.000Z');
console.log('');

console.log('status hafalan mengikuti nilai:');
const itemId = crypto.randomUUID();
db.prepare('insert into hafalan_items (id, category, item_name, item_order) values (?, ?, ?, ?)')
  .run(itemId, 'tahfizh', 'Surah Uji', 1);

const progressId = crypto.randomUUID();
db.prepare(`insert into hafalan_progress (id, santri_id, item_id, score, status) values (?, ?, ?, ?, ?)`)
  .run(progressId, santriId, itemId, 4, 'proses');
check('score 4 saat insert menjadi lulus', db.prepare('select status from hafalan_progress where id = ?').get(progressId).status, 'lulus');

db.prepare('update hafalan_progress set score = 2 where id = ?').run(progressId);
check('score turun menjadi proses', db.prepare('select status from hafalan_progress where id = ?').get(progressId).status, 'proses');

db.prepare('update hafalan_progress set score = 4 where id = ?').run(progressId);
check('score naik kembali menjadi lulus', db.prepare('select status from hafalan_progress where id = ?').get(progressId).status, 'lulus');

// Status yang dikirim pemanggil tidak dipercaya: nilai tetap yang menentukan.
db.prepare("update hafalan_progress set status = 'proses' where id = ?").run(progressId);
check('status kiriman pemanggil dikoreksi ulang oleh nilai', db.prepare('select status from hafalan_progress where id = ?').get(progressId).status, 'lulus');
console.log('');

console.log(`lulus: ${passed}, gagal: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
