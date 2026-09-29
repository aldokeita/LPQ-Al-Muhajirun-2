// Membuktikan sebuah backup di R2 benar-benar bisa dipulihkan.
//
// Dipisah dari backup-d1-to-r2.mjs karena menjawab pertanyaan yang berbeda. Skrip
// backup membuktikan berkas yang baru saja ia tulis; skrip ini membuktikan berkas
// yang sudah lama tersimpan — termasuk yang dibuat oleh jadwal, di mesin lain,
// berminggu-minggu lalu. Backup yang tidak pernah diperiksa ulang hanya asumsi.
//
// Tidak menyentuh apa pun yang hidup: isinya dimuat ke SQLite sementara di memori.
//
// Pemakaian:
//   node scripts/verify-d1-backup.mjs --key backups/d1/d1-2026-09-29-12-42.sql.gz

import { execFile } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

const fail = (message) => { console.error(`ERROR: ${message}`); process.exit(1); };

const kunci = getArg('--key', '');
const bucket = getArg('--bucket', 'lpq-al-muhajirun-files');
if (!kunci) fail('Tentukan objek yang diperiksa dengan --key backups/d1/<nama>.sql.gz');

const wranglerEntry = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

// Tabel yang harus ada isinya. Dump yang secara teknis sah tetapi kehilangan salah
// satu dari ini bukan backup yang berguna.
const WAJIB_BERISI = ['santri', 'guru', 'classes', 'payments', 'attendance', 'user_profiles', 'website_content'];

const main = async () => {
  const kerja = fs.mkdtempSync(path.join(os.tmpdir(), 'lpq-verifikasi-'));
  const gz = path.join(kerja, 'backup.sql.gz');
  const sql = path.join(kerja, 'backup.sql');

  try {
    console.log(`Objek : r2://${bucket}/${kunci}\n`);

    await run(process.execPath,
      [wranglerEntry, 'r2', 'object', 'get', `${bucket}/${kunci}`, '--remote', '--file', gz],
      { cwd: root, maxBuffer: 64 * 1024 * 1024 });
    if (!fs.existsSync(gz)) fail('Objek tidak ditemukan di R2.');
    console.log(`diunduh    : ${(fs.statSync(gz).size / 1024 / 1024).toFixed(2)} MB`);

    await pipeline(createReadStream(gz), createGunzip(), createWriteStream(sql));
    console.log(`dibuka     : ${(fs.statSync(sql).size / 1024 / 1024).toFixed(2)} MB`);

    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec(fs.readFileSync(sql, 'utf8'));

    const tabel = db.prepare(
      "select count(*) c from sqlite_master where type='table' and name not like 'sqlite_%'").get().c;
    const pemicu = db.prepare("select count(*) c from sqlite_master where type='trigger'").get().c;
    console.log(`dipulihkan : ${tabel} tabel, ${pemicu} pemicu\n`);

    let kosong = 0;
    for (const t of WAJIB_BERISI) {
      let n = null;
      try { n = db.prepare(`select count(*) c from ${t}`).get().c; } catch { n = null; }
      if (n === null) { console.log(`  ${t.padEnd(16)} TIDAK ADA`); kosong += 1; continue; }
      console.log(`  ${t.padEnd(16)} ${n}`);
      if (n === 0) kosong += 1;
    }
    db.close();

    if (tabel < 30) fail(`Hanya ${tabel} tabel yang dipulihkan; seharusnya sekitar 37.`);
    if (kosong) fail(`${kosong} tabel wajib kosong atau hilang.`);

    console.log('\nBackup ini terbukti bisa dipulihkan.');
  } finally {
    fs.rmSync(kerja, { recursive: true, force: true });
  }
};

main().catch((error) => fail(error.message));
