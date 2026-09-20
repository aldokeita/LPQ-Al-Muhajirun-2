// Pembacaan dan penulisan untuk dua panel manajemen kelas: ClassManagement (TPQ dan
// PTPT) dan AdultClassManagement (Dewasa). Keduanya dulu menyalin kueri yang sama, jadi
// di sini disatukan supaya perbaikan di satu tempat tidak terlewat di tempat lain.
//
// Dua hal yang berubah bentuknya, bukan perilakunya:
//
// 1. Join bersarang. classes.guru:id_guru(...) dan class_mutations dengan tiga tingkat
//    sarang tidak punya padanan di endpoint data, jadi relasinya dijahit setelah baca.
//
// 2. Penghapusan kelas. Tabel classes punya kolom deleted_at, jadi endpoint hapus
//    menandainya alih-alih membuang barisnya. Supaya hasil yang dilihat pemakai tetap
//    sama — kelas yang dihapus hilang dari daftar — setiap pembacaan classes menyaring
//    deleted_at. Jejaknya tersimpan, relasi historisnya tidak putus.

import {
  attachRelated,
  count,
  insert,
  queryAll,
  queryIn,
  queryOne,
  remove,
  update,
} from '@/lib/dataClient';

export const CLASS_COLUMNS = [
  'id', 'nama_kelas', 'id_guru', 'sesi', 'kategori', 'sort_order', 'is_active',
  'created_at', 'updated_at', 'created_by', 'updated_by',
];

// Sengaja tanpa avatar_path: join bersarang yang lama pun tidak mengambilnya, jadi foto
// guru di panel ini selalu berasal dari foto_url. Menambahkannya akan mengubah sumber
// gambar, dan itu perubahan tersendiri, bukan bagian dari pemindahan ini.
export const GURU_RELATION_COLUMNS = ['id', 'nama', 'foto_url', 'no_hp'];

const ATTENDANCE_COLUMNS = [
  'id', 'user_id', 'role', 'attendance_date', 'check_in_time', 'check_in_timestamp',
  'class_id', 'sesi', 'status', 'source', 'correction_reason', 'corrected_by',
  'created_at', 'updated_at', 'created_by', 'updated_by',
];

// Tanggal hari ini menurut WIB. Dulu ini memakai waktu lokal peramban, yang benar selama
// pemakainya memang di Indonesia; menyebut zonanya secara eksplisit membuatnya tetap
// benar meski peramban diatur ke zona lain.
export const todayInJakarta = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

export const fetchClassesWithGuru = async ({ filters = [] } = {}) => {
  const { data, error } = await queryAll({
    table: 'classes',
    columns: CLASS_COLUMNS,
    filters: [...filters, { column: 'deleted_at', op: 'is_null' }],
    order: [{ column: 'sort_order', ascending: true, nullsFirst: false }],
  });
  if (error) return { data: null, error };

  return {
    data: await attachRelated(data, {
      foreignKey: 'id_guru',
      table: 'guru',
      columns: GURU_RELATION_COLUMNS,
      as: 'guru',
    }),
    error: null,
  };
};

export const fetchGuruList = (columns) => queryAll({
  table: 'guru',
  columns,
  filters: [{ column: 'deleted_at', op: 'is_null' }],
});

export const fetchSantriList = ({ columns, filters = [] }) => queryAll({
  table: 'santri',
  columns,
  filters: [...filters, { column: 'deleted_at', op: 'is_null' }],
  order: [{ column: 'order_in_class', ascending: true, nullsFirst: false }],
});

export const fetchTodayAttendance = () => queryAll({
  table: 'attendance',
  columns: ATTENDANCE_COLUMNS,
  filters: [{ column: 'attendance_date', op: 'eq', value: todayInJakarta() }],
});

// Konfigurasi sesi disimpan sebagai satu baris website_content. Kolom content bertipe
// JSON dan lapisan data yang mengurai serta merangkainya, jadi pemanggil menerima dan
// mengirim nilai biasa.
export const fetchSessionConfig = async (key) => {
  const { data, error } = await queryOne({
    table: 'website_content',
    columns: ['id', 'content'],
    filters: [{ column: 'key', op: 'eq', value: key }],
  });
  if (error) return { data: null, error };
  return { data: data?.content ?? null, error: null };
};

