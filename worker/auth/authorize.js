// Penegak kebijakan. Ini satu-satunya pintu menuju D1 untuk data aplikasi.
//
// Query yang menembus langsung ke env.DB sama saja dengan policy yang hilang. Tidak ada
// lagi RLS di level database yang menahannya, jadi disiplin ini yang menggantikan.

import { PREDICATES, SCOPED_PREDICATES, createAuthContext } from './predicates.js';
import { getPolicy } from './policies.js';

export class AuthorizationError extends Error {
  constructor(message, { table, command, status = 403 } = {}) {
    super(message);
    this.name = 'AuthorizationError';
    this.table = table;
    this.command = command;
    this.status = status;
  }
};

const COMMANDS = new Set(['select', 'insert', 'update', 'delete']);

// Menguji satu baris terhadap daftar predikat. Policy PERMISSIVE digabung dengan OR,
// jadi satu yang terpenuhi sudah cukup.
const anyPredicatePasses = async (ctx, rules, scopeValue) => {
  for (const rule of rules) {
    const predicate = PREDICATES[rule];
    if (!predicate) throw new Error(`Predikat "${rule}" tidak dikenal.`);
    const passed = SCOPED_PREDICATES.has(rule)
      ? await predicate(ctx, scopeValue)
      : await predicate(ctx);
    if (passed) return true;
  }
  return false;
};

export const createAuthorizer = (db, userId) => {
  const ctx = createAuthContext(db, userId);

  const requirePolicy = (table, command) => {
    if (!COMMANDS.has(command)) throw new Error(`Perintah "${command}" tidak dikenal.`);
    const policy = getPolicy(table);
    if (!policy) {
      throw new AuthorizationError(`Tabel "${table}" tidak punya kebijakan.`, { table, command, status: 500 });
    }
    if (policy.internal) {
      throw new AuthorizationError(`Tabel "${table}" hanya boleh disentuh kode internal.`, { table, command });
    }
    return policy;
  };

  return {
    ctx,

    // Memeriksa akses terhadap satu baris yang sudah di tangan.
    async can(table, command, row = null) {
      const policy = requirePolicy(table, command);
      const rules = policy[command] ?? [];
      const scopeValue = policy.scopeColumn && row ? row[policy.scopeColumn] : null;

      // Baris tanpa nilai scope tidak bisa diperiksa; menolak adalah satu-satunya
      // jawaban yang aman.
      if (policy.scopeColumn && row && scopeValue === undefined) {
        throw new AuthorizationError(
          `Baris "${table}" tidak memuat kolom "${policy.scopeColumn}" yang dibutuhkan pemeriksaan.`,
          { table, command, status: 500 },
        );
      }
      return anyPredicatePasses(ctx, rules, scopeValue);
    },

    async assert(table, command, row = null) {
      if (await this.can(table, command, row)) return;
      throw new AuthorizationError(`Akses ditolak untuk ${command} pada "${table}".`, { table, command });
    },

    // Menyaring sekumpulan baris menjadi yang boleh dilihat saja. Dipakai setelah query
    // yang lebih luas, misalnya daftar yang dibatasi halaman.
    async filter(table, rows) {
      const policy = requirePolicy(table, 'select');
      const rules = policy.select ?? [];
      // Pemeriksaan tanpa scope sama untuk seluruh baris, jadi cukup dinilai sekali.
      if (!policy.scopeColumn) {
        return (await anyPredicatePasses(ctx, rules, null)) ? rows : [];
      }
      const allowed = [];
      for (const row of rows) {
        if (await anyPredicatePasses(ctx, rules, row[policy.scopeColumn])) allowed.push(row);
      }
      return allowed;
    },

    // Syarat baris yang boleh dibaca tanpa login, untuk endpoint publik.
    publicRead(table) {
      const policy = getPolicy(table);
      if (!policy || policy.internal || !policy.publicFilter) return null;
      return {
        where: policy.publicFilter,
        params: policy.publicFilterParams ? policy.publicFilterParams() : [],
      };
    },

    allowsPublicInsert(table) {
      const policy = getPolicy(table);
      return Boolean(policy && !policy.internal && policy.publicInsert);
    },
  };
};
