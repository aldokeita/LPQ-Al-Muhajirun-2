export const activeStatusValues = new Set(['aktif', 'active']);

export const mapSantriForLegacyUi = (santri) => ({
  ...santri,
  id_kelas: santri.current_class_id ?? santri.id_kelas ?? null,
  class: santri.class ?? santri.current_class ?? null,
  tanggal_pendaftaran: santri.tanggal_pendaftaran ?? santri.created_at ?? null,
});

export const mapClassForLegacyUi = (classItem) => ({
  ...classItem,
  order: classItem.sort_order ?? classItem.order ?? 0,
});

export const normalizeNomorIndukQiroati = (value) => String(value ?? '').trim();

export const pickSantriProfileFields = (input) => {
  const nomorInduk = normalizeNomorIndukQiroati(input.nomor_induk_qiroati);

  return {
    nomor_induk_qiroati: nomorInduk,
    nama_lengkap: input.nama_lengkap?.trim(),
    nama_panggilan: input.nama_panggilan?.trim() || null,
    kategori: input.kategori || 'Anak',
    jenis_kelamin: input.jenis_kelamin || null,
    tanggal_lahir: input.tanggal_lahir || null,
    tempat_lahir: input.tempat_lahir || null,
    alamat: input.alamat || null,
    no_hp_ortu: input.no_hp_ortu || null,
    foto_url: input.foto_url || null,
    rfid_tag: input.rfid_tag || null,
    current_class_id: input.current_class_id ?? input.id_kelas ?? null,
    sesi_mengaji: input.sesi_mengaji || null,
    jilid: input.jilid || null,
    status: input.status || 'Aktif',
    points: Number(input.points) || 0,
    order_in_class: input.order_in_class ?? null,
  };
};

export const pickGuruProfileFields = (input, role = 'guru') => ({
  nama: input.nama?.trim(),
  email: input.email?.trim() || null,
  no_hp: input.no_hp || null,
  alamat: input.alamat || null,
  foto_url: input.foto_url || null,
  rfid_tag: input.rfid_tag || null,
  jabatan: input.jabatan || null,
  roles: role === 'pentashih'
    ? Array.from(new Set([...(input.roles || []), 'Pentashih']))
    : (input.roles || []).filter((item) => item !== 'Pentashih'),
  is_notulen: Boolean(input.is_notulen),
  jenis_kelamin: input.jenis_kelamin || null,
  tanggal_lahir: input.tanggal_lahir || null,
  status_guru: input.status_guru || null,
  status: input.status || 'active',
});

export const getOperationalRoleFromGuruForm = (input) =>
  (input.roles || []).includes('Pentashih') ? 'pentashih' : 'guru';
