import { getSessionName } from '../utils/sessionMapping.js';

export const filterIdCardSantri = (rows, filters) => {
  const search = String(filters.search || '').trim().toLocaleLowerCase('id-ID');
  const matching = rows.filter((row) => (
    (!search || [row.nama_lengkap, row.nama_panggilan, row.nomor_induk_qiroati].some((value) => String(value || '').toLocaleLowerCase('id-ID').includes(search)))
    && (filters.kategori === 'all' || String(row.kategori || '').trim().toLowerCase() === filters.kategori.toLowerCase())
    && (filters.sesi === 'all' || getSessionName(row.sesi_mengaji) === filters.sesi)
  ));
  const timestamp = (row) => {
    const time = Date.parse(String(row.tanggal_pendaftaran || row.created_at || '').slice(0, 10));
    return Number.isFinite(time) ? time : null;
  };
  return matching.sort((left, right) => {
    const a = timestamp(left);
    const b = timestamp(right);
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return filters.tanggalMasuk === 'oldest' ? a - b : b - a;
  });
};

export const toggleFilteredIdCardSelection = (selected, rows) => {
  const next = new Set(selected);
  const remove = rows.length > 0 && rows.every((row) => selected.has(row.id));
  rows.forEach((row) => remove ? next.delete(row.id) : next.add(row.id));
  return next;
};
