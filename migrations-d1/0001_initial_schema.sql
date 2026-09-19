-- Skema Cloudflare D1, dihasilkan dari dump produksi Supabase.
-- Dibuat oleh scripts/generate-d1-schema.mjs. Jangan diedit langsung:
-- ubah generatornya lalu jalankan ulang, agar tetap bisa direproduksi.
--
-- Keputusan pemetaan tipe ada di docs/51-d1-schema-mapping.md.
-- Kolom uang disimpan sebagai INTEGER dalam satuan sen.
-- UUID tidak punya default: dibuat di Worker lewat crypto.randomUUID().

-- Kolom array Postgres (text[]) disimpan sebagai array JSON dalam kolom TEXT:
--   guru.roles          hanya dibaca utuh lalu disaring di klien
--   santri.juz_hafalan  difilter keanggotaannya, pakai:
--     WHERE EXISTS (SELECT 1 FROM json_each("santri"."juz_hafalan") WHERE "value" = ?)
--
-- Index GIN "guru_roles_gin_idx" sengaja tidak dibawa: tidak ada function maupun query
-- yang memakainya, jadi tidak ada yang hilang. json_each tidak bisa diindeks di SQLite,
-- tetapi santri hanya berisi ratusan baris sehingga pemindaian penuh tetap murah.

PRAGMA foreign_keys = ON;

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "encrypted_password" TEXT,
  "password_algorithm" TEXT NOT NULL DEFAULT 'bcrypt' CHECK ("password_algorithm" IN ('bcrypt', 'pbkdf2')),
  "email_confirmed_at" TEXT,
  "last_sign_in_at" TEXT,
  "banned_until" TEXT,
  "raw_user_meta_data" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "deleted_at" TEXT,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users" ("email") WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX "users_phone_key" ON "users" ("phone") WHERE "phone" IS NOT NULL;

CREATE TABLE "academic_calendar" (
  "id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "is_holiday" INTEGER NOT NULL DEFAULT 0,
  "is_public" INTEGER NOT NULL DEFAULT 1,
  "event_type" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "academic_calendar_date_key" UNIQUE ("date"),
  CONSTRAINT "academic_calendar_title_not_blank" CHECK ((length(trim("title")) > 0)),
  CONSTRAINT "academic_calendar_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "academic_calendar_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "announcements" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "excerpt" TEXT,
  "content" TEXT,
  "cover_image_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "priority" TEXT,
  "valid_until" TEXT,
  "published_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "announcements_slug_key" UNIQUE ("slug"),
  CONSTRAINT "announcements_priority_check" CHECK ((("priority" IS NULL) OR ("priority" IN ('low', 'normal', 'high')))),
  CONSTRAINT "announcements_slug_not_blank" CHECK ((length(trim("slug")) > 0)),
  CONSTRAINT "announcements_status_check" CHECK (("status" IN ('draft', 'published', 'archived'))),
  CONSTRAINT "announcements_title_not_blank" CHECK ((length(trim("title")) > 0)),
  CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "announcements_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "guru" (
  "id" TEXT NOT NULL,
  "nama" TEXT NOT NULL,
  "email" TEXT,
  "no_hp" TEXT,
  "alamat" TEXT,
  "foto_url" TEXT,
  "rfid_tag" TEXT,
  "jabatan" TEXT,
  "roles" TEXT NOT NULL DEFAULT '[]',
  "is_notulen" INTEGER NOT NULL DEFAULT 0,
  "jenis_kelamin" TEXT,
  "tanggal_lahir" TEXT,
  "status_guru" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'inactive', 'suspended')),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "deleted_at" TEXT,
  "created_by" TEXT,
  "updated_by" TEXT,
  "avatar_path" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "guru_avatar_path_expected" CHECK ((("avatar_path" IS NULL) OR ("avatar_path" = (('guru/' || ("id")) || '/profile.webp')))),
  CONSTRAINT "guru_email_trimmed" CHECK ((("email" IS NULL) OR ("email" = trim("email")))),
  CONSTRAINT "guru_nama_not_blank" CHECK ((length(trim("nama")) > 0)),
  CONSTRAINT "guru_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "guru_id_fkey" FOREIGN KEY ("id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "guru_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "classes" (
  "id" TEXT NOT NULL,
  "nama_kelas" TEXT NOT NULL,
  "id_guru" TEXT,
  "sesi" TEXT,
  "kategori" TEXT,
  "sort_order" INTEGER,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "deleted_at" TEXT,
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "classes_nama_kelas_not_blank" CHECK ((length(trim("nama_kelas")) > 0)),
  CONSTRAINT "classes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "classes_id_guru_fkey" FOREIGN KEY ("id_guru") REFERENCES "guru" ("id"),
  CONSTRAINT "classes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "attendance" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('admin', 'guru', 'santri', 'pentashih')),
  "attendance_date" TEXT NOT NULL,
  "check_in_time" TEXT,
  "check_in_timestamp" TEXT,
  "class_id" TEXT,
  "sesi" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Hadir',
  "source" TEXT NOT NULL DEFAULT 'rfid',
  "correction_reason" TEXT,
  "corrected_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  "attended_session" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "attendance_correction_reason_required" CHECK ((("corrected_by" IS NULL) OR (length(trim(COALESCE("correction_reason", ''))) > 0))),
  CONSTRAINT "attendance_source_check" CHECK (("source" IN ('rfid', 'manual', 'correction', 'import'))),
  CONSTRAINT "attendance_status_not_blank" CHECK ((length(trim("status")) > 0)),
  CONSTRAINT "attendance_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id"),
  CONSTRAINT "attendance_corrected_by_fkey" FOREIGN KEY ("corrected_by") REFERENCES "users" ("id"),
  CONSTRAINT "attendance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "attendance_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id"),
  CONSTRAINT "attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE "auth_login_aliases" (
  "id" TEXT NOT NULL,
  "auth_user_id" TEXT NOT NULL,
  "alias_type" TEXT NOT NULL DEFAULT 'nomor_induk_qiroati',
  "alias_value" TEXT NOT NULL,
  "normalized_alias" TEXT NOT NULL,
  "internal_email" TEXT NOT NULL,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY ("id"),
  CONSTRAINT "auth_login_aliases_alias_no_space" CHECK (("alias_value" NOT LIKE '% %' AND instr("alias_value", char(9)) = 0 AND instr("alias_value", char(10)) = 0 AND instr("alias_value", char(11)) = 0 AND instr("alias_value", char(12)) = 0 AND instr("alias_value", char(13)) = 0)),
  CONSTRAINT "auth_login_aliases_alias_trimmed" CHECK (("alias_value" = trim("alias_value"))),
  CONSTRAINT "auth_login_aliases_alias_type_check" CHECK (("alias_type" = 'nomor_induk_qiroati')),
  CONSTRAINT "auth_login_aliases_internal_email_not_blank" CHECK ((length(trim("internal_email")) > 0)),
  CONSTRAINT "auth_login_aliases_normalized_not_blank" CHECK ((length(trim("normalized_alias")) > 0)),
  CONSTRAINT "auth_login_aliases_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE "auth_rate_limits" (
  "id" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "ip_hash" TEXT NOT NULL,
  "alias_hash" TEXT NOT NULL,
  "window_start" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "blocked_until" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY ("id"),
  CONSTRAINT "auth_rate_limits_attempts_non_negative" CHECK (("attempts" >= 0))
);

