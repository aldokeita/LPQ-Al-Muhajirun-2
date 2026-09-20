-- Trigger untuk database D1 yang skemanya sudah terlanjur diterapkan tanpa trigger.
-- Isinya sama persis dengan bagian trigger di 0001_initial_schema.sql, dipisah agar
-- bisa diterapkan ke database yang tabelnya sudah ada.
--
-- Database baru cukup memakai 0001 saja; berkas ini hanya untuk menyusulkan.

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

