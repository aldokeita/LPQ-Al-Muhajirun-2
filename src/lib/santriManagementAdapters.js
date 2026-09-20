// Pembacaan dan penulisan untuk panel data santri: SantriManagement (TPQ dan PTPT) dan
// SantriDewasaManagement.
//
// Penyaringnya rumit dan dulu ditulis dua kali di berkas yang sama — sekali untuk tabel
// berhalaman, sekali lagi untuk ekspor Excel. Dua salinan penyaring yang harus selalu
// sama adalah cara yang rapi untuk membuat angka di layar berbeda dari isi berkas yang
// diunduh, jadi di sini penyaringnya dibangun satu kali.
//
// Pencacahan baris terpisah dari pembacaannya. PostgREST dulu memulangkan count bersama
// halamannya; endpoint di sini memisahkan keduanya, dan pencacahannya melewati klausa
// otorisasi yang sama persis dengan pembacaan sehingga angkanya tidak pernah mencakup
// baris yang sebenarnya tidak boleh dilihat.

import { attachRelated, count, insertMany, query, queryAll, update } from '@/lib/dataClient';

// Kolom yang dulu disusun sebagai SANTRI_BASE_SELECT ditambah SANTRI_EXTENDED_SELECT.
// Rangkaian itu memuat nama_ayah dan nama_ibu dua kali; di sini masing-masing sekali.
//
// Percabangan base/extended juga ikut hilang. Itu ada untuk menangani basis data yang
// belum punya kolom tambahannya, dan menebaknya dari pesan galat Postgres. Skema D1
// dihasilkan dari katalog yang sama dengan sumbernya, jadi kolom itu pasti ada.
export const SANTRI_MANAGEMENT_COLUMNS = [
  'id', 'nomor_induk_qiroati', 'nama_lengkap', 'nama_panggilan', 'nama_ibu', 'nama_ayah',
  'kategori', 'jenis_kelamin', 'tanggal_lahir', 'tempat_lahir', 'alamat', 'no_hp_ortu',
  'foto_url', 'avatar_path', 'rfid_tag', 'current_class_id', 'sesi_mengaji', 'jilid',
  'juz_hafalan', 'status', 'points', 'order_in_class', 'created_at', 'updated_at',
  'deleted_at', 'tanggal_pendaftaran', 'no_kk', 'no_nik', 'berkas_foto', 'berkas_akta',
  'berkas_kk', 'berkas_form', 'link_qiroati', 'default_spp_amount',
];

export const SANTRI_BIRTHDAY_COLUMNS = ['id', 'nama_lengkap', 'tanggal_lahir', 'no_hp_ortu', 'foto_url', 'avatar_path'];

export const santriCategoryValues = (subCategory) => (
  subCategory === 'ptpt' ? ['PTPT', 'ptpt'] : ['Anak', 'anak', 'TPQ', 'tpq']
);

// Santri aktif adalah yang statusnya kosong atau berbunyi aktif dalam ejaan mana pun.
// Ini terjemahan langsung dari or(status.is.null,status.ilike.aktif,status.ilike.active).
const ACTIVE_STATUS_FILTER = {
  or: [
    { column: 'status', op: 'is_null' },
    { column: 'status', op: 'ilike', value: 'aktif' },
    { column: 'status', op: 'ilike', value: 'active' },
  ],
};

