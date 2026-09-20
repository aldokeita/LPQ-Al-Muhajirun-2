// Peta kebijakan per tabel, hasil penerjemahan 92 policy RLS Postgres.
//
// Policy di Postgres bersifat PERMISSIVE, artinya beberapa policy pada tabel dan perintah
// yang sama digabung dengan OR. Semantik itu dipertahankan: satu predikat terpenuhi sudah
// cukup untuk mengizinkan.
//
// scopeColumn adalah kolom yang dioper ke predikat berbasis baris. Kolomnya berbeda-beda
// per tabel — santri memakai "id", attendance memakai "class_id", mmq_attendance memakai
// "schedule_id" — dan salah kolom berarti salah orang yang diberi akses.
//
// publicFilter adalah syarat baris yang boleh dibaca tanpa login. Hanya enam tabel yang
// punya, dan semuanya konten publik situs.

export const TABLE_POLICIES = {
  // --- Data santri dan turunannya -----------------------------------------------------
  santri: {
    scopeColumn: 'id',
    select: ['admin', 'guruSantri', 'pentashihSantri'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  santri_notes: {
    scopeColumn: 'santri_id',
    select: ['admin', 'guruSantri', 'pentashihSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin'],
  },
  santri_character_scores: {
    scopeColumn: 'santri_id',
    select: ['admin', 'guruSantri', 'pentashihSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin'],
  },
  santri_character_strengths: {
    scopeColumn: 'santri_id',
    select: ['admin', 'guruSantri', 'pentashihSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin', 'guruSantri'],
  },
  santri_juz_scores: {
    scopeColumn: 'santri_id',
    select: ['admin', 'guruSantri', 'pentashihSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin'],
  },
  santri_surah_scores: {
    scopeColumn: 'santri_id',
    select: ['admin', 'guruSantri', 'pentashihSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin'],
  },
  santri_behavior_records: {
    scopeColumn: 'santri_id',
    select: ['admin', 'guruSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin'],
  },
  hafalan_progress: {
    scopeColumn: 'santri_id',
    select: ['admin', 'guruSantri', 'pentashihSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin'],
  },
  murojaah_submissions: {
    scopeColumn: 'santri_id',
    select: ['admin', 'guruSantri', 'pentashihSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin'],
  },
  // Santri boleh melihat riwayat jilidnya sendiri.
  jilid_history: {
    scopeColumn: 'santri_id',
    select: ['admin', 'guruSantri', 'pentashihSantri', 'owner'],
    insert: ['admin', 'guruSantri'], update: ['admin'], delete: ['admin'],
  },
  class_mutations: {
    scopeColumn: 'santri_id',
    select: ['admin', 'guruSantri', 'pentashihSantri'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },

  // --- Kelas dan kehadiran -------------------------------------------------------------
  classes: {
    scopeColumn: 'id',
    select: ['admin', 'pentashihClass'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  class_memberships: {
    scopeColumn: 'class_id',
    select: ['admin', 'guruClass', 'pentashihClass'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  attendance: {
    scopeColumn: 'class_id',
    select: ['admin', 'guruClass', 'pentashihClass'],
    insert: ['admin', 'guruClass'], update: ['admin', 'guruClass'], delete: ['admin'],
  },

  // --- MMQ -----------------------------------------------------------------------------
  mmq_schedule: {
    scopeColumn: 'id',
    select: ['admin', 'guru', 'pentashihMmq'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  mmq_attendance: {
    scopeColumn: 'schedule_id',
    select: ['admin', 'pentashihMmq'],
    insert: ['admin', 'pentashihMmq'], update: ['admin'], delete: ['admin'],
  },
  mmq_notulensi: {
    scopeColumn: 'schedule_id',
    select: ['admin', 'guru', 'pentashihMmq'],
    insert: ['admin', 'pentashihMmq'], update: ['admin'], delete: ['admin'],
  },
  pentashih_class_assignments: {
    select: ['admin'], insert: ['admin'], update: ['admin'], delete: ['admin'],
  },

  // --- Hanya admin ---------------------------------------------------------------------
  guru: { select: ['admin', 'pentashihClass'], insert: ['admin'], update: ['admin'], delete: ['admin'] },
  user_profiles: { select: ['admin'], insert: ['admin'], update: ['admin'], delete: ['admin'] },
  payments: { select: ['admin'], insert: ['admin'], update: ['admin'], delete: ['admin'] },
  expenses: { select: ['admin'], insert: ['admin'], update: ['admin'], delete: ['admin'] },
  login_logs: { select: ['admin'], insert: ['admin'], update: ['admin'], delete: ['admin'] },
  notifications: { select: ['admin'], insert: ['admin'], update: ['admin'], delete: ['admin'] },
  hafalan_items: { select: ['admin'], insert: ['admin'], update: ['admin'], delete: ['admin'] },
  character_assessment_items: { select: ['admin'], insert: ['admin'], update: ['admin'], delete: ['admin'] },
  character_strength_items: { select: ['admin'], insert: ['admin'], update: ['admin'], delete: ['admin'] },
  media_player_settings: { select: ['admin'], insert: ['admin'], update: ['admin'], delete: ['admin'] },

  // --- Konten publik -------------------------------------------------------------------
  academic_calendar: {
    select: ['admin', 'guru', 'santri', 'pentashih'],
    publicFilter: '"is_public" = 1',
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  announcements: {
    select: ['admin'],
    publicFilter: `"status" = 'published' and ("valid_until" is null or "valid_until" >= ?)`,
    publicFilterParams: () => [new Date().toISOString().slice(0, 10)],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  news: {
    select: ['admin'],
    publicFilter: `"status" = 'published'`,
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  website_content: {
    select: ['admin'],
    publicFilter: '"is_public" = 1',
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  music_files: {
    select: ['admin'],
    publicFilter: '"is_active" = 1',
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  // Siapa pun boleh mengirim masukan, hanya admin yang boleh membacanya.
  feedbacks: {
    select: ['admin'],
    publicInsert: true,
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },

  // --- View ------------------------------------------------------------------------------
  // Di Postgres, otorisasi view ini menyatu di klausa WHERE-nya sendiri. Di D1, view-nya
  // dibuat tanpa klausa itu dan pemeriksaannya dipindah ke sini. Dua predikatnya memakai
  // kolom berbeda: kepemilikan lewat santri_id, akses guru lewat class_id.
  payment_status_summary: {
    scopeColumns: { owner: 'santri_id', guruClass: 'class_id' },
    select: ['admin', 'owner', 'guruClass'],
  },

  // --- Tabel internal ------------------------------------------------------------------
  // auth_login_aliases dan auth_rate_limits tidak punya policy di Postgres: keduanya
  // hanya disentuh function SECURITY DEFINER. Di sini keduanya tidak boleh diakses lewat
  // jalur data umum sama sekali, hanya lewat kode autentikasi.
  auth_login_aliases: { internal: true },
  auth_rate_limits: { internal: true },
  users: { internal: true },
};

export const getPolicy = (table) => TABLE_POLICIES[table] ?? null;
