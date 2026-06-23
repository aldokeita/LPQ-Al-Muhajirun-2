import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAnonKey, getSupabaseUrl } from "./supabaseAdmin.ts";

export async function getUserFromRequest(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization) return { user: null, client: null, error: "Missing authorization header" };

  const client = createClient(getSupabaseUrl(), getAnonKey(), {
    global: { headers: { authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { user: null, client, error: error?.message ?? "Invalid session" };
  return { user: data.user, client, error: null };
}