CREATE TABLE "character_assessment_items" (
  "id" INTEGER NOT NULL,
  "item_order" INTEGER NOT NULL,
  "item_name" TEXT NOT NULL,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY ("id"),
  CONSTRAINT "character_assessment_items_item_name_key" UNIQUE ("item_name"),
  CONSTRAINT "character_assessment_items_item_order_key" UNIQUE ("item_order"),
  CONSTRAINT "character_assessment_items_name_not_blank" CHECK ((length(trim("item_name")) > 0)),
  CONSTRAINT "character_assessment_items_order_positive" CHECK (("item_order" > 0))
);

CREATE TABLE "character_strength_items" (
  "strength_key" TEXT NOT NULL,
  "item_order" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY ("strength_key"),
  CONSTRAINT "character_strength_items_item_order_key" UNIQUE ("item_order"),
  CONSTRAINT "character_strength_items_label_key" UNIQUE ("label"),
  CONSTRAINT "character_strength_items_key_not_blank" CHECK ((length(trim("strength_key")) > 0)),
  CONSTRAINT "character_strength_items_label_not_blank" CHECK ((length(trim("label")) > 0)),
  CONSTRAINT "character_strength_items_order_positive" CHECK (("item_order" > 0))
);

CREATE TABLE "santri" (
  "id" TEXT NOT NULL,
  "nomor_induk_qiroati" TEXT,
  "nama_lengkap" TEXT NOT NULL,
  "nama_panggilan" TEXT,
  "kategori" TEXT,
  "jenis_kelamin" TEXT,
  "tanggal_lahir" TEXT,
  "tempat_lahir" TEXT,
  "alamat" TEXT,
  "no_hp_ortu" TEXT,
  "email" TEXT,
  "foto_url" TEXT,
  "avatar_path" TEXT,
  "rfid_tag" TEXT,
  "current_class_id" TEXT,
  "sesi_mengaji" TEXT,
  "jilid" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Aktif',
  "points" INTEGER NOT NULL DEFAULT 0,
  "order_in_class" INTEGER,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "deleted_at" TEXT,
  "created_by" TEXT,
  "updated_by" TEXT,
  "nama_ayah" TEXT,
  "nama_ibu" TEXT,
  "tanggal_pendaftaran" TEXT,
  "no_kk" TEXT,
  "no_nik" TEXT,
  "berkas_foto" INTEGER NOT NULL DEFAULT 0,
  "berkas_akta" INTEGER NOT NULL DEFAULT 0,
  "berkas_kk" INTEGER NOT NULL DEFAULT 0,
  "berkas_form" INTEGER NOT NULL DEFAULT 0,
  "link_qiroati" TEXT,
  "default_spp_amount" INTEGER,
  "archive_reason" TEXT,
  "archived_by" TEXT,
  "juz_hafalan" TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY ("id"),
  CONSTRAINT "santri_avatar_path_expected" CHECK ((("avatar_path" IS NULL) OR ("avatar_path" = (('santri/' || ("id")) || '/profile.webp')))),
  CONSTRAINT "santri_default_spp_amount_valid" CHECK ((("default_spp_amount" IS NULL) OR ("default_spp_amount" >= (10000)))),
  CONSTRAINT "santri_email_trimmed" CHECK ((("email" IS NULL) OR ("email" = trim("email")))),
  CONSTRAINT "santri_kategori_check" CHECK (("kategori" IN ('Anak', 'PTPT', 'Dewasa'))),
  CONSTRAINT "santri_nama_lengkap_not_blank" CHECK ((length(trim("nama_lengkap")) > 0)),
  CONSTRAINT "santri_nomor_induk_no_space" CHECK (("nomor_induk_qiroati" NOT LIKE '% %' AND instr("nomor_induk_qiroati", char(9)) = 0 AND instr("nomor_induk_qiroati", char(10)) = 0 AND instr("nomor_induk_qiroati", char(11)) = 0 AND instr("nomor_induk_qiroati", char(12)) = 0 AND instr("nomor_induk_qiroati", char(13)) = 0)),
  CONSTRAINT "santri_nomor_induk_required_for_non_adult" CHECK ((("kategori" = 'Dewasa') OR ("nomor_induk_qiroati" IS NOT NULL))),
  CONSTRAINT "santri_nomor_induk_trimmed" CHECK (("nomor_induk_qiroati" = trim("nomor_induk_qiroati"))),
  CONSTRAINT "santri_points_non_negative" CHECK (("points" >= 0)),
  CONSTRAINT "santri_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "users" ("id"),
  CONSTRAINT "santri_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "santri_current_class_id_fkey" FOREIGN KEY ("current_class_id") REFERENCES "classes" ("id"),
  CONSTRAINT "santri_id_fkey" FOREIGN KEY ("id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "santri_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "class_memberships" (
  "id" TEXT NOT NULL,
  "santri_id" TEXT NOT NULL,
  "class_id" TEXT NOT NULL,
  "start_date" TEXT NOT NULL,
  "end_date" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "order_in_class" INTEGER,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "class_memberships_date_order" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
  CONSTRAINT "class_memberships_status_check" CHECK (("status" IN ('active', 'inactive', 'moved', 'graduated'))),
  CONSTRAINT "class_memberships_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE,
  CONSTRAINT "class_memberships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "class_memberships_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri" ("id") ON DELETE CASCADE,
  CONSTRAINT "class_memberships_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "class_mutations" (
  "id" TEXT NOT NULL,
  "santri_id" TEXT NOT NULL,
  "from_class_id" TEXT,
  "to_class_id" TEXT,
  "mutation_date" TEXT NOT NULL DEFAULT (date('now')),
  "reason" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "class_mutations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "class_mutations_from_class_id_fkey" FOREIGN KEY ("from_class_id") REFERENCES "classes" ("id"),
  CONSTRAINT "class_mutations_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri" ("id") ON DELETE CASCADE,
  CONSTRAINT "class_mutations_to_class_id_fkey" FOREIGN KEY ("to_class_id") REFERENCES "classes" ("id")
);

CREATE TABLE "expenses" (
  "id" TEXT NOT NULL,
  "tanggal_pengeluaran" TEXT NOT NULL,
  "kategori" TEXT,
  "deskripsi" TEXT,
  "jumlah" INTEGER NOT NULL,
  "bukti_url" TEXT,
  "deleted_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "expenses_jumlah_check" CHECK (("jumlah" >= 0)),
  CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "expenses_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "feedbacks" (
  "id" TEXT NOT NULL,
  "nama" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "handled_by" TEXT,
  "handled_at" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "feedbacks_message_not_blank" CHECK ((length(trim("message")) > 0)),
  CONSTRAINT "feedbacks_status_check" CHECK (("status" IN ('new', 'reviewed', 'closed', 'spam'))),
  CONSTRAINT "feedbacks_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "users" ("id")
);

CREATE TABLE "hafalan_items" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "jilid" TEXT,
  "item_name" TEXT NOT NULL,
  "item_order" INTEGER,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "program_scope" TEXT NOT NULL DEFAULT 'TPQ',
  PRIMARY KEY ("id"),
  CONSTRAINT "hafalan_items_category_not_blank" CHECK ((length(trim("category")) > 0)),
  CONSTRAINT "hafalan_items_name_not_blank" CHECK ((length(trim("item_name")) > 0)),
  CONSTRAINT "hafalan_items_program_scope_check" CHECK (("program_scope" IN ('TPQ', 'PTPT')))
);

CREATE TABLE "hafalan_progress" (
  "id" TEXT NOT NULL,
  "santri_id" TEXT NOT NULL,
  "item_id" TEXT,
  "category" TEXT,
  "item_name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'belum',
  "nilai" TEXT,
  "catatan" TEXT,
  "assessed_by" TEXT,
  "assessed_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  "score" INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY ("id"),
  CONSTRAINT "hafalan_progress_score_check" CHECK ((("score" >= 1) AND ("score" <= 4))),
  CONSTRAINT "hafalan_progress_status_check" CHECK (("status" IN ('belum', 'proses', 'lulus', 'ulang'))),
  CONSTRAINT "hafalan_progress_assessed_by_fkey" FOREIGN KEY ("assessed_by") REFERENCES "guru" ("id"),
  CONSTRAINT "hafalan_progress_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "hafalan_progress_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "hafalan_items" ("id") ON DELETE SET NULL,
  CONSTRAINT "hafalan_progress_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri" ("id") ON DELETE CASCADE,
  CONSTRAINT "hafalan_progress_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "jilid_history" (
  "id" TEXT NOT NULL,
  "santri_id" TEXT NOT NULL,
  "from_jilid" TEXT,
  "to_jilid" TEXT NOT NULL,
  "changed_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "changed_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "jilid_history_from_jilid_not_blank" CHECK ((("from_jilid" IS NULL) OR (length(trim("from_jilid")) > 0))),
  CONSTRAINT "jilid_history_to_jilid_not_blank" CHECK ((length(trim("to_jilid")) > 0)),
  CONSTRAINT "jilid_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users" ("id") ON DELETE SET NULL,
  CONSTRAINT "jilid_history_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri" ("id") ON DELETE CASCADE
);

CREATE TABLE "login_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "role" TEXT,
  "username_attempt" TEXT,
  "status" TEXT NOT NULL,
  "ip_address" TEXT,
  "city" TEXT,
  "country" TEXT,
  "device" TEXT,
  "user_agent" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY ("id"),
  CONSTRAINT "login_logs_role_check" CHECK ((("role" IS NULL) OR ("role" IN ('admin', 'guru', 'santri', 'pentashih')))),
  CONSTRAINT "login_logs_status_check" CHECK (("status" IN ('success', 'failed'))),
  CONSTRAINT "login_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE TABLE "music_files" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "artist" TEXT,
  "filename" TEXT,
  "storage_path" TEXT,
  "file_url" TEXT NOT NULL,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "music_files_file_url_not_blank" CHECK ((length(trim("file_url")) > 0)),
  CONSTRAINT "music_files_title_not_blank" CHECK ((length(trim("title")) > 0)),
  CONSTRAINT "music_files_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "music_files_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "media_player_settings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "playback_position" INTEGER NOT NULL DEFAULT 0,
  "is_playing" INTEGER NOT NULL DEFAULT 0,
  "shuffle_enabled" INTEGER NOT NULL DEFAULT 0,
  "loop_enabled" INTEGER NOT NULL DEFAULT 0,
  "crossfade_enabled" INTEGER NOT NULL DEFAULT 0,
  "current_track_id" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY ("id"),
  CONSTRAINT "media_player_settings_position_non_negative" CHECK (("playback_position" >= 0)),
  CONSTRAINT "media_player_settings_current_track_id_fkey" FOREIGN KEY ("current_track_id") REFERENCES "music_files" ("id") ON DELETE SET NULL,
  CONSTRAINT "media_player_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE "mmq_schedule" (
  "id" TEXT NOT NULL,
  "day_of_week" INTEGER,
  "start_time" TEXT,
  "end_time" TEXT,
  "location" TEXT,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "mmq_schedule_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
  CONSTRAINT "mmq_schedule_time_order" CHECK ((("end_time" IS NULL) OR ("start_time" IS NULL) OR ("end_time" > "start_time"))),
  CONSTRAINT "mmq_schedule_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "mmq_schedule_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "mmq_attendance" (
  "id" TEXT NOT NULL,
  "schedule_id" TEXT NOT NULL,
  "guru_id" TEXT NOT NULL,
  "attendance_date" TEXT NOT NULL,
  "check_in_timestamp" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Hadir',
  "notes" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "mmq_attendance_status_not_blank" CHECK ((length(trim("status")) > 0)),
  CONSTRAINT "mmq_attendance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "mmq_attendance_guru_id_fkey" FOREIGN KEY ("guru_id") REFERENCES "guru" ("id") ON DELETE CASCADE,
  CONSTRAINT "mmq_attendance_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "mmq_schedule" ("id") ON DELETE CASCADE,
  CONSTRAINT "mmq_attendance_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "mmq_notulensi" (
  "id" TEXT NOT NULL,
  "schedule_id" TEXT NOT NULL,
  "tanggal" TEXT NOT NULL,
  "judul" TEXT NOT NULL,
  "isi" TEXT,
  "notulen_id" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "mmq_notulensi_judul_not_blank" CHECK ((length(trim("judul")) > 0)),
  CONSTRAINT "mmq_notulensi_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "mmq_notulensi_notulen_id_fkey" FOREIGN KEY ("notulen_id") REFERENCES "guru" ("id"),
  CONSTRAINT "mmq_notulensi_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "mmq_schedule" ("id") ON DELETE CASCADE,
  CONSTRAINT "mmq_notulensi_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "murojaah_submissions" (
  "id" TEXT NOT NULL,
  "santri_id" TEXT NOT NULL,
  "target_guru_id" TEXT,
  "type" TEXT,
  "content" TEXT,
  "recording_path" TEXT,
  "status" TEXT NOT NULL DEFAULT 'menunggu',
  "feedback" TEXT,
  "submitted_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "reviewed_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "murojaah_submissions_status_check" CHECK (("status" IN ('menunggu', 'direview', 'diterima', 'perlu_perbaikan'))),
  CONSTRAINT "murojaah_submissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "murojaah_submissions_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri" ("id") ON DELETE CASCADE,
  CONSTRAINT "murojaah_submissions_target_guru_id_fkey" FOREIGN KEY ("target_guru_id") REFERENCES "guru" ("id"),
  CONSTRAINT "murojaah_submissions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "news" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "excerpt" TEXT,
  "content" TEXT,
  "cover_image_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "published_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "news_slug_key" UNIQUE ("slug"),
  CONSTRAINT "news_slug_not_blank" CHECK ((length(trim("slug")) > 0)),
  CONSTRAINT "news_status_check" CHECK (("status" IN ('draft', 'published', 'archived'))),
  CONSTRAINT "news_title_not_blank" CHECK ((length(trim("title")) > 0)),
  CONSTRAINT "news_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "news_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "recipient_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "type" TEXT,
  "is_read" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY ("id"),
  CONSTRAINT "notifications_title_not_blank" CHECK ((length(trim("title")) > 0)),
  CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "santri_id" TEXT NOT NULL,
  "bulan" INTEGER,
  "tahun" INTEGER,
  "jumlah" INTEGER NOT NULL,
  "tanggal_pembayaran" TEXT NOT NULL,
  "metode_pembayaran" TEXT,
  "status" TEXT NOT NULL DEFAULT 'paid',
  "catatan" TEXT,
  "transaction_id" TEXT,
  "deleted_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "payments_bulan_check" CHECK ((("bulan" >= 1) AND ("bulan" <= 12))),
  CONSTRAINT "payments_jumlah_check" CHECK (("jumlah" >= 0)),
  CONSTRAINT "payments_status_check" CHECK (("status" IN ('paid', 'unpaid', 'void', 'refunded'))),
  CONSTRAINT "payments_tahun_check" CHECK ((("tahun" >= 2000) AND ("tahun" <= 2100))),
  CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "payments_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri" ("id") ON DELETE CASCADE,
  CONSTRAINT "payments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "pentashih_class_assignments" (
  "id" TEXT NOT NULL,
  "pentashih_id" TEXT NOT NULL,
  "class_id" TEXT,
  "scope" TEXT NOT NULL DEFAULT 'class',
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "starts_at" TEXT,
  "ends_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  "mmq_schedule_id" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "pentashih_assignments_scope_check" CHECK (("scope" IN ('class', 'mmq', 'both'))),
  CONSTRAINT "pentashih_assignments_scope_target_check" CHECK (((("scope" = 'class') AND ("class_id" IS NOT NULL) AND ("mmq_schedule_id" IS NULL)) OR (("scope" = 'mmq') AND ("class_id" IS NULL) AND ("mmq_schedule_id" IS NOT NULL)) OR (("scope" = 'both') AND ("class_id" IS NOT NULL) AND ("mmq_schedule_id" IS NOT NULL)))),
  CONSTRAINT "pentashih_class_assignments_date_order" CHECK ((("ends_at" IS NULL) OR ("starts_at" IS NULL) OR ("ends_at" >= "starts_at"))),
  CONSTRAINT "pentashih_assignments_mmq_schedule_fkey" FOREIGN KEY ("mmq_schedule_id") REFERENCES "mmq_schedule" ("id") ON DELETE CASCADE,
  CONSTRAINT "pentashih_class_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE,
  CONSTRAINT "pentashih_class_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "pentashih_class_assignments_pentashih_id_fkey" FOREIGN KEY ("pentashih_id") REFERENCES "guru" ("id") ON DELETE CASCADE,
  CONSTRAINT "pentashih_class_assignments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "santri_behavior_records" (
  "id" TEXT NOT NULL,
  "santri_id" TEXT NOT NULL,
  "guru_id" TEXT,
  "incident_date" TEXT NOT NULL DEFAULT (date('now')),
  "level" TEXT NOT NULL,
  "behavior" TEXT NOT NULL,
  "follow_up" TEXT NOT NULL,
  "teacher_note" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "santri_behavior_records_behavior_not_blank" CHECK ((length(trim("behavior")) > 0)),
  CONSTRAINT "santri_behavior_records_follow_up_not_blank" CHECK ((length(trim("follow_up")) > 0)),
  CONSTRAINT "santri_behavior_records_level_check" CHECK (("level" IN ('Ringan', 'Sedang', 'Berat'))),
  CONSTRAINT "santri_behavior_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "santri_behavior_records_guru_id_fkey" FOREIGN KEY ("guru_id") REFERENCES "guru" ("id"),
  CONSTRAINT "santri_behavior_records_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri" ("id") ON DELETE CASCADE,
  CONSTRAINT "santri_behavior_records_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "santri_character_scores" (
  "id" TEXT NOT NULL,
  "santri_id" TEXT NOT NULL,
  "item_id" INTEGER NOT NULL,
  "score" INTEGER NOT NULL,
  "assessed_by" TEXT,
  "assessed_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "santri_character_scores_santri_item_unique" UNIQUE ("santri_id", "item_id"),
  CONSTRAINT "santri_character_scores_score_check" CHECK ((("score" >= 1) AND ("score" <= 4))),
  CONSTRAINT "santri_character_scores_assessed_by_fkey" FOREIGN KEY ("assessed_by") REFERENCES "guru" ("id"),
  CONSTRAINT "santri_character_scores_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "santri_character_scores_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "character_assessment_items" ("id"),
  CONSTRAINT "santri_character_scores_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri" ("id") ON DELETE CASCADE,
  CONSTRAINT "santri_character_scores_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "santri_character_strengths" (
  "santri_id" TEXT NOT NULL,
  "strength_key" TEXT NOT NULL,
  "selected_by" TEXT,
  "selected_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY ("santri_id", "strength_key"),
  CONSTRAINT "santri_character_strengths_key_not_blank" CHECK ((length(trim("strength_key")) > 0)),
  CONSTRAINT "santri_character_strengths_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri" ("id") ON DELETE CASCADE,
  CONSTRAINT "santri_character_strengths_selected_by_fkey" FOREIGN KEY ("selected_by") REFERENCES "guru" ("id")
);

CREATE TABLE "santri_juz_scores" (
  "id" TEXT NOT NULL,
  "santri_id" TEXT NOT NULL,
  "juz_number" INTEGER NOT NULL,
  "score" INTEGER NOT NULL,
  "assessed_by" TEXT,
  "assessed_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "santri_juz_scores_santri_juz_unique" UNIQUE ("santri_id", "juz_number"),
  CONSTRAINT "santri_juz_scores_number_range" CHECK ((("juz_number" >= 1) AND ("juz_number" <= 30))),
  CONSTRAINT "santri_juz_scores_score_range" CHECK ((("score" >= 1) AND ("score" <= 4))),
  CONSTRAINT "santri_juz_scores_assessed_by_fkey" FOREIGN KEY ("assessed_by") REFERENCES "guru" ("id"),
  CONSTRAINT "santri_juz_scores_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "santri_juz_scores_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri" ("id") ON DELETE CASCADE,
  CONSTRAINT "santri_juz_scores_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "santri_notes" (
  "id" TEXT NOT NULL,
  "santri_id" TEXT NOT NULL,
  "guru_id" TEXT,
  "note" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'internal',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "santri_notes_note_not_blank" CHECK ((length(trim("note")) > 0)),
  CONSTRAINT "santri_notes_visibility_check" CHECK (("visibility" IN ('internal', 'admin_only'))),
  CONSTRAINT "santri_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "santri_notes_guru_id_fkey" FOREIGN KEY ("guru_id") REFERENCES "guru" ("id"),
  CONSTRAINT "santri_notes_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri" ("id") ON DELETE CASCADE,
  CONSTRAINT "santri_notes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "santri_surah_scores" (
  "id" TEXT NOT NULL,
  "santri_id" TEXT NOT NULL,
  "juz_number" INTEGER NOT NULL,
  "surah_name" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "assessed_by" TEXT,
  "assessed_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "santri_surah_scores_santri_juz_surah_unique" UNIQUE ("santri_id", "juz_number", "surah_name"),
  CONSTRAINT "santri_surah_scores_number_range" CHECK ((("juz_number" >= 1) AND ("juz_number" <= 30))),
  CONSTRAINT "santri_surah_scores_score_range" CHECK ((("score" >= 1) AND ("score" <= 4))),
  CONSTRAINT "santri_surah_scores_assessed_by_fkey" FOREIGN KEY ("assessed_by") REFERENCES "guru" ("id"),
  CONSTRAINT "santri_surah_scores_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "santri_surah_scores_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri" ("id") ON DELETE CASCADE,
  CONSTRAINT "santri_surah_scores_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "user_profiles" (
  "id" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('admin', 'guru', 'santri', 'pentashih')),
  "display_name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'inactive', 'suspended')),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "user_profiles_display_name_not_blank" CHECK ((("display_name" IS NULL) OR (length(trim("display_name")) > 0))),
  CONSTRAINT "user_profiles_email_not_blank" CHECK ((("email" IS NULL) OR (length(trim("email")) > 0))),
  CONSTRAINT "user_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "user_profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

CREATE TABLE "website_content" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "content" TEXT NOT NULL DEFAULT '{}',
  "is_public" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  "updated_by" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "website_content_key_key" UNIQUE ("key"),
  CONSTRAINT "website_content_key_not_blank" CHECK ((length(trim("key")) > 0)),
  CONSTRAINT "website_content_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "website_content_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
);

