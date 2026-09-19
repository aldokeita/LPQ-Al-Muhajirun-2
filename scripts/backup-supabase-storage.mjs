// Backup seluruh objek Storage Supabase sebelum migrasi ke Cloudflare R2.
// Dump database tidak menyertakan file Storage, jadi skrip ini wajib dijalankan terpisah.
//
// Prasyarat:
//   SUPABASE_URL              https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY service role key (Dashboard > Project Settings > API)
//
// Pemakaian:
//   node scripts/backup-supabase-storage.mjs --out _private_reference/backup-<stamp>
//
// Aman diulang: file yang sudah terunduh dengan ukuran sama akan dilewati, sehingga
// backup yang putus di tengah bisa dilanjutkan tanpa menarik ulang egress.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const privateRoot = path.join(root, '_private_reference');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outputDir = path.resolve(getArg('--out', path.join(privateRoot, `backup-${stamp}`)));
const concurrency = Number(getArg('--concurrency', '4'));

// Kredensial dibaca dari file env di dalam _private_reference (gitignored) supaya
// tidak perlu menempel di shell history maupun berpindah antar sesi terminal.
const envFile = path.resolve(getArg('--env-file', path.join(privateRoot, 'backup.env')));
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const split = trimmed.indexOf('=');
    if (split < 1) continue;
    const name = trimmed.slice(0, split).trim();
    if (process.env[name]) continue;
    process.env[name] = trimmed.slice(split + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

if (!supabaseUrl) fail('SUPABASE_URL belum diset.');
if (!serviceRoleKey) fail('SUPABASE_SERVICE_ROLE_KEY belum diset.');

// Hasil backup wajib berada di dalam _private_reference agar tidak pernah ter-commit.
if (path.relative(privateRoot, outputDir).startsWith('..')) {
  fail('Folder output harus berada di dalam _private_reference.');
}

const keyHeaders = () => {
  const headers = { apikey: serviceRoleKey, 'User-Agent': 'LPQ-Storage-Backup/1.0' };
  if (!serviceRoleKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${serviceRoleKey}`;
  return headers;
};

const describeError = async (response) => {
  const text = await response.text().catch(() => '');
  if (!text) return `HTTP ${response.status}`;
  try {
    const body = JSON.parse(text);
    return [body.statusCode, body.error, body.message].filter(Boolean).join(' | ') || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}: ${text.slice(0, 200)}`;
  }
};

const encodeObjectPath = (objectPath) => objectPath.split('/').map(encodeURIComponent).join('/');

const listBuckets = async () => {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, { headers: keyHeaders() });
  if (!response.ok) fail(`Gagal membaca daftar bucket: ${await describeError(response)}`);
  return response.json();
};

// Storage API memulangkan folder sebagai entri dengan id null, jadi penelusuran
// dilakukan per prefix secara rekursif dan dipaginasi 100 entri sekali jalan.
const listObjects = async (bucket, prefix = '') => {
  const collected = [];
  let offset = 0;
  const limit = 100;

  for (;;) {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      headers: { ...keyHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!response.ok) fail(`Gagal list ${bucket}/${prefix}: ${await describeError(response)}`);

    const page = await response.json();
    if (!Array.isArray(page) || page.length === 0) break;

    for (const entry of page) {
      const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        collected.push(...(await listObjects(bucket, objectPath)));
      } else {
        collected.push({
          path: objectPath,
          size: entry.metadata?.size ?? null,
          mimetype: entry.metadata?.mimetype ?? null,
          updated_at: entry.updated_at ?? null,
        });
      }
    }

    if (page.length < limit) break;
    offset += limit;
  }

  return collected;
};

const downloadObject = async (bucket, object) => {
  const segments = object.path.split('/');
  if (segments.some((segment) => segment === '..' || segment === '')) {
    throw new Error(`Path objek tidak aman: ${object.path}`);
  }

  const target = path.join(outputDir, 'storage', bucket, ...segments);
  if (path.relative(outputDir, target).startsWith('..')) {
    throw new Error(`Path objek keluar dari folder backup: ${object.path}`);
  }

  if (fs.existsSync(target) && object.size !== null && fs.statSync(target).size === object.size) {
    const bytes = fs.readFileSync(target);
    return { skipped: true, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  }

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(object.path)}`, {
    headers: keyHeaders(),
  });
  if (!response.ok) throw new Error(await describeError(response));

  const bytes = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  return { skipped: false, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
};

// Worker pool sederhana supaya unduhan paralel tetap terbatas dan tidak membanjiri project.
const runPool = async (items, worker) => {
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
};

const main = async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Backup storage -> ${outputDir}`);

  const buckets = await listBuckets();
  console.log(`Ditemukan ${buckets.length} bucket: ${buckets.map((b) => b.name).join(', ')}`);

  const manifest = { created_at: new Date().toISOString(), buckets: [] };
  const failures = [];

  for (const bucket of buckets) {
    const objects = await listObjects(bucket.id);
    const totalBytes = objects.reduce((sum, object) => sum + (object.size ?? 0), 0);
    console.log(`\n${bucket.id}: ${objects.length} objek (~${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);

    const entries = [];
    let done = 0;
    let skipped = 0;

    await runPool(objects, async (object) => {
      try {
        const result = await downloadObject(bucket.id, object);
        if (result.skipped) skipped += 1;
        entries.push({ ...object, sha256: result.sha256, bytes: result.bytes });
      } catch (error) {
        failures.push({ bucket: bucket.id, path: object.path, error: error.message });
      }
      done += 1;
      if (done % 25 === 0 || done === objects.length) {
        process.stdout.write(`  ${done}/${objects.length}\r`);
      }
    });

    console.log(`  selesai ${done}/${objects.length} (${skipped} dilewati, sudah ada)`);
    manifest.buckets.push({
      id: bucket.id,
      public: bucket.public,
      file_size_limit: bucket.file_size_limit ?? null,
      allowed_mime_types: bucket.allowed_mime_types ?? null,
      object_count: objects.length,
      objects: entries.sort((a, b) => a.path.localeCompare(b.path)),
    });
  }

  manifest.failures = failures;
  const manifestPath = path.join(outputDir, 'storage-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\nManifest: ${manifestPath}`);
  if (failures.length > 0) {
    console.error(`${failures.length} objek GAGAL diunduh. Jalankan ulang dengan --out yang sama untuk mencoba lagi.`);
    process.exit(1);
  }
  console.log('Semua objek berhasil diunduh.');
};

main().catch((error) => fail(error.message));
