// Terjemahan RPC bisnis dari plpgsql.
//
// Perilakunya dijaga sama persis dengan versi Postgres, termasuk kalimat pesan galat,
// karena antarmuka menampilkannya langsung kepada pengguna. Aturan yang halus pun
// dipertahankan: normalisasi Jilid 6a dan 6b menjadi Jilid 6, syarat santri harus aktif
// dengan status yang diperbandingkan setelah dipangkas dan dihuruf-kecilkan, serta
// batas atas poin pada nilai integer 32-bit.
//
// Postgres memakai FOR UPDATE untuk mengunci baris. D1 memproses query satu per satu
// pada satu Durable Object, dan penulisan yang saling bergantung dikirim sebagai batch
// sehingga berjalan dalam satu transaksi.

import { currentUserRole, guruHasSantriAccess } from '../auth/predicates.js';

// Tanggal operasional mengikuti WIB, bukan UTC. current_date di Postgres memakai zona
// server yang berjalan UTC, sehingga mutasi sore hari tercatat di tanggal berikutnya.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const todayWib = () => new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);

export class RpcError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'RpcError';
    this.status = status;
  }
}

const nowIso = () => new Date().toISOString();

const ACTIVE_STATUSES = new Set(['aktif', 'active']);
const isActiveStatus = (status) => ACTIVE_STATUSES.has(String(status ?? '').trim().toLowerCase());

// Jilid 6a dan 6b diperlakukan sebagai satu jilid yang sama di seluruh sistem.
const normalizeJilid = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  return ['jilid 6a', 'jilid 6b'].includes(trimmed.toLowerCase()) ? 'Jilid 6' : trimmed;
};

const requireActor = (ctx, action) => {
  if (!ctx.userId) throw new RpcError(`Login diperlukan untuk ${action}.`, 401);
};

// admin boleh atas semua santri; guru hanya atas santri di kelasnya.
const requireSantriAuthority = async (ctx, santriId, action) => {
  const role = await currentUserRole(ctx);
  if (role === 'admin') return role;
  if (role === 'guru' && (await guruHasSantriAccess(ctx, santriId))) return role;
  throw new RpcError(`Anda tidak memiliki izin untuk ${action}.`, 403);
};

const loadActiveSantri = async (db, santriId) => {
  const row = await db
    .prepare('select "id", "nama_lengkap", "jilid", "points", "status" from "santri" where "id" = ? and "deleted_at" is null limit 1')
    .bind(santriId)
    .first();
  if (!row || !isActiveStatus(row.status)) throw new RpcError('Santri aktif tidak ditemukan.', 404);
  return row;
};

const INT32_MAX = 2147483647;

// Papan peringkat memang lintas kelas, sementara kebijakan tabel santri sengaja
// mengunci guru pada santri kelasnya sendiri. Melonggarkan kebijakan itu akan ikut
// membuka nomor HP wali, alamat, NIK, dan KK kepada seluruh guru — padahal yang
// dibutuhkan papan peringkat cuma nama, poin, dan jilid. Jadi dibuatkan jalur
// tersendiri yang hanya memulangkan kolom-kolom itu.
//
// Fotonya ikut karena santri yang sama beserta poinnya sudah tampil di layar TV
// aula untuk siapa pun yang ada di ruangan, jadi tidak ada yang baru terbuka.
const LEADERBOARD_MAX_PAGE_SIZE = 50;
const LEADERBOARD_ROLES = new Set(['admin', 'guru', 'pentashih']);

