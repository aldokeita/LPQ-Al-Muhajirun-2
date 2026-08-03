import { supabase } from '@/lib/customSupabaseClient';

const errorText = (error) => [error?.message, error?.details, error?.hint]
  .filter(Boolean)
  .join(' ')
  .toLowerCase();

export const getSantriPointsErrorMessage = (error) => {
  const text = errorText(error);
  const code = String(error?.code || '').toUpperCase();

  if (code === 'PGRST202' || text.includes('schema cache') || text.includes('could not find the function')) {
    return 'Fitur poin belum diterapkan pada backend. Hubungi admin sistem.';
  }
  if (text.includes('failed to fetch') || text.includes('networkerror') || text.includes('network request')) {
    return 'Koneksi ke server terganggu. Periksa internet lalu coba lagi.';
  }
  if (code === '42501' || code === '28000' || text.includes('tidak memiliki izin') || text.includes('permission denied')) {
    return 'Anda tidak memiliki izin untuk mengubah poin santri ini.';
  }
  if (code === 'P0002' || text.includes('tidak ditemukan')) {
    return 'Data santri aktif tidak ditemukan. Muat ulang halaman lalu coba lagi.';
  }
  if (code === '22003' || text.includes('kurang dari nol')) {
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

  const { data, error } = await supabase.rpc('increment_santri_points', {
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