-- Trigger updated_at

CREATE TRIGGER "set_academic_calendar_updated_at" AFTER UPDATE ON "academic_calendar"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "academic_calendar" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_announcements_updated_at" AFTER UPDATE ON "announcements"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "announcements" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_attendance_updated_at" AFTER UPDATE ON "attendance"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "attendance" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_auth_login_aliases_updated_at" AFTER UPDATE ON "auth_login_aliases"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "auth_login_aliases" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_auth_rate_limits_updated_at" AFTER UPDATE ON "auth_rate_limits"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "auth_rate_limits" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_character_assessment_items_updated_at" AFTER UPDATE ON "character_assessment_items"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "character_assessment_items" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_character_strength_items_updated_at" AFTER UPDATE ON "character_strength_items"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "character_strength_items" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_class_memberships_updated_at" AFTER UPDATE ON "class_memberships"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "class_memberships" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_classes_updated_at" AFTER UPDATE ON "classes"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "classes" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_expenses_updated_at" AFTER UPDATE ON "expenses"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "expenses" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_guru_updated_at" AFTER UPDATE ON "guru"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "guru" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_hafalan_items_updated_at" AFTER UPDATE ON "hafalan_items"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "hafalan_items" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_hafalan_progress_updated_at" AFTER UPDATE ON "hafalan_progress"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "hafalan_progress" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_mmq_attendance_updated_at" AFTER UPDATE ON "mmq_attendance"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "mmq_attendance" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_mmq_notulensi_updated_at" AFTER UPDATE ON "mmq_notulensi"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "mmq_notulensi" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_mmq_schedule_updated_at" AFTER UPDATE ON "mmq_schedule"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "mmq_schedule" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_murojaah_submissions_updated_at" AFTER UPDATE ON "murojaah_submissions"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "murojaah_submissions" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_news_updated_at" AFTER UPDATE ON "news"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "news" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_payments_updated_at" AFTER UPDATE ON "payments"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "payments" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_pentashih_class_assignments_updated_at" AFTER UPDATE ON "pentashih_class_assignments"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "pentashih_class_assignments" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_santri_updated_at" AFTER UPDATE ON "santri"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "santri" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_santri_behavior_records_updated_at" AFTER UPDATE ON "santri_behavior_records"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "santri_behavior_records" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_santri_character_scores_updated_at" AFTER UPDATE ON "santri_character_scores"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "santri_character_scores" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_santri_notes_updated_at" AFTER UPDATE ON "santri_notes"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "santri_notes" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_user_profiles_updated_at" AFTER UPDATE ON "user_profiles"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "user_profiles" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

