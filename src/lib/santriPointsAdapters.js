import { rpc } from '@/lib/dataClient';

const errorText = (error) => [error?.message, error?.details, error?.hint]
  .filter(Boolean)
  .join(' ')
  .toLowerCase();

export const getSantriPointsErrorMessage = (error) => {
  const text = errorText(error);
  const code = String(error?.code || '').toUpperCase();
  // Backend Worker memulangkan status HTTP; kode Postgres dipertahankan agar pesan
  // tetap benar bila modul ini masih dilayani backend lama.
  const status = Number(error?.status) || 0;

  if (code === 'PGRST202' || text.includes('schema cache') || text.includes('could not find the function')) {
    return 'Fitur poin belum diterapkan pada backend. Hubungi admin sistem.';
  }
  if (code === 'NETWORK_ERROR' || text.includes('failed to fetch') || text.includes('networkerror')
      || text.includes('network request') || text.includes('gagal menghubungi server')) {
    return 'Koneksi ke server terganggu. Periksa internet lalu coba lagi.';
  }
  if (code === '42501' || code === '28000' || status === 401 || status === 403
      || text.includes('tidak memiliki izin') || text.includes('permission denied')) {
    return 'Anda tidak memiliki izin untuk mengubah poin santri ini.';
  }
  if (code === 'P0002' || status === 404 || text.includes('tidak ditemukan')) {
    return 'Data santri aktif tidak ditemukan. Muat ulang halaman lalu coba lagi.';
  }
  if (code === '22003' || text.includes('kurang dari nol') || text.includes('melebihi batas')) {
    return 'Poin santri tidak dapat dikurangi hingga kurang dari nol.';
  }
  if (code === '22023' || text.includes('perubahan poin harus')) {
    return 'Jumlah perubahan poin tidak valid.';
  }

  return 'Poin santri belum berhasil diperbarui. Silakan coba lagi.';
};

export const adjustSantriPoints = async ({ santriId, amount }) => {
  const parsedAmount = Number(amount);
  if (!santriId) throw new Error('Santri wajib dipilih.');
  if (!Number.isInteger(parsedAmount) || parsedAmount === 0) {
    throw new Error('Perubahan poin harus berupa angka selain nol.');
  }

  const { data, error } = await rpc('increment_santri_points', {
    p_santri_id: santriId,
    p_amount: parsedAmount,
  });

  if (error) throw error;

  const nextPoints = Number(data);
  if (!Number.isInteger(nextPoints) || nextPoints < 0) {
    throw new Error('Server tidak mengembalikan jumlah poin yang valid.');
  }

  return nextPoints;
};
