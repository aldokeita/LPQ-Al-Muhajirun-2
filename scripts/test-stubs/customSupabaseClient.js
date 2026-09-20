// Pengganti klien Supabase untuk pengujian di Node.
//
// Modul aslinya membaca import.meta.env milik Vite, yang tidak ada di Node.
//
// Jalur data (.from dan .rpc) sengaja melempar galat: modul yang sudah dimigrasikan tidak
// boleh menyentuhnya lagi, dan kalau ada yang menyentuh, pengujian harus gagal alih-alih
// diam-diam memakai jalur lama.
//
// Jalur storage berbeda. Penyimpanan berkas memang masih di Supabase sampai pindah ke R2,
// jadi ia tidak dianggap pelanggaran. Yang ditiru di sini adalah kegagalan penandatanganan,
// sama seperti yang terjadi ketika Supabase tidak dapat dihubungi: pemanggilnya memakai
// URL cadangan dan tetap berjalan.

const tolakJalurData = (nama) => () => {
  throw new Error(`Klien Supabase (${nama}) dipanggil dalam pengujian. Modul ini seharusnya sudah memakai dataClient.`);
};

const storageGagal = {
  createSignedUrl: async () => ({ data: null, error: new Error('Storage tidak tersedia dalam pengujian.') }),
  getPublicUrl: () => ({ data: { publicUrl: '' } }),
  upload: async () => ({ data: null, error: new Error('Storage tidak tersedia dalam pengujian.') }),
  remove: async () => ({ data: null, error: new Error('Storage tidak tersedia dalam pengujian.') }),
  list: async () => ({ data: null, error: new Error('Storage tidak tersedia dalam pengujian.') }),
};

export const supabaseUrl = '';
export const supabaseAnonKey = '';
export const isSupabaseConfigured = false;
export const supabaseConfigurationMessage = 'Supabase tidak dikonfigurasi dalam pengujian.';

export const supabase = {
  from: tolakJalurData('from'),
  rpc: tolakJalurData('rpc'),
  storage: { from: () => storageGagal },
  functions: { invoke: tolakJalurData('functions.invoke') },
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
  },
};
