// Hook resolver agar Node bisa memuat modul frontend yang memakai alias "@/" milik Vite.
// Hanya dipakai pengujian; bundler produksi punya resolusinya sendiri.

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = process.cwd();

// Modul yang bergantung pada import.meta.env milik Vite diganti stub saat pengujian.
const STUBS = {
  '@/lib/customSupabaseClient': path.join(root, 'scripts', 'test-stubs', 'customSupabaseClient.js'),
  '@/lib/featureFlags': path.join(root, 'scripts', 'test-stubs', 'featureFlags.js'),
};

export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return nextResolve(pathToFileURL(STUBS[specifier]).href, context);
  if (!specifier.startsWith('@/')) return nextResolve(specifier, context);

  const base = path.join(root, 'src', specifier.slice(2));
  // Impor di frontend ditulis tanpa ekstensi, jadi ekstensinya dicoba satu per satu.
  const candidates = [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js')];
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!found) throw new Error(`Alias "${specifier}" tidak dapat diselesaikan dari ${base}`);

  return nextResolve(pathToFileURL(found).href, context);
}
