// Pembacaan untuk empat dashboard peran: santri, guru, pentashih, dan admin.
//
// Yang disatukan di sini terutama satu bentuk yang dipakai berulang: satu baris santri
// berikut kelasnya, dan nama guru kelas itu. Dulu ditulis sebagai join bersarang dua
// tingkat, santri -> classes -> guru, dengan ejaan yang berbeda-beda di tiap berkas.

import { attachRelated, count, query, queryAll, queryIn, queryOne } from '@/lib/dataClient';

const CLASS_RELATION_COLUMNS = ['id', 'nama_kelas', 'sesi', 'kategori', 'id_guru', 'sort_order', 'is_active'];

// Satu santri berikut kelas dan guru kelasnya. Bentuk yang dipulangkan sama dengan join
// bersarang lama: santri.class berisi baris kelas, dan class.guru berisi gurunya.
export const fetchSantriWithClass = async (santriId) => {
  const { data: santri, error } = await queryOne({
    table: 'santri',
    filters: [{ column: 'id', op: 'eq', value: santriId }],
  });
  if (error) return { data: null, error };
  if (!santri) return { data: null, error: null };

  const [withClass] = await attachRelated([santri], {
    foreignKey: 'current_class_id',
    table: 'classes',
    columns: CLASS_RELATION_COLUMNS,
    as: 'class',
  });

  if (withClass.class?.id_guru) {
    const [classWithGuru] = await attachRelated([withClass.class], {
      foreignKey: 'id_guru',
      table: 'guru',
      columns: ['id', 'nama', 'no_hp'],
      as: 'guru',
    });
    withClass.class = classWithGuru;
  } else if (withClass.class) {
    withClass.class = { ...withClass.class, guru: null };
  }

  return { data: withClass, error: null };
};

// Jumlah santri aktif untuk kartu ringkasan admin. Dulu ini select head dengan
// count exact; sekarang endpoint hitung yang melakukannya, melewati klausa otorisasi
// yang sama dengan pembacaan.
export const countActiveSantri = () => count({
  table: 'santri',
  filters: [
    { column: 'status', op: 'in', value: ['Aktif', 'active'] },
    { column: 'deleted_at', op: 'is_null' },
  ],
});

export const fetchGuruProfile = (guruId, columns) => queryOne({
  table: 'guru',
  columns,
  filters: [{ column: 'id', op: 'eq', value: guruId }],
});

// Teman sekelas berikut kehadiran mereka hari ini, untuk dashboard santri.
export const fetchClassmates = async (classId) => {
  const { data: memberships, error } = await queryAll({
    table: 'class_memberships',
    columns: ['santri_id'],
    filters: [
      { column: 'class_id', op: 'eq', value: classId },
      { column: 'status', op: 'eq', value: 'active' },
    ],
  });
  if (error) return { data: null, error };

  // santri:santri_id(...) dulu ikut lewat join bersarang. Dijahit di sini, lalu
  // dipipihkan menjadi daftar santri seperti yang diharapkan pemanggil.
  const withSantri = await attachRelated(memberships, {
    foreignKey: 'santri_id',
    table: 'santri',
    columns: ['id', 'nama_lengkap', 'foto_url', 'avatar_path', 'jilid'],
    as: 'santri',
  });
  return { data: withSantri, error: null };
};

export const fetchActiveClassesWithGuru = async () => {
  const { data, error } = await queryAll({
    table: 'classes',
    columns: CLASS_RELATION_COLUMNS,
    filters: [
      // is_active bertipe boolean dan tersimpan sebagai 1/0 di D1.
      { column: 'is_active', op: 'eq', value: 1 },
      { column: 'deleted_at', op: 'is_null' },
    ],
    order: [{ column: 'sort_order', ascending: true, nullsFirst: false }],
  });
  if (error) return { data: null, error };

  return {
    data: await attachRelated(data, {
      foreignKey: 'id_guru', table: 'guru', columns: ['id', 'nama', 'no_hp'], as: 'guru',
    }),
    error: null,
  };
};

export const fetchActiveMemberships = () => queryAll({
  table: 'class_memberships',
  columns: ['id', 'santri_id', 'class_id', 'order_in_class', 'status'],
  filters: [{ column: 'status', op: 'eq', value: 'active' }],
  order: [{ column: 'order_in_class', ascending: true, nullsFirst: false }],
});

// Daftar santri untuk pencocokan berdasarkan id. Santri yang sudah diarsipkan tidak ikut:
// ia tidak pernah punya keanggotaan kelas yang aktif, jadi tidak akan pernah tampil, dan
// menyaringnya di server memangkas baris yang dibaca percuma.
export const fetchSantriDirectory = (columns) => queryAll({
  table: 'santri',
  columns,
  filters: [{ column: 'deleted_at', op: 'is_null' }],
  order: [{ column: 'nama_lengkap', ascending: true }],
});

// Kehadiran satu hari untuk sekumpulan kelas, dipakai dashboard guru.
export const fetchClassAttendanceForDate = ({ classIds, date, columns }) => queryIn({
  table: 'attendance',
  columns,
  column: 'class_id',
  values: classIds,
  extraFilters: [{ column: 'attendance_date', op: 'eq', value: date }],
});

export const fetchAttendanceForDate = ({ filters, columns }) => query({
  table: 'attendance',
  columns,
  filters,
  limit: 1000,
});
