// Pengganti klien Supabase untuk pengujian di Node.
//
// Modul aslinya membaca import.meta.env milik Vite, yang tidak ada di Node. Stub ini
// dipasang oleh scripts/vite-alias-hooks.mjs hanya saat pengujian.
//
// Setiap pemakaian klien ini melempar galat dengan sengaja: modul yang sudah dimigrasikan
// tidak boleh menyentuhnya lagi, dan kalau ada yang menyentuh, pengujian harus gagal
// alih-alih diam-diam memakai jalur lama.

const menolak = () => {
  throw new Error('Klien Supabase dipanggil dalam pengujian. Modul ini seharusnya sudah memakai dataClient.');
};

export const supabaseUrl = '';
export const supabaseAnonKey = '';
export const isSupabaseConfigured = false;
export const supabaseConfigurationMessage = 'Supabase tidak dikonfigurasi dalam pengujian.';

export const supabase = new Proxy({}, {
  get: menolak,
  apply: menolak,
});
