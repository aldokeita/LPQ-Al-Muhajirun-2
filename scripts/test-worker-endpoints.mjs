// Menguji endpoint autentikasi Worker lewat HTTP sungguhan.
//
// Kredensial santri dibaca dari database D1 lokal dan TIDAK PERNAH dicetak: yang tampil
// hanya bentuk tersamar. Jalankan `npx wrangler dev --port 8788 --local` lebih dulu.
//
// Pemakaian:
//   node --experimental-sqlite scripts/test-worker-endpoints.mjs [baseUrl]

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:8788';

const findLocalD1 = () => {
  const root = path.join('.wrangler', 'state', 'v3', 'd1');
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.sqlite')) return full;
    }
  }
  return null;
};

const dbPath = findLocalD1();
if (!dbPath) {
  console.error('Database D1 lokal tidak ditemukan. Jalankan dulu: npx wrangler d1 execute lpq-al-muhajirun --local --file=...');
  process.exit(1);
}

const sqlite = new DatabaseSync(dbPath, { readOnly: true });
const santri = sqlite.prepare(`
  select s.nama_panggilan, s.nomor_induk_qiroati
    from santri s
    join user_profiles up on up.id = s.id
   where up.role = 'santri' and up.status = 'active'
     and s.nomor_induk_qiroati is not null and s.nomor_induk_qiroati <> ''
     and s.nama_panggilan is not null and s.nama_panggilan <> ''
   limit 1`).get();

if (!santri) {
  console.error('Tidak ada santri yang memenuhi syarat uji di database lokal.');
  process.exit(1);
}

const mask = (value) => {
  const text = String(value);
  if (text.length <= 2) return '*'.repeat(text.length);
  return `${text[0]}${'*'.repeat(text.length - 2)}${text[text.length - 1]}`;
};

console.log(`Memakai santri ${mask(santri.nama_panggilan)} / ${mask(santri.nomor_induk_qiroati)}\n`);

let passed = 0;
let failed = 0;
const check = (label, actual, expected = true) => {
  const ok = actual === expected;
  if (ok) passed += 1; else failed += 1;
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${label}${ok ? '' : ` (dapat ${JSON.stringify(actual)}, harus ${JSON.stringify(expected)})`}`);
};

const post = (pathname, body, cookie = null) =>
  fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

const run = async () => {
  console.log('login santri:');
  const bad = await post('/api/auth/login/santri', { identifier: santri.nama_panggilan, nomor_induk: 'salah-sekali' });
  check('kredensial salah memulangkan 401', bad.status, 401);
  check('pesan gagal tidak menyebut sebabnya', (await bad.json()).error, 'invalid_login');

  const good = await post('/api/auth/login/santri', {
    identifier: santri.nama_panggilan,
    nomor_induk: santri.nomor_induk_qiroati,
  });
  check('kredensial benar memulangkan 200', good.status, 200);
  const setCookie = good.headers.get('set-cookie') ?? '';
  check('cookie sesi diterbitkan', setCookie.includes('session='));
  check('cookie HttpOnly', setCookie.includes('HttpOnly'));
  check('cookie SameSite=Lax', setCookie.includes('SameSite=Lax'));
  const payload = await good.json();
  check('peran yang dipulangkan santri', payload.user?.role, 'santri');
  check('respons tidak memuat nomor induk', JSON.stringify(payload).includes(santri.nomor_induk_qiroati), false);
  console.log('');

  const cookie = setCookie.split(';')[0];

  console.log('sesi:');
  const session = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie } });
  const sessionBody = await session.json();
  check('sesi terbaca dengan cookie', sessionBody.user?.role, 'santri');
  const anon = await fetch(`${baseUrl}/api/auth/session`);
  check('tanpa cookie memulangkan user null', (await anon.json()).user, null);
  const forged = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie: 'session=palsu.tandatangan' } });
  check('cookie palsu memulangkan user null', (await forged.json()).user, null);
  console.log('');

  console.log('logout:');
  const logout = await post('/api/auth/logout', {}, cookie);
  check('logout berhasil', logout.status, 200);
  check('cookie dikosongkan', (logout.headers.get('set-cookie') ?? '').includes('Max-Age=0'));
  console.log('');

  console.log('pembatasan percobaan lewat HTTP:');
  let blocked = false;
  let status = 0;
  for (let i = 0; i < 8; i += 1) {
    const response = await post('/api/auth/login/santri', { identifier: 'penebak-acak', nomor_induk: `salah-${i}` });
    status = response.status;
    if (status === 429) { blocked = true; break; }
  }
  check('percobaan beruntun akhirnya diblokir 429', blocked, true);
  console.log('');

  console.log('metode salah:');
  const wrongMethod = await fetch(`${baseUrl}/api/auth/login/santri`);
  check('GET ke endpoint login ditolak 405', wrongMethod.status, 405);
  console.log('');

  console.log(`lulus: ${passed}, gagal: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
