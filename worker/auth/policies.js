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
  // Hampir seluruh tabel di bawah punya cabang "baris ini milik saya" di policy aslinya —
  // santri_id = auth.uid() atau yang setara. Terjemahan pertama melewatkannya di banyak
  // tempat, sehingga santri tidak bisa melihat datanya sendiri. Semuanya dipulihkan.
  santri: {
    scopeColumn: 'id',
    select: ['admin', 'owner', 'guruSantri', 'pentashihSantri'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  // santri_notes memang tanpa cabang kepemilikan: catatan guru tentang seorang santri
  // tidak terbaca oleh santri itu sendiri.
  santri_notes: {
    scopeColumn: 'santri_id',
    select: ['admin', 'guruSantri', 'pentashihSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin'],
  },
  santri_character_scores: {
    scopeColumn: 'santri_id',
    select: ['admin', 'owner', 'guruSantri', 'pentashihSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin'],
  },
  santri_character_strengths: {
    scopeColumn: 'santri_id',
    select: ['admin', 'owner', 'guruSantri', 'pentashihSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin', 'guruSantri'],
  },
  santri_juz_scores: {
    scopeColumn: 'santri_id',
    select: ['admin', 'owner', 'guruSantri', 'pentashihSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin'],
  },
  santri_surah_scores: {
    scopeColumn: 'santri_id',
    select: ['admin', 'owner', 'guruSantri', 'pentashihSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin'],
  },
  // Catatan perilaku juga tanpa cabang kepemilikan, sama seperti santri_notes.
  santri_behavior_records: {
    scopeColumn: 'santri_id',
    select: ['admin', 'guruSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin'],
  },
  hafalan_progress: {
    scopeColumn: 'santri_id',
    select: ['admin', 'owner', 'guruSantri', 'pentashihSantri'],
    insert: ['admin', 'guruSantri'], update: ['admin', 'guruSantri'], delete: ['admin'],
  },
  // Terlihat oleh santri pengirimnya lewat santri_id sekaligus guru tujuannya lewat
  // target_guru_id — dua kolom berbeda pada baris yang sama.
  murojaah_submissions: {
    scopeColumns: { owner: 'santri_id', recipient: 'target_guru_id' },
    scopeColumn: 'santri_id',
    select: ['admin', 'owner', 'recipient', 'guruSantri', 'pentashihSantri'],
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
    select: ['admin', 'owner', 'guruSantri', 'pentashihSantri'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },

  // --- Kelas dan kehadiran -------------------------------------------------------------
  // Policy aslinya punya empat cabang, dan terjemahan pertama hanya memuat dua:
  //
  //   is_admin()
  //   OR id_guru = auth.uid()                 <- guru pengampu kelas itu
  //   OR pentashih_has_class_access(id)
  //   OR EXISTS (class_memberships aktif milik auth.uid() di kelas itu)   <- santrinya
  //
  // Akibat dua cabang yang hilang, guru melihat nol kelas di TV display dan rekap
  // absensi, dan santri tidak bisa melihat kelasnya sendiri. Keempatnya kini ada.
  classes: {
    scopeColumns: { classOwner: 'id_guru', pentashihClass: 'id', santriClass: 'id' },
    scopeColumn: 'id',
    select: ['admin', 'classOwner', 'pentashihClass', 'santriClass'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  class_memberships: {
    scopeColumns: { owner: 'santri_id' },
    scopeColumn: 'class_id',
    select: ['admin', 'owner', 'guruClass', 'pentashihClass'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  // Kehadiran seseorang selalu terlihat oleh orang itu sendiri lewat user_id — cabang
  // yang hilang inilah sebabnya rekap absensi santri tidak menampilkan apa pun.
  attendance: {
    scopeColumns: { owner: 'user_id' },
    scopeColumn: 'class_id',
    select: ['admin', 'owner', 'guruClass', 'pentashihClass'],
    insert: ['admin', 'guruClass'], update: ['admin', 'guruClass'], delete: ['admin'],
  },

  // --- MMQ -----------------------------------------------------------------------------
  mmq_schedule: {
    scopeColumn: 'id',
    select: ['admin', 'guru', 'pentashihMmq'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  mmq_attendance: {
    scopeColumns: { owner: 'guru_id' },
    scopeColumn: 'schedule_id',
    select: ['admin', 'owner', 'pentashihMmq'],
    insert: ['admin', 'pentashihMmq'], update: ['admin'], delete: ['admin'],
  },
  mmq_notulensi: {
    scopeColumn: 'schedule_id',
    select: ['admin', 'guru', 'pentashihMmq'],
    insert: ['admin', 'pentashihMmq'], update: ['admin'], delete: ['admin'],
  },
  pentashih_class_assignments: {
    scopeColumns: { owner: 'pentashih_id' },
    select: ['admin', 'owner'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },

  // --- Milik sendiri, selain admin -----------------------------------------------------
  // Guru terlihat oleh dirinya sendiri, oleh santri yang diajarnya, dan oleh pentashih
  // yang memegang salah satu kelasnya. Terjemahan pertama hanya menyebut pentashih, dan
  // bahkan itu pun tidak berfungsi karena kolom scope-nya tidak pernah ditentukan.
  guru: {
    scopeColumns: { owner: 'id', guruTeachesCaller: 'id', pentashihOfGuru: 'id' },
    select: ['admin', 'owner', 'guruTeachesCaller', 'pentashihOfGuru'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  user_profiles: {
    scopeColumns: { owner: 'id' },
    select: ['admin', 'owner'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  // Santri melihat pembayarannya sendiri. Tanpa cabang ini, riwayat pembayaran di
  // dashboard santri selalu kosong.
  payments: {
    scopeColumns: { owner: 'santri_id' },
    select: ['admin', 'owner'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  notifications: {
    scopeColumns: { owner: 'recipient_id' },
    select: ['admin', 'owner'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  media_player_settings: {
    scopeColumns: { owner: 'user_id' },
    select: ['admin', 'owner'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  // Terbaca siapa pun yang sudah login selama item-nya aktif; admin melihat semuanya.
  hafalan_items: {
    select: ['admin'],
    authenticatedFilter: '"is_active" = 1',
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  // Policy aslinya berbunyi USING (true) untuk authenticated: daftar acuan penilaian
  // terbuka bagi seluruh peran.
  character_assessment_items: {
    select: ['admin', 'guru', 'santri', 'pentashih'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  character_strength_items: {
    select: ['admin', 'guru', 'santri', 'pentashih'],
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },

  // --- Hanya admin ---------------------------------------------------------------------
  expenses: { select: ['admin'], insert: ['admin'], update: ['admin'], delete: ['admin'] },
  login_logs: { select: ['admin'], insert: ['admin'], update: ['admin'], delete: ['admin'] },

  // --- Konten publik -------------------------------------------------------------------
  academic_calendar: {
    select: ['admin', 'guru', 'santri', 'pentashih'],
    publicFilter: '"is_public" = 1',
    insert: ['admin'], update: ['admin'], delete: ['admin'],
  },
  announcements: {
    select: ['admin'],
    publicFilter: `"status" = 'published' and ("valid_until" is null or "valid_until" >= ?)`,
    // Tanggal hari ini menurut WIB, sama seperti seluruh perbandingan tanggal lain di
    // lapisan ini. Pengumuman yang berlaku sampai hari ini tidak boleh hilang tujuh jam
    // lebih awal hanya karena servernya menghitung dengan UTC.
    publicFilterParams: () => [new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)],
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
