// Pengelolaan akun (membuat santri/guru, reset password, arsip) dulu berjalan di
// Supabase Edge Function. Sekarang jalurnya ada di Worker pada /api/manage-user
// dan selalu ikut ter-deploy bersama frontend, jadi defaultnya menyala.
// VITE_ENABLE_ACCOUNT_MANAGEMENT=false tetap tersedia sebagai kill switch darurat.
export const enableAccountManagement = import.meta.env.VITE_ENABLE_ACCOUNT_MANAGEMENT !== 'false';

// Backup & Restore is available by default for admins and has its own emergency kill switch.
export const enableBackupRestore = import.meta.env.VITE_ENABLE_BACKUP_RESTORE !== 'false';

// Game modules are production-ready and enabled by default.
// Set VITE_ENABLE_GAME_FEATURES=false as an emergency kill switch.
export const enableGameFeatures = import.meta.env.VITE_ENABLE_GAME_FEATURES !== 'false';

export const accountManagementDisabledMessage =
  'Pengelolaan akun sedang dimatikan sementara oleh administrator.';