export const saveSessionConfig = async (key, sessions) => {
  const content = sessions.map((session) => ({ name: session.name, time: session.time }));
  const { data: existing, error: findError } = await queryOne({
    table: 'website_content',
    columns: ['id'],
    filters: [{ column: 'key', op: 'eq', value: key }],
  });
  if (findError) return { data: null, error: findError };

  if (existing) return update('website_content', existing.id, { content });
  return insert('website_content', { key, content });
};

// Urutan kelas disimpan satu per satu. Ini memang beberapa permintaan, tapi urutan
// tampilan bukan data yang rusak kalau tersimpan separuh: pemanggil memuat ulang
// daftarnya saat ada yang gagal, persis seperti sebelumnya.
export const saveClassOrder = async (orderedClasses) => {
  for (const [index, classItem] of orderedClasses.entries()) {
    const { error } = await update('classes', classItem.id, { sort_order: index + 1 });
    if (error) return { data: null, error };
  }
  return { data: { updated: orderedClasses.length }, error: null };
};

export const saveSantriOrder = async (santriList) => {
  for (const santri of santriList) {
    const { error } = await update('santri', santri.id, { order_in_class: santri.order_in_class });
    if (error) return { data: null, error };
  }
  return { data: { updated: santriList.length }, error: null };
};

export const saveClass = (editingClassId, values) => (
  editingClassId ? update('classes', editingClassId, values) : insert('classes', values)
);

export const deactivateClass = (id) => update('classes', id, { is_active: false });

// Menghapus kelas. Kolom deleted_at membuat endpoint menandainya alih-alih membuang
// barisnya, dan pembacaan di modul ini menyaringnya, jadi kelasnya tetap hilang dari
// tampilan seperti dulu.
export const deleteClass = (id) => remove('classes', id);

export const countActiveMemberships = (classId) => count({
  table: 'class_memberships',
  filters: [
    { column: 'class_id', op: 'eq', value: classId },
    { column: 'status', op: 'eq', value: 'active' },
  ],
});

const MUTATION_CLASS_COLUMNS = ['id', 'nama_kelas', 'sesi', 'id_guru'];

// Riwayat mutasi dulu dibaca dengan tiga tingkat sarang sekaligus: santri, kelas asal,
// kelas tujuan, dan nama guru di masing-masing kelas. Di sini santri dan kedua kelas
// dijahit lebih dulu, lalu nama guru ditarik sekali untuk seluruh kelas yang muncul,
// bukan satu kueri per baris.
export const fetchClassMutations = async () => {
  const { data: rows, error } = await queryAll({
    table: 'class_mutations',
    columns: ['id', 'santri_id', 'from_class_id', 'to_class_id', 'mutation_date', 'reason', 'created_at'],
    order: [{ column: 'mutation_date', ascending: false }],
  });
  if (error) return { data: null, error };

  let withRelations = await attachRelated(rows, {
    foreignKey: 'santri_id',
    table: 'santri',
    columns: ['id', 'nama_lengkap', 'foto_url', 'avatar_path'],
    as: 'santri',
  });
  for (const [foreignKey, as] of [['from_class_id', 'from_class'], ['to_class_id', 'to_class']]) {
    withRelations = await attachRelated(withRelations, {
      foreignKey,
      table: 'classes',
      columns: MUTATION_CLASS_COLUMNS,
      as,
    });
  }

  const guruIds = withRelations
    .flatMap((row) => [row.from_class?.id_guru, row.to_class?.id_guru])
    .filter(Boolean);
  const { data: guruRows, error: guruError } = await queryIn({
    table: 'guru',
    columns: ['id', 'nama'],
    column: 'id',
    values: guruIds,
  });
  // Guru yang tidak boleh dibaca menjadi null, sama seperti join bersarang di bawah RLS.
  const guruById = new Map((guruError ? [] : guruRows).map((guru) => [guru.id, guru]));
  const withGuru = (classItem) => (classItem
    ? { ...classItem, guru: guruById.get(classItem.id_guru) ?? null }
    : null);

  return {
    data: withRelations.map((row) => ({
      ...row,
      from_class: withGuru(row.from_class),
      to_class: withGuru(row.to_class),
    })),
    error: null,
  };
};

// class_mutations tidak punya kolom deleted_at, jadi barisnya memang dibuang, sama
// seperti sebelumnya.
export const deleteClassMutation = (id) => remove('class_mutations', id);
