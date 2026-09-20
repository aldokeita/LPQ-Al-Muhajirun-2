// Membandingkan D1 lokal dengan dump Supabase, sampai ke nilai kolomnya.
//
// Menghitung baris saja tidak cukup: pengujian bisa mengubah isi baris yang sudah ada
// tanpa menambah atau mengurangi jumlahnya. Skrip ini menyusun salinan murni dari
// skema + dump di memori, lalu membandingkan setiap kolom dari setiap baris.
//
// Dipakai sebelum deploy untuk memastikan basis data lokal masih cerminan jujur dari
// Supabase, dan untuk menangkap jejak pengujian yang lolos dari pembersihan.
//
//   node --experimental-sqlite scripts/check-d1-parity.mjs <skema.sql> <dump.sql> [--perbaiki]
//
// Tanpa --perbaiki skrip hanya melapor dan keluar dengan kode 1 bila ada selisih.
// Dengan --perbaiki, baris yang menyimpang disamakan kembali dengan dump; pemicu
// dimatikan sementara supaya updated_at tidak ditulis ulang saat pemulihan.

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const [, , berkasSkema, berkasDump, ...opsi] = process.argv;
const perbaiki = opsi.includes('--perbaiki');

if (!berkasSkema || !berkasDump) {
  console.error('pemakaian: check-d1-parity.mjs <skema.sql> <dump.sql> [--perbaiki]');
  process.exit(2);
}

// Tabel yang isinya memang berubah saat aplikasi dipakai. Selisih di sini tidak
// menandakan kerusakan, jadi hanya dilaporkan tanpa membuat pemeriksaan gagal.
const TABEL_BERUBAH = new Set(['auth_rate_limits', 'login_logs', 'media_player_settings']);

// Akun admin yang disemai khusus ke D1 lokal supaya bisa masuk dashboard saat menguji.
// Id-nya sengaja tetap, dan akun ini tidak pernah ada di produksi — sudah diperiksa
// langsung ke D1 jarak jauh. Kehadirannya di lokal bukan penyimpangan.
const ADMIN_UJI_LOKAL = '11111111-2222-3333-4444-555555555555';

const cariBasisLokal = () => {
  const tumpukan = [path.join('.wrangler', 'state', 'v3', 'd1')];
  while (tumpukan.length) {
    const dir = tumpukan.pop();
    if (!fs.existsSync(dir)) continue;
    for (const entri of fs.readdirSync(dir, { withFileTypes: true })) {
      const penuh = path.join(dir, entri.name);
      if (entri.isDirectory()) tumpukan.push(penuh);
      else if (entri.name.endsWith('.sqlite')) return penuh;
    }
  }
  return null;
};

const lokasi = cariBasisLokal();
if (!lokasi) {
  console.error('D1 lokal tidak ditemukan di .wrangler/state/v3/d1 — jalankan `npx wrangler dev` lebih dulu.');
  process.exit(2);
}

const hidup = new DatabaseSync(lokasi, { readOnly: !perbaiki });

const murni = new DatabaseSync(':memory:');
murni.exec(fs.readFileSync(berkasSkema, 'utf8'));
murni.exec('PRAGMA foreign_keys = OFF;');
murni.exec(fs.readFileSync(berkasDump, 'utf8'));

const daftarTabel = hidup
  .prepare(`select name from sqlite_master where type='table'
            and name not like 'sqlite_%' and name not like '_cf%' order by name`)
  .all()
  .map((baris) => baris.name);

let masalah = 0;
let dipulihkan = 0;

// Pemicu AFTER menulis ulang updated_at, jadi dimatikan selama pemulihan.
const pemicu = perbaiki
  ? hidup.prepare("select name, sql from sqlite_master where type='trigger'").all()
  : [];
for (const t of pemicu) hidup.exec(`drop trigger if exists "${t.name}"`);

for (const tabel of daftarTabel) {
  let adaDiDump = true;
  try { murni.prepare(`select 1 from ${tabel} limit 1`).get(); } catch { adaDiDump = false; }
  if (!adaDiDump) continue;

  const kolom = hidup.prepare(`select name from pragma_table_info('${tabel}')`).all().map((c) => c.name);
  if (!kolom.includes('id')) continue;

  const asal = new Map();
  for (const baris of murni.prepare(`select * from ${tabel}`).all()) asal.set(baris.id, baris);
  const sekarang = new Map();
  for (const baris of hidup.prepare(`select * from ${tabel}`).all()) sekarang.set(baris.id, baris);

  const menyimpang = [];
  let hilang = 0;
  for (const [id, a] of asal) {
    const b = sekarang.get(id);
    if (!b) { hilang += 1; continue; }
    const kolomBeda = kolom.filter((c) => JSON.stringify(a[c]) !== JSON.stringify(b[c]));
    if (kolomBeda.length) menyimpang.push({ id, a, kolomBeda });
  }
  let tambahan = 0;
  for (const id of sekarang.keys()) {
    if (asal.has(id) || id === ADMIN_UJI_LOKAL) continue;
    tambahan += 1;
  }

  if (!menyimpang.length && !hilang && !tambahan) continue;

  const longgar = TABEL_BERUBAH.has(tabel);
  const label = longgar ? 'berubah wajar' : 'PERIKSA';
  console.log(`${label.padEnd(14)} ${tabel.padEnd(26)} nilai beda=${menyimpang.length} hilang=${hilang} tambahan=${tambahan}`);

  for (const { id, kolomBeda } of menyimpang.slice(0, 3)) {
    console.log(`      ${id.slice(0, 8)} -> ${kolomBeda.join(', ')}`);
  }

  if (!longgar) masalah += 1;

  if (perbaiki && menyimpang.length) {
    const lain = kolom.filter((c) => c !== 'id');
    const ubah = hidup.prepare(`update ${tabel} set ${lain.map((c) => `"${c}" = ?`).join(', ')} where id = ?`);
    for (const { id, a } of menyimpang) {
      ubah.run(...lain.map((c) => a[c]), id);
      dipulihkan += 1;
    }
  }
}

for (const t of pemicu) if (t.sql) hidup.exec(t.sql);

// Pemicu ikut diperiksa: pernah terjadi basis lokal punya seluruh tabel dan indeks
// tetapi nol pemicu, sehingga pengujian berjalan tanpa penjaga yang ada di produksi.
const pemicuSkema = (fs.readFileSync(berkasSkema, 'utf8').match(/CREATE TRIGGER/gi) || []).length;
const pemicuLokal = hidup.prepare("select count(*) c from sqlite_master where type='trigger'").get().c;
if (pemicuSkema !== pemicuLokal) {
  console.log(`PERIKSA        pemicu                     skema=${pemicuSkema} lokal=${pemicuLokal}`);
  masalah += 1;
}

console.log('');
if (perbaiki && dipulihkan) console.log(`${dipulihkan} baris disamakan kembali dengan dump.`);
if (masalah === 0) {
  console.log(`${daftarTabel.length} tabel sepadan dengan dump; ${pemicuLokal} pemicu terpasang.`);
  process.exit(0);
}
console.log(`${masalah} hal perlu diperiksa.`);
process.exit(1);
