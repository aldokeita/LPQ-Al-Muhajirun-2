// Pembacaan dan penulisan data guru, dipakai panel manajemen guru dan tiga panel rekap
// yang menampilkan guru di sampingnya.
//
// Tabel guru punya kolom deleted_at, jadi endpoint hapus menandainya alih-alih membuang
// barisnya. Pembacaan di sini menyaring deleted_at supaya guru yang sudah dihapus tidak
// muncul kembali di daftar.

import { attachRelated, queryAll, update, upsert } from '@/lib/dataClient';

export const GURU_COLUMNS = [
  'id', 'nama', 'email', 'no_hp', 'alamat', 'foto_url', 'avatar_path', 'rfid_tag',
  'jabatan', 'roles', 'is_notulen', 'jenis_kelamin', 'tanggal_lahir', 'status_guru',
  'status', 'created_at',
];

// Ekspor cadangan ikut membawa kolom jejak audit.
export const GURU_BACKUP_COLUMNS = [
  ...GURU_COLUMNS, 'updated_at', 'deleted_at', 'created_by', 'updated_by',
];

export const fetchGuru = ({ columns = GURU_COLUMNS, filters = [], order = 'nama' } = {}) => queryAll({
  table: 'guru',
  columns,
  filters: [...filters, { column: 'deleted_at', op: 'is_null' }],
  order: order ? [{ column: order, ascending: true }] : null,
});

export const updateGuru = (id, values) => update('guru', id, values);

export const upsertGuru = (values) => upsert('guru', values, 'id');

// Menonaktifkan guru menandai profilnya, bukan menghapusnya. Akun loginnya dimatikan
// terpisah lewat endpoint pengelolaan akun.
export const deactivateGuruProfile = (id) => update('guru', id, { status: 'inactive' });

// Daftar kelas untuk panel rekap, dengan nama guru terjahit seperti join bersarang dulu.
export const fetchClassesForRecap = async ({ filters = [], columns = ['id', 'nama_kelas', 'sesi', 'id_guru', 'kategori', 'is_active'], withGuru = false } = {}) => {
  const { data, error } = await queryAll({
    table: 'classes',
    columns,
    filters: [...filters, { column: 'deleted_at', op: 'is_null' }],
  });
  if (error) return { data: null, error };
  if (!withGuru) return { data, error: null };

  return {
    data: await attachRelated(data, {
      foreignKey: 'id_guru', table: 'guru', columns: ['id', 'nama'], as: 'guru',
    }),
    error: null,
  };
};
