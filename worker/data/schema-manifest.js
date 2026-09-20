// Dihasilkan oleh scripts/generate-d1-schema.mjs. Jangan diedit langsung.
// Daftar kolom sah per tabel, dipakai untuk memvalidasi query sebelum dirangkai ke SQL.

export const SCHEMA_COLUMNS = {
  "academic_calendar": [
    "id",
    "date",
    "title",
    "description",
    "is_holiday",
    "is_public",
    "event_type",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "announcements": [
    "id",
    "title",
    "slug",
    "excerpt",
    "content",
    "cover_image_url",
    "status",
    "priority",
    "valid_until",
    "published_at",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "guru": [
    "id",
    "nama",
    "email",
    "no_hp",
    "alamat",
    "foto_url",
    "rfid_tag",
    "jabatan",
    "roles",
    "is_notulen",
    "jenis_kelamin",
    "tanggal_lahir",
    "status_guru",
    "status",
    "created_at",
    "updated_at",
    "deleted_at",
    "created_by",
    "updated_by",
    "avatar_path"
  ],
  "classes": [
    "id",
    "nama_kelas",
    "id_guru",
    "sesi",
    "kategori",
    "sort_order",
    "is_active",
    "created_at",
    "updated_at",
    "deleted_at",
    "created_by",
    "updated_by"
  ],
  "attendance": [
    "id",
    "user_id",
    "role",
    "attendance_date",
    "check_in_time",
    "check_in_timestamp",
    "class_id",
    "sesi",
    "status",
    "source",
    "correction_reason",
    "corrected_by",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
    "attended_session"
  ],
  "auth_login_aliases": [
    "id",
    "auth_user_id",
    "alias_type",
    "alias_value",
    "normalized_alias",
    "internal_email",
    "is_active",
    "created_at",
    "updated_at"
  ],
  "auth_rate_limits": [
    "id",
    "purpose",
    "ip_hash",
    "alias_hash",
    "window_start",
    "attempts",
    "blocked_until",
    "created_at",
    "updated_at"
  ],
  "character_assessment_items": [
    "id",
    "item_order",
    "item_name",
    "is_active",
    "created_at",
    "updated_at"
  ],
  "character_strength_items": [
    "strength_key",
    "item_order",
    "label",
    "is_active",
    "created_at",
    "updated_at"
  ],
  "santri": [
    "id",
    "nomor_induk_qiroati",
    "nama_lengkap",
    "nama_panggilan",
    "kategori",
    "jenis_kelamin",
    "tanggal_lahir",
    "tempat_lahir",
    "alamat",
    "no_hp_ortu",
    "email",
    "foto_url",
    "avatar_path",
    "rfid_tag",
    "current_class_id",
    "sesi_mengaji",
    "jilid",
    "status",
    "points",
    "order_in_class",
    "created_at",
    "updated_at",
    "deleted_at",
    "created_by",
    "updated_by",
    "nama_ayah",
    "nama_ibu",
    "tanggal_pendaftaran",
    "no_kk",
    "no_nik",
    "berkas_foto",
    "berkas_akta",
    "berkas_kk",
    "berkas_form",
    "link_qiroati",
    "default_spp_amount",
    "archive_reason",
    "archived_by",
    "juz_hafalan"
  ],
  "class_memberships": [
    "id",
    "santri_id",
    "class_id",
    "start_date",
    "end_date",
    "status",
    "order_in_class",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "class_mutations": [
    "id",
    "santri_id",
    "from_class_id",
    "to_class_id",
    "mutation_date",
    "reason",
    "created_at",
    "created_by"
  ],
  "expenses": [
    "id",
    "tanggal_pengeluaran",
    "kategori",
    "deskripsi",
    "jumlah",
    "bukti_url",
    "deleted_at",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "feedbacks": [
    "id",
    "nama",
    "email",
    "phone",
    "message",
    "status",
    "created_at",
    "handled_by",
    "handled_at"
  ],
  "hafalan_items": [
    "id",
    "category",
    "jilid",
    "item_name",
    "item_order",
    "is_active",
    "created_at",
    "updated_at",
    "program_scope"
  ],
  "hafalan_progress": [
    "id",
    "santri_id",
    "item_id",
    "category",
    "item_name",
    "status",
    "nilai",
    "catatan",
    "assessed_by",
    "assessed_at",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
    "score"
  ],
  "jilid_history": [
    "id",
    "santri_id",
    "from_jilid",
    "to_jilid",
    "changed_at",
    "changed_by"
  ],
  "login_logs": [
    "id",
    "user_id",
    "role",
    "username_attempt",
    "status",
    "ip_address",
    "city",
    "country",
    "device",
    "user_agent",
    "created_at"
  ],
  "music_files": [
    "id",
    "title",
    "artist",
    "filename",
    "storage_path",
    "file_url",
    "is_active",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "media_player_settings": [
    "id",
    "user_id",
    "playback_position",
    "is_playing",
    "shuffle_enabled",
    "loop_enabled",
    "crossfade_enabled",
    "current_track_id",
    "created_at",
    "updated_at"
  ],
  "mmq_schedule": [
    "id",
    "day_of_week",
    "start_time",
    "end_time",
    "location",
    "is_active",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "mmq_attendance": [
    "id",
    "schedule_id",
    "guru_id",
    "attendance_date",
    "check_in_timestamp",
    "status",
    "notes",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "mmq_notulensi": [
    "id",
    "schedule_id",
    "tanggal",
    "judul",
    "isi",
    "notulen_id",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "murojaah_submissions": [
    "id",
    "santri_id",
    "target_guru_id",
    "type",
    "content",
    "recording_path",
    "status",
    "feedback",
    "submitted_at",
    "reviewed_at",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "news": [
    "id",
    "title",
    "slug",
    "excerpt",
    "content",
    "cover_image_url",
    "status",
    "published_at",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "notifications": [
    "id",
    "recipient_id",
    "title",
    "body",
    "type",
    "is_read",
    "created_at"
  ],
  "payments": [
    "id",
    "santri_id",
    "bulan",
    "tahun",
    "jumlah",
    "tanggal_pembayaran",
    "metode_pembayaran",
    "status",
    "catatan",
    "transaction_id",
    "deleted_at",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "pentashih_class_assignments": [
    "id",
    "pentashih_id",
    "class_id",
    "scope",
    "is_active",
    "starts_at",
    "ends_at",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
    "mmq_schedule_id"
  ],
  "santri_behavior_records": [
    "id",
    "santri_id",
    "guru_id",
    "incident_date",
    "level",
    "behavior",
    "follow_up",
    "teacher_note",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "santri_character_scores": [
    "id",
    "santri_id",
    "item_id",
    "score",
    "assessed_by",
    "assessed_at",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "santri_character_strengths": [
    "santri_id",
    "strength_key",
    "selected_by",
    "selected_at"
  ],
  "santri_juz_scores": [
    "id",
    "santri_id",
    "juz_number",
    "score",
    "assessed_by",
    "assessed_at",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "santri_notes": [
    "id",
    "santri_id",
    "guru_id",
    "note",
    "visibility",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "santri_surah_scores": [
    "id",
    "santri_id",
    "juz_number",
    "surah_name",
    "score",
    "assessed_by",
    "assessed_at",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "user_profiles": [
    "id",
    "role",
    "display_name",
    "email",
    "phone",
    "status",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "website_content": [
    "id",
    "key",
    "content",
    "is_public",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
  ],
  "payment_status_summary": [
    "santri_id",
    "class_id",
    "bulan",
    "tahun",
    "status"
  ]
};

// Kolom yang isinya JSON: dibongkar saat dibaca, dirangkai saat ditulis.
export const JSON_COLUMNS = {
  "announcements": [
    "content"
  ],
  "guru": [
    "roles"
  ],
  "santri": [
    "juz_hafalan"
  ],
  "news": [
    "content"
  ],
  "website_content": [
    "content"
  ]
};

// Kolom uang disimpan sebagai INTEGER dalam satuan sen, sementara seluruh aplikasi
// bekerja dengan rupiah desimal. Konversinya dilakukan lapisan data agar tidak ada
// pemanggil yang perlu mengingatnya — salah arah sekali saja menghasilkan angka seratus
// kali lipat atau seperseratusnya, tanpa galat apa pun.
export const MONEY_COLUMNS = {
  "santri": [
    "default_spp_amount"
  ],
  "expenses": [
    "jumlah"
  ],
  "payments": [
    "jumlah"
  ]
};

export const isMoneyColumn = (table, column) =>
  Object.prototype.hasOwnProperty.call(MONEY_COLUMNS, table) && MONEY_COLUMNS[table].includes(column);

export const isJsonColumn = (table, column) =>
  Object.prototype.hasOwnProperty.call(JSON_COLUMNS, table) && JSON_COLUMNS[table].includes(column);

export const tableExists = (table) => Object.prototype.hasOwnProperty.call(SCHEMA_COLUMNS, table);

export const columnExists = (table, column) =>
  tableExists(table) && SCHEMA_COLUMNS[table].includes(column);
