// Mencari nama impor yang tertutupi deklarasi lokal di berkas yang sama.
//
// Ini menangkap satu jenis kesalahan yang sangat sunyi. Pemindahan ke lapisan adapter
// mengganti banyak pemanggilan menjadi fungsi bernama seperti fetchGuru — dan kalau
// komponennya sudah punya fungsi bernama sama, deklarasi lokal menutupi impornya tanpa
// galat apa pun. Pemanggilan di dalamnya lalu memanggil dirinya sendiri: rekursi tanpa
// henti yang hanya terlihat saat halamannya dibuka.
//
// Persis itu yang terjadi pada GuruManagement.jsx, dan tidak satu pun dari lint, build,
// maupun uji menangkapnya.
//
// Pemakaian: node scripts/check-shadowed-imports.mjs

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(root, 'src');

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(jsx?|mjs)$/.test(entry.name)) files.push(full);
  }
};
walk(sourceRoot);

// Nama yang diimpor: menangkap bentuk { a, b as c } dan default.
const importedNames = (text) => {
  const names = new Set();
  const re = /import\s+([^;]+?)\s+from\s+['"][^'"]+['"]/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const clause = match[1];
    const braced = clause.match(/\{([^}]*)\}/);
    if (braced) {
      for (const part of braced[1].split(',')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        // "x as y" berarti nama lokalnya y, dan itu yang bisa tertutupi.
        const alias = trimmed.split(/\s+as\s+/);
        names.add((alias[1] ?? alias[0]).trim());
      }
    }
    const bare = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
    if (bare && !bare.startsWith('*')) names.add(bare.split(/\s+/)[0]);
  }
  names.delete('');
  return names;
};

// Hanya deklarasi lokal yang berupa FUNGSI yang dilaporkan.
//
// Yang berbahaya adalah fungsi lokal yang menutupi fungsi impor bernama sama, karena
// pemanggilan di dalamnya diam-diam berubah menjadi rekursi. Variabel biasa yang kebetulan
// senama — misalnya `const query = teks.trim()` di dalam sebuah callback — tidak pernah
// dipanggil, jadi tidak menimbulkan masalah. Melaporkannya hanya akan membuat pemeriksaan
// ini diabaikan.
const FUNCTION_DECL = new RegExp(
  '(?:^|\\n)\\s*(?:'
  + 'async\\s+function\\s+([A-Za-z_$][\\w$]*)'
  + '|function\\s+([A-Za-z_$][\\w$]*)'
  + '|(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:async\\s*)?(?:\\(|function\\b|useCallback\\b|[A-Za-z_$][\\w$]*\\s*=>)'
  + ')',
  'g',
);

const declaredFunctions = (text) => {
  const names = new Map();
  let match;
  FUNCTION_DECL.lastIndex = 0;
  while ((match = FUNCTION_DECL.exec(text)) !== null) {
    const name = match[1] || match[2] || match[3];
    if (name && !names.has(name)) {
      names.set(name, text.slice(0, match.index).split('\n').length + 1);
    }
  }
  return names;
};

let temuan = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const imported = importedNames(text);
  const declared = declaredFunctions(text);

  for (const [name, line] of declared) {
    if (!imported.has(name)) continue;
    temuan += 1;
    console.log(`${path.relative(root, file)}:${line}  fungsi lokal "${name}" menutupi impor bernama sama`);
  }
}

console.log(temuan === 0
  ? '\nTidak ada nama impor yang tertutupi.'
  : `\n${temuan} nama tertutupi. Beri alias pada impornya, atau ganti nama yang lokal.`);
process.exit(temuan === 0 ? 0 : 1);
