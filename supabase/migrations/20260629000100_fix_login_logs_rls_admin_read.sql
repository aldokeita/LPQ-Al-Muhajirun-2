-- Fix: Allow admin to read ALL login logs, not just non-admin logs.
-- The previous policy had (role <> 'admin') which filtered out admin login attempts.

DROP POLICY IF EXISTS "Allow admin to read non-admin login logs" ON public.login_logs;

CREATE POLICY "Allow admin to read all login logs"
  ON public.login_logs
  FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');