export const buildSantriFilters = ({
  categoryValues = null,
  search = '',
  sesiValues = null,
  jilidValues = null,
  juzValue = null,
  rfid = 'all',
} = {}) => {
  const filters = [{ column: 'deleted_at', op: 'is_null' }, ACTIVE_STATUS_FILTER];
  if (categoryValues) filters.push({ column: 'kategori', op: 'in', value: categoryValues });

  if (search) {
    filters.push({
      or: ['nama_lengkap', 'nama_panggilan', 'nama_ayah', 'rfid_tag'].map((column) => ({
        column, op: 'ilike', value: `%${search}%`,
      })),
    });
  }

  if (sesiValues) filters.push({ column: 'sesi_mengaji', op: 'in', value: sesiValues });

  // PTPT menyaring lewat juz_hafalan, yang bertipe array dan disimpan sebagai JSON,
  // jadi keanggotaannya diuji per nilai, bukan dengan pencocokan teks.
  if (juzValue) filters.push({ column: 'juz_hafalan', op: 'contains', value: juzValue });
  else if (jilidValues) filters.push({ column: 'jilid', op: 'in', value: jilidValues });

  if (rfid === 'assigned') {
    filters.push({ column: 'rfid_tag', op: 'not_null' }, { column: 'rfid_tag', op: 'neq', value: '' });
  }
  if (rfid === 'unassigned') {
    filters.push({
      or: [{ column: 'rfid_tag', op: 'is_null' }, { column: 'rfid_tag', op: 'eq', value: '' }],
    });
  }

  return filters;
};

// Satu halaman tabel santri berikut jumlah seluruh barisnya. Keduanya memakai penyaring
// yang sama persis, supaya jumlah halaman tidak pernah berbeda dari isinya.
export const fetchSantriPage = async ({ filters, sortColumn, ascending, page, pageSize }) => {
  const [rows, total] = await Promise.all([
    query({
      table: 'santri',
      columns: SANTRI_MANAGEMENT_COLUMNS,
      filters,
      order: [{ column: sortColumn, ascending, nullsFirst: false }],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    count({ table: 'santri', filters }),
  ]);

  if (rows.error) return { data: null, count: 0, error: rows.error };
  if (total.error) return { data: null, count: 0, error: total.error };
  return { data: rows.data, count: total.data, error: null };
};

export const fetchSantriForExport = ({ filters }) => queryAll({
  table: 'santri',
  columns: SANTRI_MANAGEMENT_COLUMNS,
  filters,
  order: [{ column: 'nama_lengkap', ascending: true }],
});

export const fetchBirthdayCandidates = () => queryAll({
  table: 'santri',
  columns: SANTRI_BIRTHDAY_COLUMNS,
  filters: [{ column: 'deleted_at', op: 'is_null' }, ACTIVE_STATUS_FILTER],
});

// Daftar kelas untuk pemilih kelas. Nama gurunya dulu ikut lewat join bersarang
// guru:id_guru(nama), jadi di sini dijahit setelah baca dengan bentuk yang sama.
export const fetchClassOptions = async ({ columns = ['id', 'nama_kelas', 'id_guru'] } = {}) => {
  const { data, error } = await queryAll({
    table: 'classes',
    columns,
    filters: [{ column: 'deleted_at', op: 'is_null' }],
  });
  if (error) return { data: null, error };

  return {
    data: await attachRelated(data, {
      foreignKey: 'id_guru',
      table: 'guru',
      columns: ['id', 'nama'],
      as: 'guru',
    }),
    error: null,
  };
};

export const updateSantriProfile = (santriId, values) => update('santri', santriId, values);

// Impor massal. Dulu ini satu perintah insert berisi larik, jadi kegagalan di tengah
// tidak pernah menyisakan sebagian santri tersimpan; insertMany menjaga sifat itu.
export const insertSantriBulk = (rows) => insertMany('santri', rows);

// Dipakai panel santri dewasa, yang menyaring kategori dan status di sisi klien untuk
// menampung perbedaan huruf besar-kecil, dan karena itu membaca seluruh baris apa adanya.
// Penyaringan itu dibiarkan di tempatnya: memindahkannya ke server akan mengubah santri
// mana yang muncul, dan itu bukan bagian dari pemindahan ini.
export const SANTRI_ADULT_COLUMNS = [
  ...SANTRI_MANAGEMENT_COLUMNS, 'email', 'created_by', 'updated_by',
];

export const fetchAllSantri = (columns = SANTRI_ADULT_COLUMNS) => queryAll({
  table: 'santri',
  columns,
});
