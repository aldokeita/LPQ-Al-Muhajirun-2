import { handleOptions } from "../_shared/cors.ts";
import { fail, methodNotAllowed, ok } from "../_shared/response.ts";
import { consumePersistentRateLimit } from "../_shared/rateLimit.ts";
import { getAnonClient, getServiceRoleClient } from "../_shared/supabaseAdmin.ts";
import { logSafe, maskIdentifier, requestId } from "../_shared/safeLogger.ts";
import { normalizeNomorInduk, requireString } from "../_shared/validation.ts";

type LoginAlias = {
  auth_user_id: string;
  internal_email: string;
  is_active: boolean;
};

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed(req);

  const rid = requestId();

  try {
    const body = await req.json();
    const loginIdentifier = requireString(body.nomor_induk_qiroati ?? body.username, "Username");
    const normalizedNomorInduk = normalizeNomorInduk(loginIdentifier);
    const nicknameIdentifier = loginIdentifier.trim();
    const password = requireString(body.password, "Password");
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";

    const rateLimit = await consumePersistentRateLimit(
      "signin-with-nomor-induk",
      ip,
      normalizedNomorInduk,
    );

    if (rateLimit.error) {
      logSafe("error", "login_rate_limit_unavailable", { request_id: rid, message: rateLimit.error });
      return fail(req, "RATE_LIMIT_UNAVAILABLE", "Login santri belum siap untuk production.", 503);
    }

    if (!rateLimit.allowed) {
      logSafe("warn", "login_rate_limited", {
        request_id: rid,
        identifier: maskIdentifier(normalizedNomorInduk),
      });
      return fail(req, "RATE_LIMITED", "Terlalu banyak percobaan. Coba lagi nanti.", 429);
    }

    const admin = getServiceRoleClient();

    const { data: directAlias, error: aliasError } = await admin
      .from("auth_login_aliases")
      .select("auth_user_id,internal_email,is_active")
      .eq("alias_type", "nomor_induk_qiroati")
      .eq("normalized_alias", normalizedNomorInduk)
      .eq("is_active", true)
      .maybeSingle<LoginAlias>();

    let alias = directAlias;

    if (!alias && !aliasError && nicknameIdentifier) {
      const { data: santriMatches, error: santriLookupError } = await admin
        .from("santri")
        .select("id,status")
        .ilike("nama_panggilan", nicknameIdentifier)
        .limit(2);

      if (!santriLookupError && santriMatches?.length === 1) {
        const santri = santriMatches[0];
        const activeStatus = String(santri.status ?? "").toLowerCase();
        if (activeStatus === "aktif" || activeStatus === "active") {
          const { data: aliasByUser } = await admin
            .from("auth_login_aliases")
            .select("auth_user_id,internal_email,is_active")
            .eq("auth_user_id", santri.id)
            .eq("alias_type", "nomor_induk_qiroati")
            .eq("is_active", true)
            .maybeSingle<LoginAlias>();
          alias = aliasByUser ?? null;
        }
      }
    }

    if (aliasError || !alias?.internal_email) {
      logSafe("warn", "login_alias_not_found", {
        request_id: rid,
        identifier: maskIdentifier(normalizedNomorInduk),
      });
      return fail(req, "INVALID_LOGIN", "Username santri atau password salah.", 401);
    }

    const { data: profile } = await admin
      .from("user_profiles")
      .select("role,status")
      .eq("id", alias.auth_user_id)
      .maybeSingle();

    if (!profile || profile.role !== "santri" || profile.status !== "active") {
      logSafe("warn", "login_profile_inactive", { request_id: rid, user_id: alias.auth_user_id });
      return fail(req, "INVALID_LOGIN", "Username santri atau password salah.", 401);
    }

    const anon = getAnonClient();
    const { data, error } = await anon.auth.signInWithPassword({
      email: alias.internal_email,
      password,
    });

    if (error || !data.session || !data.user) {
      logSafe("warn", "login_auth_failed", {
        request_id: rid,
        identifier: maskIdentifier(normalizedNomorInduk),
      });
      return fail(req, "INVALID_LOGIN", "Username santri atau password salah.", 401);
    }

    logSafe("info", "login_success", { request_id: rid, user_id: data.user.id });
    return ok(req, {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
      },
      user: {
        id: data.user.id,
        role: "santri",
      },
    });
  } catch (error) {
    logSafe("error", "login_unhandled_error", { request_id: rid, message: String(error) });
    return fail(req, "INVALID_LOGIN", "Username santri atau password salah.", 401);
  }
});
