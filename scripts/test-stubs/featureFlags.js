// Pengganti featureFlags untuk pengujian di Node.
//
// Modul aslinya membaca import.meta.env milik Vite, yang tidak tersedia di luar bundler.
// Nilainya mengikuti bawaan modul asli: fitur yang menyala bila variabelnya tidak diset.

export const enableEdgeFunctions = false;
export const enableDeferredFeatures = false;
export const enableBackupRestore = true;
export const enableGameFeatures = true;
export const edgeFunctionDisabledMessage =
  'Fitur ini akan diaktifkan setelah Supabase baru dan Edge Function tersedia.';
