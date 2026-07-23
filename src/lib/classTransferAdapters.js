import { supabase } from '@/lib/customSupabaseClient';

const errorText = (error) => [error?.message, error?.details, error?.hint]
  .filter(Boolean)
  .join(' ')
  .toLowerCase();

export const getClassTransferErrorMessage = (error) => {
  const text = errorText(error);
  const code = String(error?.code || '').toUpperCase();

  if (code === 'PGRST202' || text.includes('schema cache') || text.includes('could not find the function')) {
    return 'Fitur transfer kelas belum diterapkan pada backend. Hubungi admin sistem.';
  }
  if (text.includes('failed to fetch') || text.includes('networkerror') || text.includes('network request')) {
    return 'Koneksi ke server terganggu. Periksa internet lalu coba lagi.';
  }
  if (code === '42501' || code === '28000' || text.includes('tidak memiliki akses') || text.includes('permission denied')) {
    return 'Anda tidak memiliki izin untuk mentransfer santri ini.';
  }
  if (code === 'P0002' || text.includes('tidak ditemukan') || text.includes('belum memiliki membership')) {
    return 'Data santri atau kelas aktif tidak ditemukan. Muat ulang dashboard lalu coba lagi.';
  }
  if (text.includes('tidak aktif')) {
    return text.includes('santri')
      ? 'Santri nonaktif tidak dapat ditransfer.'
      : 'Kelas tujuan sudah tidak aktif. Pilih kelas lain.';
  }
  if (text.includes('kategori')) {
    return 'Kelas tujuan harus berada pada kategori yang sama dengan santri.';
  }
  if (text.includes('berbeda dari kelas asal')) {
    return 'Pilih kelas tujuan yang berbeda dari kelas asal.';
  }

  return 'Transfer kelas belum berhasil. Muat ulang data lalu coba kembali.';
};

export const fetchGuruTransferClassOptions = async (santriId) => {
  const { data, error } = await supabase.rpc('get_guru_transfer_class_options', {
    p_santri_id: santriId,
  });
  if (error) throw error;
  return (data || []).map((item) => ({
    id: item.class_id,
    nama_kelas: item.class_name,
    sesi: item.session_name,
    guru_name: item.teacher_name,
    kategori: item.category,
    is_current: Boolean(item.is_current),
    is_selectable: Boolean(item.is_selectable),
  }));
};

export const transferSantriByGuru = async ({ santriId, targetClassId, reason }) => {
  const { data, error } = await supabase.rpc('transfer_santri_to_class_by_guru', {
    p_santri_id: santriId,
    p_to_class_id: targetClassId,
    p_reason: String(reason || '').trim() || null,
  });
  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.changed || Number(result?.active_memberships) !== 1) {
    throw new Error('Transfer tidak menghasilkan satu membership aktif.');
  }
  return result;
};
