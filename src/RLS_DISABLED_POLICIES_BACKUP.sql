-- BACKUP OF RLS POLICIES
-- RLS has been temporarily disabled for application stability.
-- Restore these policies when re-enabling RLS.

-- Table: website_content
-- CREATE POLICY "Public website content is viewable by everyone." ON website_content FOR SELECT USING (true);
-- CREATE POLICY "Admins can update website content" ON website_content FOR UPDATE USING (true);
-- CREATE POLICY "Admins can insert website content" ON website_content FOR INSERT USING (true);

-- Table: guru
-- CREATE POLICY "Admin insert guru" ON guru FOR INSERT USING (true);
-- CREATE POLICY "Guru update own record" ON guru FOR UPDATE USING (((auth.uid() = id) OR (get_user_role(auth.uid()) = 'admin'::text)));
-- CREATE POLICY "Admin delete guru" ON guru FOR DELETE USING ((get_user_role(auth.uid()) = 'admin'::text));
-- CREATE POLICY "Guru view own record" ON guru FOR SELECT USING (((auth.uid() = id) OR (get_user_role(auth.uid()) = 'admin'::text) OR (get_user_role(auth.uid()) = 'santri'::text)));
-- CREATE POLICY "guru_admin_update" ON guru FOR UPDATE USING (((auth.jwt() ->> 'user_role'::text) = 'admin'::text));
-- CREATE POLICY "guru_admin_insert" ON guru FOR INSERT USING (true);
-- CREATE POLICY "Admins can delete guru records" ON guru FOR DELETE USING ((get_user_role(auth.uid()) = 'admin'::text));
-- CREATE POLICY "Admins can manage gurus." ON guru FOR ALL USING ((auth.role() = 'service_role'::text));
-- CREATE POLICY "Gurus are viewable by authenticated users." ON guru FOR SELECT USING ((auth.role() = 'authenticated'::text));

-- Table: payments
-- CREATE POLICY "view_payments_policy" ON payments FOR SELECT USING (((get_user_role(auth.uid()) = 'admin'::text) OR (santri_id = auth.uid()) OR ((get_user_role(auth.uid()) = 'guru'::text) AND (EXISTS ( SELECT 1 FROM (classes c JOIN santri s ON ((s.id_kelas = c.id))) WHERE ((c.id_guru = auth.uid()) AND (s.id = payments.santri_id)))))));
-- CREATE POLICY "delete_payments_policy" ON payments FOR DELETE USING ((get_user_role(auth.uid()) = 'admin'::text));
-- CREATE POLICY "update_payments_policy" ON payments FOR UPDATE USING ((get_user_role(auth.uid()) = 'admin'::text));
-- CREATE POLICY "insert_payments_policy" ON payments FOR INSERT USING (true);

-- Table: santri
-- CREATE POLICY "Admins can manage santri." ON santri FOR ALL USING ((auth.role() = 'service_role'::text));
-- CREATE POLICY "Santri data is viewable by authenticated users." ON santri FOR SELECT USING ((auth.role() = 'authenticated'::text));
-- CREATE POLICY "Admin delete santri" ON santri FOR DELETE USING ((get_user_role(auth.uid()) = 'admin'::text));
-- CREATE POLICY "Santri insert own record" ON santri FOR INSERT USING (true);
-- CREATE POLICY "Santri update own record" ON santri FOR UPDATE USING (((auth.uid() = id) OR (get_user_role(auth.uid()) = 'admin'::text)));
-- CREATE POLICY "Santri view own record" ON santri FOR SELECT USING (((auth.uid() = id) OR (get_user_role(auth.uid()) = 'admin'::text) OR ((get_user_role(auth.uid()) = 'guru'::text) AND (EXISTS ( SELECT 1 FROM classes c WHERE ((c.id = santri.id_kelas) AND (c.id_guru = auth.uid())))))));
-- CREATE POLICY "Admins can delete santri records" ON santri FOR DELETE USING ((get_user_role(auth.uid()) = 'admin'::text));
-- CREATE POLICY "admin_can_upload_update_santri_foto" ON santri FOR INSERT USING (true);
-- CREATE POLICY "admin_can_update_santri_foto" ON santri FOR UPDATE USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));
-- CREATE POLICY "Allow gurus to read santri notes" ON santri FOR SELECT USING ((auth.role() = 'authenticated'::text));
-- CREATE POLICY "Allow gurus to update santri notes" ON santri FOR UPDATE USING ((get_user_role(auth.uid()) = 'guru'::text));

-- (Policies for other tables are preserved in database metadata but disabled)