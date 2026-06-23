-- Database Schema Export for LPQ Al Fath Maulana
-- Generated on: 2025-12-03
-- This script is designed to recreate the database structure on a new Supabase project.

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 2. FUNCTIONS
-- =============================================================================

-- Function: get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT raw_user_meta_data->>'role'
  FROM auth.users
  WHERE id = user_id;
$function$;

-- Function: increment_santri_points
CREATE OR REPLACE FUNCTION public.increment_santri_points(p_santri_id uuid, p_amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.santri
  SET points = COALESCE(points, 0) + p_amount
  WHERE id = p_santri_id;
END;
$function$;

-- Function: get_absentee_notifications
CREATE OR REPLACE FUNCTION public.get_absentee_notifications(p_guru_id uuid)
 RETURNS TABLE(santri_id uuid, nama_lengkap text, no_hp_ortu text, consecutive_absent_days bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    class_ids uuid[];
    santri_record record;
    last_5_weekdays date[];
    attended_dates date[];
    consecutive_absences integer;
    check_date date;
    i integer;
BEGIN
    -- Get classes taught by the guru
    SELECT array_agg(c.id) INTO class_ids FROM public.classes c WHERE c.id_guru = p_guru_id;

    IF class_ids IS NULL OR array_length(class_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    -- Determine the last 5 weekdays (Mon-Fri) excluding today
    last_5_weekdays := ARRAY[]::date[];
    check_date := CURRENT_DATE - interval '1 day';
    WHILE array_length(last_5_weekdays, 1) < 5 LOOP
        IF extract(isodow from check_date) BETWEEN 1 AND 5 THEN
            last_5_weekdays := array_append(last_5_weekdays, check_date);
        END IF;
        check_date := check_date - interval '1 day';
    END LOOP;

    IF array_length(last_5_weekdays, 1) IS NULL THEN
        RETURN;
    END IF;

    -- Loop through each santri in the guru's classes
    FOR santri_record IN
        SELECT s.id, s.nama_lengkap, s.no_hp_ortu FROM public.santri s
        WHERE s.id_kelas = ANY(class_ids) AND s.status = 'Aktif'
    LOOP
        -- Get the santri's attendance on those last 5 weekdays
        SELECT array_agg(a.attendance_date) INTO attended_dates
        FROM public.attendance a
        WHERE a.user_id = santri_record.id AND a.attendance_date = ANY(last_5_weekdays);

        IF attended_dates IS NULL THEN
            attended_dates := ARRAY[]::date[];
        END IF;

        -- Calculate consecutive absences from yesterday backwards
        consecutive_absences := 0;
        FOR i IN 1..array_length(last_5_weekdays, 1) LOOP
            IF NOT (last_5_weekdays[i] = ANY(attended_dates)) THEN
                consecutive_absences := consecutive_absences + 1;
            ELSE
                -- Streak is broken
                EXIT;
            END IF;
        END LOOP;

        IF consecutive_absences > 2 THEN
            get_absentee_notifications.santri_id := santri_record.id;
            get_absentee_notifications.nama_lengkap := santri_record.nama_lengkap;
            get_absentee_notifications.no_hp_ortu := santri_record.no_hp_ortu;
            get_absentee_notifications.consecutive_absent_days := consecutive_absences;
            RETURN NEXT;
        END IF;
    END LOOP;

    RETURN;
END;
$function$;

-- Function: signin_with_username
CREATE OR REPLACE FUNCTION public.signin_with_username(p_username text, p_password text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    user_record RECORD;
    user_id_found uuid;
    role_found text;
    encrypted_pw text;
    user_data json;
    tokens json;
BEGIN
    -- Check in 'guru' table by email
    SELECT id, password, 'guru' as role INTO user_id_found, encrypted_pw, role_found FROM guru WHERE lower(email) = lower(p_username);

    -- If not found, check in 'santri' table by nama_panggilan
    IF user_id_found IS NULL THEN
        SELECT id, password, 'santri' as role INTO user_id_found, encrypted_pw, role_found FROM santri WHERE lower(nama_panggilan) = lower(p_username);
    END IF;

    -- If still not found, check in 'santri' table by email
    IF user_id_found IS NULL THEN
        SELECT id, password, 'santri' as role INTO user_id_found, encrypted_pw, role_found FROM santri WHERE lower(email) = lower(p_username);
    END IF;

    -- If still not found, check admin user in auth.users
    IF user_id_found IS NULL AND (lower(p_username) = 'admin' OR lower(p_username) = 'admin@lpqalfathmaulana.id') THEN
        SELECT id, encrypted_password, 'admin' as role INTO user_id_found, encrypted_pw, role_found FROM auth.users WHERE lower(email) = 'admin@lpqalfathmaulana.id';
    END IF;
    
    -- If user is found, check password
    IF user_id_found IS NOT NULL THEN
        IF crypt(p_password, encrypted_pw) = encrypted_pw THEN
            -- Password is correct, get user data from auth.users
            SELECT json_strip_nulls(json_build_object(
                'id', u.id,
                'aud', u.aud,
                'role', u.role,
                'email', u.email,
                'created_at', u.created_at,
                'updated_at', u.updated_at,
                'last_sign_in_at', u.last_sign_in_at,
                'app_metadata', u.raw_app_meta_data,
                'user_metadata', u.raw_user_meta_data
            )) INTO user_data
            FROM auth.users u WHERE u.id = user_id_found;

            -- Create JWT tokens
            SELECT json_build_object(
                'access_token', sign(user_data, current_setting('app.jwt_secret')),
                'refresh_token', gen_random_uuid()
            ) INTO tokens;

            RETURN json_build_object(
                'user', user_data,
                'access_token', tokens->>'access_token',
                'refresh_token', tokens->>'refresh_token'
            );
        END IF;
    END IF;

    -- If user not found or password incorrect, return null
    RETURN NULL;
END;
$function$;

-- =============================================================================
-- 3. TABLES (DDL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.website_content (
    id integer NOT NULL GENERATED BY DEFAULT AS IDENTITY,
    key text NOT NULL,
    content jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT website_content_pkey PRIMARY KEY (id),
    CONSTRAINT website_content_key_key UNIQUE (key)
);

CREATE TABLE IF NOT EXISTS public.guru (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id),
    nama text NOT NULL,
    jabatan text,
    foto_url text,
    email text,
    no_hp text,
    alamat text,
    rfid_tag text,
    is_notulen boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    password text,
    kelas_diampu uuid[],
    roles text[],
    jenis_kelamin text
);

CREATE TABLE IF NOT EXISTS public.classes (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama_kelas text NOT NULL,
    id_guru uuid REFERENCES public.guru(id),
    sesi text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    notes text,
    "order" integer
);

CREATE TABLE IF NOT EXISTS public.santri (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama_lengkap text NOT NULL,
    nama_panggilan text,
    nomor_induk_qiroati text,
    foto_url text,
    tempat_lahir text,
    tanggal_lahir date,
    jenis_kelamin text,
    alamat text,
    nama_ayah text,
    nama_ibu text,
    no_hp_ortu text,
    tanggal_pendaftaran date,
    status text DEFAULT 'Aktif',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email text,
    password text,
    sesi_mengaji text,
    rfid_tag text,
    jilid text,
    no_kk text,
    no_nik text,
    berkas_foto boolean DEFAULT false,
    berkas_akta boolean DEFAULT false,
    berkas_kk boolean DEFAULT false,
    berkas_form boolean DEFAULT false,
    link_qiroati text,
    id_kelas uuid REFERENCES public.classes(id),
    notes text,
    order_in_class integer,
    points integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.mmq_notulensi (
    id integer NOT NULL GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    notulen_id uuid REFERENCES public.guru(id),
    tanggal date NOT NULL,
    judul text NOT NULL,
    isi text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    santri_id uuid REFERENCES public.santri(id),
    bulan text,
    tahun integer,
    jumlah integer NOT NULL,
    tanggal_pembayaran timestamp with time zone DEFAULT now(),
    catatan text,
    metode_pembayaran text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    transaction_id uuid DEFAULT uuid_generate_v4()
);

CREATE TABLE IF NOT EXISTS public.feedbacks (
    id integer NOT NULL GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nama text,
    email text,
    no_hp text,
    pesan text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id integer NOT NULL GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mmq_absensi (
    id integer NOT NULL GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    guru_id uuid REFERENCES public.guru(id),
    tanggal_absensi date NOT NULL,
    status text NOT NULL,
    dikirim_oleh uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.news (
    id integer NOT NULL GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    image_url text,
    author_id uuid REFERENCES public.guru(id),
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_topics (
    id integer NOT NULL GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    author_id uuid NOT NULL,
    author_name text,
    author_role text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_replies (
    id integer NOT NULL GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    topic_id integer REFERENCES public.forum_topics(id) ON DELETE CASCADE,
    content text NOT NULL,
    author_id uuid NOT NULL,
    author_name text,
    author_role text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hafalan_items (
    id integer NOT NULL GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    category text NOT NULL,
    item_name text NOT NULL,
    item_order integer
);

CREATE TABLE IF NOT EXISTS public.hafalan_progress (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    santri_id uuid NOT NULL REFERENCES public.santri(id),
    item_name text NOT NULL,
    category text NOT NULL,
    hafal boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.murojaah_submissions (
    id integer NOT NULL GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    santri_id uuid REFERENCES public.santri(id),
    category text NOT NULL,
    item_name text NOT NULL,
    recording_url text NOT NULL,
    status text DEFAULT 'pending',
    feedback text,
    created_at timestamp with time zone DEFAULT now(),
    target_guru_id uuid REFERENCES public.guru(id),
    session_id uuid
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    tanggal_pengeluaran date NOT NULL,
    kategori text NOT NULL,
    nama_pengeluaran text NOT NULL,
    jumlah numeric NOT NULL,
    catatan text,
    bukti_url text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_mutations (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    santri_id uuid NOT NULL REFERENCES public.santri(id),
    from_class_id uuid REFERENCES public.classes(id),
    to_class_id uuid REFERENCES public.classes(id),
    mutation_date timestamp with time zone NOT NULL DEFAULT now(),
    mutated_by uuid,
    from_jilid text,
    to_jilid text
);

CREATE TABLE IF NOT EXISTS public.jilid_history (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    santri_id uuid NOT NULL REFERENCES public.santri(id),
    from_jilid text,
    to_jilid text NOT NULL,
    changed_at timestamp with time zone NOT NULL DEFAULT now(),
    changed_by uuid
);

CREATE TABLE IF NOT EXISTS public.attendance (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL,
    role text NOT NULL,
    attendance_date date NOT NULL,
    check_in_time time without time zone NOT NULL,
    class_id uuid REFERENCES public.classes(id),
    sesi text,
    status text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.login_logs (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid,
    role text,
    username_attempt text,
    status text NOT NULL,
    ip_address text,
    city text,
    country text,
    device text,
    user_agent text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.visitor_stats (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    ip_address text,
    city text,
    country text,
    device text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.santri_notes (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    santri_id uuid NOT NULL REFERENCES public.santri(id),
    guru_id uuid NOT NULL REFERENCES public.guru(id),
    note text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    recipient_id uuid REFERENCES public.guru(id),
    sender_id uuid REFERENCES public.guru(id),
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    type text,
    related_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.website_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.santri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mmq_notulensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mmq_absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hafalan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hafalan_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.murojaah_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jilid_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.santri_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- Website Content Policies
DROP POLICY IF EXISTS "Public website content is viewable by everyone." ON public.website_content;
CREATE POLICY "Public website content is viewable by everyone." ON public.website_content FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert website content" ON public.website_content;
CREATE POLICY "Admins can insert website content" ON public.website_content FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

DROP POLICY IF EXISTS "Admins can update website content" ON public.website_content;
CREATE POLICY "Admins can update website content" ON public.website_content FOR UPDATE USING (true); -- Restricted by application logic checking role

-- Guru Policies
DROP POLICY IF EXISTS "Gurus are viewable by authenticated users." ON public.guru;
CREATE POLICY "Gurus are viewable by authenticated users." ON public.guru FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "Admins can manage gurus." ON public.guru;
CREATE POLICY "Admins can manage gurus." ON public.guru FOR ALL USING ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Admins can delete guru records" ON public.guru;
CREATE POLICY "Admins can delete guru records" ON public.guru FOR DELETE USING ((public.get_user_role(auth.uid()) = 'admin'::text));

DROP POLICY IF EXISTS "guru_admin_insert" ON public.guru;
CREATE POLICY "guru_admin_insert" ON public.guru FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

DROP POLICY IF EXISTS "guru_admin_update" ON public.guru;
CREATE POLICY "guru_admin_update" ON public.guru FOR UPDATE USING (((auth.jwt() ->> 'user_role'::text) = 'admin'::text));

-- Classes Policies
DROP POLICY IF EXISTS "Allow authenticated users to read classes" ON public.classes;
CREATE POLICY "Allow authenticated users to read classes" ON public.classes FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "Allow admin to manage classes" ON public.classes;
CREATE POLICY "Allow admin to manage classes" ON public.classes FOR ALL USING ((public.get_user_role(auth.uid()) = 'admin'::text));

-- Santri Policies
DROP POLICY IF EXISTS "Santri data is viewable by authenticated users." ON public.santri;
CREATE POLICY "Santri data is viewable by authenticated users." ON public.santri FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "Admins can manage santri." ON public.santri;
CREATE POLICY "Admins can manage santri." ON public.santri FOR ALL USING ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Admins can delete santri records" ON public.santri;
CREATE POLICY "Admins can delete santri records" ON public.santri FOR DELETE USING ((public.get_user_role(auth.uid()) = 'admin'::text));

DROP POLICY IF EXISTS "admin_can_upload_update_santri_foto" ON public.santri;
CREATE POLICY "admin_can_upload_update_santri_foto" ON public.santri FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

DROP POLICY IF EXISTS "admin_can_update_santri_foto" ON public.santri;
CREATE POLICY "admin_can_update_santri_foto" ON public.santri FOR UPDATE USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));

DROP POLICY IF EXISTS "Allow gurus to read santri notes" ON public.santri;
CREATE POLICY "Allow gurus to read santri notes" ON public.santri FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "Allow gurus to update santri notes" ON public.santri;
CREATE POLICY "Allow gurus to update santri notes" ON public.santri FOR UPDATE USING ((public.get_user_role(auth.uid()) = 'guru'::text));

-- Payments Policies
DROP POLICY IF EXISTS "Payment data is publicly viewable." ON public.payments;
CREATE POLICY "Payment data is publicly viewable." ON public.payments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage payments." ON public.payments;
CREATE POLICY "Admins can manage payments." ON public.payments FOR ALL USING ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Admins can delete payment records" ON public.payments;
CREATE POLICY "Admins can delete payment records" ON public.payments FOR DELETE USING ((public.get_user_role(auth.uid()) = 'admin'::text));

-- Expenses Policies
DROP POLICY IF EXISTS "Allow admin to manage expenses" ON public.expenses;
CREATE POLICY "Allow admin to manage expenses" ON public.expenses FOR ALL USING ((public.get_user_role(auth.uid()) = 'admin'::text));

-- MMQ Policies
DROP POLICY IF EXISTS "MMQ notes are viewable by authenticated users." ON public.mmq_notulensi;
CREATE POLICY "MMQ notes are viewable by authenticated users." ON public.mmq_notulensi FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "Notulens can create notes." ON public.mmq_notulensi;
CREATE POLICY "Notulens can create notes." ON public.mmq_notulensi FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

DROP POLICY IF EXISTS "Admins can manage notes." ON public.mmq_notulensi;
CREATE POLICY "Admins can manage notes." ON public.mmq_notulensi FOR ALL USING ((( SELECT (users.raw_user_meta_data ->> 'role'::text) FROM auth.users WHERE (users.id = auth.uid())) = 'admin'::text));

-- Forum Policies
DROP POLICY IF EXISTS "Public can read forum data" ON public.forum_topics;
CREATE POLICY "Public can read forum data" ON public.forum_topics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create topics" ON public.forum_topics;
CREATE POLICY "Authenticated users can create topics" ON public.forum_topics FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

DROP POLICY IF EXISTS "Authors can delete their own topics" ON public.forum_topics;
CREATE POLICY "Authors can delete their own topics" ON public.forum_topics FOR DELETE USING ((auth.uid() = author_id));

DROP POLICY IF EXISTS "Admins can delete any topic" ON public.forum_topics;
CREATE POLICY "Admins can delete any topic" ON public.forum_topics FOR DELETE USING ((public.get_user_role(auth.uid()) = 'admin'::text));

DROP POLICY IF EXISTS "Public can read forum replies" ON public.forum_replies;
CREATE POLICY "Public can read forum replies" ON public.forum_replies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create replies" ON public.forum_replies;
CREATE POLICY "Authenticated users can create replies" ON public.forum_replies FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

DROP POLICY IF EXISTS "Authors can delete their own replies" ON public.forum_replies;
CREATE POLICY "Authors can delete their own replies" ON public.forum_replies FOR DELETE USING ((auth.uid() = author_id));

DROP POLICY IF EXISTS "Admins can delete any reply" ON public.forum_replies;
CREATE POLICY "Admins can delete any reply" ON public.forum_replies FOR DELETE USING ((public.get_user_role(auth.uid()) = 'admin'::text));

-- Feedback Policies
DROP POLICY IF EXISTS "Admins can view feedback." ON public.feedbacks;
CREATE POLICY "Admins can view feedback." ON public.feedbacks FOR SELECT USING ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Public can send feedback." ON public.feedbacks;
CREATE POLICY "Public can send feedback." ON public.feedbacks FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

-- Announcements Policies
DROP POLICY IF EXISTS "Announcements are public." ON public.announcements;
CREATE POLICY "Announcements are public." ON public.announcements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage announcements." ON public.announcements;
CREATE POLICY "Admins can manage announcements." ON public.announcements FOR ALL USING ((auth.role() = 'service_role'::text));

-- MMQ Absensi Policies
DROP POLICY IF EXISTS "Admins can update attendance." ON public.mmq_absensi;
CREATE POLICY "Admins can update attendance." ON public.mmq_absensi FOR UPDATE USING ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Allow gurus to interact with their own MMQ attendance" ON public.mmq_absensi;
CREATE POLICY "Allow gurus to interact with their own MMQ attendance" ON public.mmq_absensi FOR ALL USING ((auth.uid() = guru_id));

DROP POLICY IF EXISTS "Allow admin to manage MMQ attendance" ON public.mmq_absensi;
CREATE POLICY "Allow admin to manage MMQ attendance" ON public.mmq_absensi FOR ALL USING ((( SELECT (users.raw_user_meta_data ->> 'role'::text) FROM auth.users WHERE (users.id = auth.uid())) = 'admin'::text));

DROP POLICY IF EXISTS "Admins and gurus can create attendance." ON public.mmq_absensi;
CREATE POLICY "Admins and gurus can create attendance." ON public.mmq_absensi FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

DROP POLICY IF EXISTS "MMQ attendance is viewable by authenticated users." ON public.mmq_absensi;
CREATE POLICY "MMQ attendance is viewable by authenticated users." ON public.mmq_absensi FOR SELECT USING ((auth.role() = 'authenticated'::text));

-- News Policies
DROP POLICY IF EXISTS "Admins can manage news." ON public.news;
CREATE POLICY "Admins can manage news." ON public.news FOR ALL USING ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "News is public." ON public.news;
CREATE POLICY "News is public." ON public.news FOR SELECT USING (true);

-- Murojaah Submissions Policies
DROP POLICY IF EXISTS "Santri can read their own submissions" ON public.murojaah_submissions;
CREATE POLICY "Santri can read their own submissions" ON public.murojaah_submissions FOR SELECT USING (((public.get_user_role(auth.uid()) = 'santri'::text) AND (santri_id = auth.uid())));

DROP POLICY IF EXISTS "Gurus can delete submissions" ON public.murojaah_submissions;
CREATE POLICY "Gurus can delete submissions" ON public.murojaah_submissions FOR DELETE USING ((public.get_user_role(auth.uid()) = 'guru'::text));

DROP POLICY IF EXISTS "Gurus can update submissions for feedback" ON public.murojaah_submissions;
CREATE POLICY "Gurus can update submissions for feedback" ON public.murojaah_submissions FOR UPDATE USING ((public.get_user_role(auth.uid()) = 'guru'::text));

DROP POLICY IF EXISTS "Santri can insert their own submissions" ON public.murojaah_submissions;
CREATE POLICY "Santri can insert their own submissions" ON public.murojaah_submissions FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

DROP POLICY IF EXISTS "Gurus can read all submissions" ON public.murojaah_submissions;
CREATE POLICY "Gurus can read all submissions" ON public.murojaah_submissions FOR SELECT USING ((public.get_user_role(auth.uid()) = 'guru'::text));

-- Hafalan Progress Policies
DROP POLICY IF EXISTS "Authenticated users can view hafalan progress." ON public.hafalan_progress;
CREATE POLICY "Authenticated users can view hafalan progress." ON public.hafalan_progress FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "Gurus can manage hafalan progress." ON public.hafalan_progress;
CREATE POLICY "Gurus can manage hafalan progress." ON public.hafalan_progress FOR ALL USING ((( SELECT (users.raw_user_meta_data ->> 'role'::text) FROM auth.users WHERE (users.id = auth.uid())) = 'guru'::text));

-- Class Mutations Policies
DROP POLICY IF EXISTS "Allow admin to manage class mutations" ON public.class_mutations;
CREATE POLICY "Allow admin to manage class mutations" ON public.class_mutations FOR ALL USING ((public.get_user_role(auth.uid()) = 'admin'::text));

DROP POLICY IF EXISTS "Allow authenticated users to read mutations" ON public.class_mutations;
CREATE POLICY "Allow authenticated users to read mutations" ON public.class_mutations FOR SELECT USING ((auth.role() = 'authenticated'::text));

-- Jilid History Policies
DROP POLICY IF EXISTS "Allow admin and relevant gurus to read jilid history" ON public.jilid_history;
CREATE POLICY "Allow admin and relevant gurus to read jilid history" ON public.jilid_history FOR SELECT USING (((public.get_user_role(auth.uid()) = 'admin'::text) OR ((public.get_user_role(auth.uid()) = 'guru'::text) AND (EXISTS ( SELECT 1 FROM (public.classes c JOIN public.santri s ON ((s.id_kelas = c.id))) WHERE ((c.id_guru = auth.uid()) AND (s.id = public.jilid_history.santri_id)))))));

DROP POLICY IF EXISTS "Allow gurus to insert jilid history for their santri" ON public.jilid_history;
CREATE POLICY "Allow gurus to insert jilid history for their santri" ON public.jilid_history FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

DROP POLICY IF EXISTS "Allow admin to manage jilid history" ON public.jilid_history;
CREATE POLICY "Allow admin to manage jilid history" ON public.jilid_history FOR ALL USING ((public.get_user_role(auth.uid()) = 'admin'::text));

-- Attendance Policies
DROP POLICY IF EXISTS "Allow admin to manage attendance" ON public.attendance;
CREATE POLICY "Allow admin to manage attendance" ON public.attendance FOR ALL USING ((public.get_user_role(auth.uid()) = 'admin'::text));

DROP POLICY IF EXISTS "Allow authenticated users to read their own attendance" ON public.attendance;
CREATE POLICY "Allow authenticated users to read their own attendance" ON public.attendance FOR SELECT USING ((((public.get_user_role(auth.uid()) = 'santri'::text) AND (auth.uid() = user_id)) OR ((public.get_user_role(auth.uid()) = 'guru'::text) AND (EXISTS ( SELECT 1 FROM (public.classes c JOIN public.santri s ON ((s.id_kelas = c.id))) WHERE ((c.id_guru = auth.uid()) AND (s.id = public.attendance.user_id)))))));

-- Login Logs Policies
DROP POLICY IF EXISTS "Allow admin to delete login logs" ON public.login_logs;
CREATE POLICY "Allow admin to delete login logs" ON public.login_logs FOR DELETE USING ((public.get_user_role(auth.uid()) = 'admin'::text));

DROP POLICY IF EXISTS "Allow admin to read non-admin login logs" ON public.login_logs;
CREATE POLICY "Allow admin to read non-admin login logs" ON public.login_logs FOR SELECT USING (((public.get_user_role(auth.uid()) = 'admin'::text) AND (role <> 'admin'::text)));

DROP POLICY IF EXISTS "Enable insert for service_role" ON public.login_logs;
CREATE POLICY "Enable insert for service_role" ON public.login_logs FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

-- Visitor Stats Policies
DROP POLICY IF EXISTS "Enable insert for service_role" ON public.visitor_stats;
CREATE POLICY "Enable insert for service_role" ON public.visitor_stats FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

DROP POLICY IF EXISTS "Allow admin to read visitor stats" ON public.visitor_stats;
CREATE POLICY "Allow admin to read visitor stats" ON public.visitor_stats FOR SELECT USING ((public.get_user_role(auth.uid()) = 'admin'::text));

-- Santri Notes Policies
DROP POLICY IF EXISTS "Allow authenticated to read santri notes" ON public.santri_notes;
CREATE POLICY "Allow authenticated to read santri notes" ON public.santri_notes FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "Allow admin to manage all notes" ON public.santri_notes;
CREATE POLICY "Allow admin to manage all notes" ON public.santri_notes FOR ALL USING ((public.get_user_role(auth.uid()) = 'admin'::text));

DROP POLICY IF EXISTS "Gurus can view all notes for any santri" ON public.santri_notes;
CREATE POLICY "Gurus can view all notes for any santri" ON public.santri_notes FOR SELECT USING ((public.get_user_role(auth.uid()) = 'guru'::text));

DROP POLICY IF EXISTS "Gurus can only manage their own notes" ON public.santri_notes;
CREATE POLICY "Gurus can only manage their own notes" ON public.santri_notes FOR ALL USING ((guru_id = auth.uid()));

-- Notifications Policies
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = recipient_id));

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = recipient_id));

-- =============================================================================
-- 5. STORAGE BUCKETS (Insert via SQL if creating from scratch)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES 
('avatars', 'avatars', false),
('website-assets', 'website-assets', true),
('murojaah-recordings', 'murojaah-recordings', false)
ON CONFLICT DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Admin full access to avatars" ON storage.objects;
CREATE POLICY "Admin full access to avatars" ON storage.objects FOR ALL USING (((bucket_id = 'avatars'::text) AND (public.get_user_role(auth.uid()) = 'admin'::text)));

DROP POLICY IF EXISTS "Authenticated users can read avatars" ON storage.objects;
CREATE POLICY "Authenticated users can read avatars" ON storage.objects FOR SELECT USING (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text)));

DROP POLICY IF EXISTS "Public Read Access on Website Assets" ON storage.objects;
CREATE POLICY "Public Read Access on Website Assets" ON storage.objects FOR SELECT USING ((bucket_id = 'website-assets'::text));

DROP POLICY IF EXISTS "Allow admin full access to website assets" ON storage.objects;
CREATE POLICY "Allow admin full access to website assets" ON storage.objects FOR ALL USING (((bucket_id = 'website-assets'::text) AND (public.get_user_role(auth.uid()) = 'admin'::text)));

DROP POLICY IF EXISTS "Santri can insert their own murojaah recordings" ON storage.objects;
CREATE POLICY "Santri can insert their own murojaah recordings" ON storage.objects FOR INSERT WITH CHECK (true); -- INSERT policies must use WITH CHECK

DROP POLICY IF EXISTS "Gurus can view all murojaah recordings" ON storage.objects;
CREATE POLICY "Gurus can view all murojaah recordings" ON storage.objects FOR SELECT USING (((bucket_id = 'murojaah-recordings'::text) AND (public.get_user_role(auth.uid()) = 'guru'::text)));

DROP POLICY IF EXISTS "Gurus can delete all murojaah recordings" ON storage.objects;
CREATE POLICY "Gurus can delete all murojaah recordings" ON storage.objects FOR DELETE USING (((bucket_id = 'murojaah-recordings'::text) AND (public.get_user_role(auth.uid()) = 'guru'::text)));

-- =============================================================================
-- 6. REALTIME
-- =============================================================================
-- Enable realtime for specific tables if needed
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_topics;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_replies;