export const getSantriLeaderboard = async (db, ctx, { page, pageSize }) => {
  requireActor(ctx, 'melihat papan peringkat');
  const role = await currentUserRole(ctx);

  // Tiga sebab yang berbeda dulu memulangkan kalimat yang sama, sehingga laporan
  // "tidak memiliki izin" tidak bisa ditelusuri: peran yang memang tidak berhak,
  // profil yang tidak berstatus aktif, dan profil yang barisnya tidak ada sama
  // sekali. currentUserRole memulangkan null untuk dua yang terakhir, jadi
  // keduanya dulu tersamar sebagai masalah izin padahal bukan.
  if (role === null) {
    throw new RpcError(
      'Profil akun Anda tidak ditemukan atau tidak berstatus aktif, jadi papan peringkat tidak bisa dibuka. Hubungi admin.',
      403,
    );
  }
  if (!LEADERBOARD_ROLES.has(role)) {
    throw new RpcError(`Papan peringkat hanya untuk admin dan guru. Akun Anda berperan ${role}.`, 403);
  }

  const ukuran = Math.min(
    Math.max(Number.isInteger(pageSize) ? pageSize : 10, 1),
    LEADERBOARD_MAX_PAGE_SIZE,
  );
  const halaman = Math.max(Number.isInteger(page) ? page : 1, 1);
  const offset = (halaman - 1) * ukuran;

  const where = 'where "deleted_at" is null and lower(trim("status")) in (\'aktif\', \'active\')';

  const total = await db.prepare(`select count(*) as n from "santri" ${where}`).first();

  // Nama dipakai sebagai pemecah seri supaya urutannya tidak berubah-ubah antar
  // permintaan ketika poinnya sama — tanpa itu, paginasi bisa melewatkan atau
  // menggandakan baris di perbatasan halaman.
  const { results } = await db
    .prepare(
      `select "id", "nama_lengkap", "nama_panggilan", "points", "jilid",
              "foto_url", "avatar_path", "jenis_kelamin"
         from "santri" ${where}
        order by "points" desc, "nama_lengkap" asc
        limit ? offset ?`,
    )
    .bind(ukuran, offset)
    .all();

  const jumlah = Number(total?.n ?? 0);
  return {
    rows: results ?? [],
    total: jumlah,
    page: halaman,
    pageSize: ukuran,
    totalPages: Math.max(1, Math.ceil(jumlah / ukuran)),
    startRank: offset + 1,
  };
};

export const incrementSantriPoints = async (db, ctx, { santriId, amount }) => {
  requireActor(ctx, 'mengubah poin santri');
  if (!santriId) throw new RpcError('Santri wajib dipilih.');
  if (!Number.isInteger(amount) || amount === 0) {
    throw new RpcError('Perubahan poin harus berupa angka selain nol.');
  }
  await requireSantriAuthority(ctx, santriId, 'mengubah poin santri ini');

  const santri = await loadActiveSantri(db, santriId);
  const next = (santri.points ?? 0) + amount;
  if (next < 0) throw new RpcError('Poin santri tidak dapat kurang dari nol.');
  if (next > INT32_MAX) throw new RpcError('Poin santri melebihi batas yang didukung.');

  await db
    .prepare('update "santri" set "points" = ?, "updated_at" = ?, "updated_by" = ? where "id" = ?')
    .bind(next, nowIso(), ctx.userId, santriId)
    .run();

  return next;
};

// Parameter reason diterima demi kesamaan antarmuka dengan RPC lama, yang juga
// menerimanya tanpa menyimpannya.
export const changeSantriJilid = async (db, ctx, { santriId, toJilid }) => {
  requireActor(ctx, 'mengubah jilid santri');
  if (!santriId) throw new RpcError('Santri wajib dipilih.');
  const target = normalizeJilid(toJilid);
  if (!target) throw new RpcError('Jilid tujuan wajib dipilih.');
  await requireSantriAuthority(ctx, santriId, 'mengubah jilid santri ini');

  const santri = await loadActiveSantri(db, santriId);
  const from = normalizeJilid(santri.jilid);

  // Tidak ada perubahan bukan galat: versi lama memulangkan changed = false.
  if (from === target) {
    return {
      santri_id: santri.id,
      from_jilid: from,
      to_jilid: target,
      changed: false,
      message: `${santri.nama_lengkap} sudah berada di ${target}.`,
      history_id: null,
    };
  }

  const historyId = crypto.randomUUID();
  const timestamp = nowIso();

  // Perubahan jilid dan catatan riwayatnya harus jadi bersama atau tidak sama sekali.
  await db.batch([
    db.prepare('update "santri" set "jilid" = ?, "updated_at" = ?, "updated_by" = ? where "id" = ?')
      .bind(target, timestamp, ctx.userId, santriId),
    // Versi Postgres menerima p_reason tetapi tidak pernah menyimpannya — tabel
    // jilid_history memang tidak punya kolom itu. Perilakunya dipertahankan.
    db.prepare(`insert into "jilid_history" ("id", "santri_id", "from_jilid", "to_jilid", "changed_by", "changed_at")
                values (?, ?, ?, ?, ?, ?)`)
      .bind(historyId, santriId, from, target, ctx.userId, timestamp),
  ]);

  return {
    santri_id: santri.id,
    from_jilid: from,
    to_jilid: target,
    changed: true,
    message: `${santri.nama_lengkap} berhasil diubah ke ${target}.`,
    history_id: historyId,
  };
};