CREATE TRIGGER "set_website_content_updated_at" AFTER UPDATE ON "website_content"
FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
BEGIN
  UPDATE "website_content" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = NEW."id";
END;

-- Status hafalan mengikuti nilai

CREATE TRIGGER "sync_hafalan_status_on_insert" AFTER INSERT ON "hafalan_progress"
FOR EACH ROW WHEN NEW."status" IS NOT CASE WHEN NEW."score" = 4 THEN 'lulus' ELSE 'proses' END
BEGIN
  UPDATE "hafalan_progress" SET "status" = CASE WHEN NEW."score" = 4 THEN 'lulus' ELSE 'proses' END WHERE "id" = NEW."id";
END;

CREATE TRIGGER "sync_hafalan_status_on_update" AFTER UPDATE OF "score", "status" ON "hafalan_progress"
FOR EACH ROW WHEN NEW."status" IS NOT CASE WHEN NEW."score" = 4 THEN 'lulus' ELSE 'proses' END
BEGIN
  UPDATE "hafalan_progress" SET "status" = CASE WHEN NEW."score" = 4 THEN 'lulus' ELSE 'proses' END WHERE "id" = NEW."id";
END;

-- Index

CREATE INDEX "academic_calendar_event_type_idx" ON "academic_calendar" ("event_type");
CREATE INDEX "academic_calendar_public_idx" ON "academic_calendar" ("is_public");
CREATE INDEX "announcements_published_at_idx" ON "announcements" ("published_at");
CREATE INDEX "announcements_published_status_idx" ON "announcements" ("status", "published_at");
CREATE INDEX "announcements_status_idx" ON "announcements" ("status");
CREATE INDEX "attendance_attended_session_idx" ON "attendance" ("attended_session") WHERE "role" = 'santri';
CREATE INDEX "attendance_class_date_idx" ON "attendance" ("class_id", "attendance_date");
CREATE INDEX "attendance_class_id_idx" ON "attendance" ("class_id");
CREATE INDEX "attendance_date_idx" ON "attendance" ("attendance_date");
CREATE INDEX "attendance_role_date_idx" ON "attendance" ("role", "attendance_date");
CREATE UNIQUE INDEX "attendance_user_date_sesi_unique" ON "attendance" ("user_id", "attendance_date", COALESCE("sesi", '')) WHERE "source" <> 'import';
CREATE INDEX "attendance_user_id_idx" ON "attendance" ("user_id");
CREATE INDEX "auth_login_aliases_active_idx" ON "auth_login_aliases" ("is_active");
CREATE UNIQUE INDEX "auth_login_aliases_active_user_unique" ON "auth_login_aliases" ("auth_user_id") WHERE "is_active";
CREATE UNIQUE INDEX "auth_login_aliases_type_normalized_unique" ON "auth_login_aliases" ("alias_type", "normalized_alias");
CREATE INDEX "auth_rate_limits_blocked_until_idx" ON "auth_rate_limits" ("blocked_until");
CREATE UNIQUE INDEX "auth_rate_limits_purpose_ip_alias_unique" ON "auth_rate_limits" ("purpose", "ip_hash", "alias_hash");
CREATE INDEX "class_memberships_class_id_idx" ON "class_memberships" ("class_id");
CREATE INDEX "class_memberships_class_status_idx" ON "class_memberships" ("class_id", "status");
CREATE UNIQUE INDEX "class_memberships_one_active_per_santri" ON "class_memberships" ("santri_id") WHERE "status" = 'active';
CREATE INDEX "class_memberships_santri_id_idx" ON "class_memberships" ("santri_id");
CREATE INDEX "classes_active_idx" ON "classes" ("is_active");
CREATE INDEX "classes_id_guru_idx" ON "classes" ("id_guru");
CREATE INDEX "expenses_kategori_idx" ON "expenses" ("kategori");
CREATE INDEX "expenses_tanggal_idx" ON "expenses" ("tanggal_pengeluaran");
CREATE INDEX "feedbacks_status_idx" ON "feedbacks" ("status");
CREATE UNIQUE INDEX "guru_email_unique" ON "guru" (lower("email")) WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX "guru_rfid_tag_unique" ON "guru" ("rfid_tag") WHERE "rfid_tag" IS NOT NULL;
-- DILEWATI: "guru_roles_gin_idx" pada "guru" memakai gin.
CREATE INDEX "guru_status_idx" ON "guru" ("status");
CREATE INDEX "hafalan_items_category_jilid_idx" ON "hafalan_items" ("category", "jilid");
CREATE INDEX "hafalan_items_order_idx" ON "hafalan_items" ("item_order");
CREATE INDEX "hafalan_items_program_scope_category_idx" ON "hafalan_items" ("program_scope", "category", "jilid", "item_order") WHERE "is_active";
CREATE INDEX "hafalan_progress_assessed_by_idx" ON "hafalan_progress" ("assessed_by");
CREATE INDEX "hafalan_progress_santri_idx" ON "hafalan_progress" ("santri_id");
CREATE UNIQUE INDEX "hafalan_progress_santri_item_unique" ON "hafalan_progress" ("santri_id", "item_id") WHERE "item_id" IS NOT NULL;
CREATE INDEX "hafalan_progress_santri_status_idx" ON "hafalan_progress" ("santri_id", "status");
CREATE INDEX "jilid_history_changed_at_idx" ON "jilid_history" ("changed_at" DESC);
CREATE INDEX "jilid_history_santri_changed_at_idx" ON "jilid_history" ("santri_id", "changed_at" DESC);
CREATE INDEX "login_logs_created_at_idx" ON "login_logs" ("created_at" DESC);
CREATE INDEX "login_logs_status_idx" ON "login_logs" ("status");
CREATE UNIQUE INDEX "media_player_settings_user_unique" ON "media_player_settings" ("user_id");
CREATE INDEX "mmq_attendance_date_idx" ON "mmq_attendance" ("attendance_date");
CREATE INDEX "mmq_attendance_guru_idx" ON "mmq_attendance" ("guru_id");
CREATE UNIQUE INDEX "mmq_attendance_schedule_guru_date_unique" ON "mmq_attendance" ("schedule_id", "guru_id", "attendance_date");
CREATE INDEX "mmq_notulensi_schedule_idx" ON "mmq_notulensi" ("schedule_id");
CREATE INDEX "mmq_notulensi_tanggal_idx" ON "mmq_notulensi" ("tanggal");
CREATE INDEX "mmq_schedule_active_idx" ON "mmq_schedule" ("is_active");
CREATE INDEX "murojaah_submissions_santri_idx" ON "murojaah_submissions" ("santri_id");
CREATE INDEX "murojaah_submissions_santri_status_idx" ON "murojaah_submissions" ("santri_id", "status");
CREATE INDEX "murojaah_submissions_status_idx" ON "murojaah_submissions" ("status");
CREATE INDEX "murojaah_submissions_target_guru_idx" ON "murojaah_submissions" ("target_guru_id");
CREATE INDEX "news_published_at_idx" ON "news" ("published_at");
CREATE INDEX "news_published_status_idx" ON "news" ("status", "published_at");
CREATE INDEX "news_status_idx" ON "news" ("status");
CREATE INDEX "notifications_read_idx" ON "notifications" ("recipient_id", "is_read");
CREATE INDEX "notifications_recipient_idx" ON "notifications" ("recipient_id");
CREATE UNIQUE INDEX "payments_active_santri_bulan_tahun_unique" ON "payments" ("santri_id", "bulan", "tahun") WHERE ("deleted_at" IS NULL) AND ("bulan" IS NOT NULL) AND ("tahun" IS NOT NULL);
CREATE INDEX "payments_santri_id_idx" ON "payments" ("santri_id");
CREATE INDEX "payments_santri_month_year_idx" ON "payments" ("santri_id", "tahun", "bulan");
CREATE INDEX "payments_tanggal_idx" ON "payments" ("tanggal_pembayaran");
CREATE UNIQUE INDEX "payments_transaction_id_unique" ON "payments" ("transaction_id") WHERE "transaction_id" IS NOT NULL;
CREATE INDEX "payments_year_month_idx" ON "payments" ("tahun", "bulan");
CREATE UNIQUE INDEX "pentashih_assignments_active_scope_unique" ON "pentashih_class_assignments" ("pentashih_id", COALESCE("class_id", '00000000-0000-0000-0000-000000000000'), COALESCE("mmq_schedule_id", '00000000-0000-0000-0000-000000000000'), "scope") WHERE "is_active";
CREATE INDEX "pentashih_assignments_mmq_schedule_idx" ON "pentashih_class_assignments" ("mmq_schedule_id");
CREATE UNIQUE INDEX "pentashih_class_assignments_active_unique" ON "pentashih_class_assignments" ("pentashih_id", "class_id") WHERE "is_active";
CREATE INDEX "pentashih_class_assignments_class_idx" ON "pentashih_class_assignments" ("class_id");
CREATE INDEX "pentashih_class_assignments_pentashih_idx" ON "pentashih_class_assignments" ("pentashih_id");
CREATE INDEX "santri_archive_status_idx" ON "santri" ("deleted_at", "status", "kategori");
CREATE INDEX "santri_current_class_id_idx" ON "santri" ("current_class_id");
CREATE INDEX "santri_kategori_idx" ON "santri" ("kategori");
CREATE UNIQUE INDEX "santri_nomor_induk_qiroati_unique" ON "santri" ("nomor_induk_qiroati");
CREATE UNIQUE INDEX "santri_rfid_tag_unique" ON "santri" ("rfid_tag") WHERE "rfid_tag" IS NOT NULL;
CREATE INDEX "santri_status_idx" ON "santri" ("status");
CREATE INDEX "santri_tanggal_pendaftaran_idx" ON "santri" ("tanggal_pendaftaran");
CREATE INDEX "santri_behavior_records_santri_date_idx" ON "santri_behavior_records" ("santri_id", "incident_date" DESC);
CREATE INDEX "santri_character_scores_santri_idx" ON "santri_character_scores" ("santri_id");
CREATE INDEX "santri_juz_scores_santri_idx" ON "santri_juz_scores" ("santri_id");
CREATE INDEX "santri_notes_guru_idx" ON "santri_notes" ("guru_id");
CREATE INDEX "santri_notes_santri_idx" ON "santri_notes" ("santri_id");
CREATE INDEX "santri_surah_scores_santri_idx" ON "santri_surah_scores" ("santri_id");
CREATE UNIQUE INDEX "user_profiles_email_unique" ON "user_profiles" (lower("email")) WHERE "email" IS NOT NULL;
CREATE INDEX "user_profiles_role_idx" ON "user_profiles" ("role");
CREATE INDEX "user_profiles_status_idx" ON "user_profiles" ("status");
CREATE INDEX "website_content_public_idx" ON "website_content" ("is_public");
