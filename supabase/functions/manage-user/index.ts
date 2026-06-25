import { handleOptions } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { fail, methodNotAllowed, ok } from "../_shared/response.ts";
import { requireRole } from "../_shared/roles.ts";
import { getServiceRoleClient } from "../_shared/supabaseAdmin.ts";
import { logSafe, requestId } from "../_shared/safeLogger.ts";
import { normalizeNomorInduk, requireString, validateRole } from "../_shared/validation.ts";

function internalEmailFor(userId: string): string {
  return `santri+${userId}@auth.lpqalmuhajirun.local`;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed(req);

  const rid = requestId();

  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (authError || !user) return fail(req, "UNAUTHORIZED", "Session tidak valid.", 401);
    await requireRole(user.id, ["admin"]);

    const body = await req.json();
    const action = requireString(body.action, "Action");
    const role = validateRole(body.role);
    const profile = body.profile ?? {};
    const admin = getServiceRoleClient();

    if (!["create", "update", "deactivate"].includes(action)) {
      return fail(req, "VALIDATION_ERROR", "Action tidak valid.", 400);
    }

    if (action === "create") {
      const displayName = requireString(profile.nama_lengkap ?? profile.nama, "Nama");
      const initialPassword = requireString(body.initial_password, "Password awal");
      const nomorInduk = role === "santri" ? normalizeNomorInduk(profile.nomor_induk_qiroati) : null;

      if (nomorInduk) {
        const { data: existingAlias } = await admin
          .from("auth_login_aliases")
          .select("id")
          .eq("alias_type", "nomor_induk_qiroati")
          .eq("normalized_alias", nomorInduk)
          .maybeSingle();

        if (existingAlias) {
          return fail(req, "DUPLICATE_NOMOR_INDUK", "Nomor Induk Qiroati sudah digunakan.", 409);
        }
      }

      const authEmail = role === "santri"
        ? `pending+${crypto.randomUUID()}@auth.lpqalmuhajirun.local`
        : requireString(profile.email, "Email");

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: authEmail,
        password: initialPassword,
        email_confirm: true,
        user_metadata: { role, display_name: displayName },
      });

      if (createError || !created.user) {
        logSafe("error", "manage_user_auth_create_failed", { request_id: rid, role });
        return fail(req, "CREATE_USER_FAILED", "Akun gagal dibuat.", 400);
      }

      const userId = created.user.id;
      const finalEmail = role === "santri" ? internalEmailFor(userId) : authEmail;

      if (role === "santri") {
        await admin.auth.admin.updateUserById(userId, { email: finalEmail });
      }

      const { error: profileError } = await admin.from("user_profiles").insert({
        id: userId,
        role,
        display_name: displayName,
        email: role === "santri" ? null : finalEmail,
        phone: profile.no_hp ?? profile.no_hp_ortu ?? null,
        status: "active",
        created_by: user.id,
        updated_by: user.id,
      });

      if (profileError) {
        await admin.auth.admin.deleteUser(userId);
        return fail(req, "PROFILE_CREATE_FAILED", "Profil akun gagal dibuat.", 400);
      }

      if (role === "santri") {
        const { error: santriError } = await admin.from("santri").insert({
          id: userId,
          nomor_induk_qiroati: nomorInduk,
          nama_lengkap: displayName,
          nama_panggilan: profile.nama_panggilan ?? null,
          kategori: profile.kategori ?? null,
          jenis_kelamin: profile.jenis_kelamin ?? null,
          tanggal_lahir: profile.tanggal_lahir ?? null,
          tempat_lahir: profile.tempat_lahir ?? null,
          tanggal_pendaftaran: profile.tanggal_pendaftaran ?? null,
          nama_ayah: profile.nama_ayah ?? null,
          nama_ibu: profile.nama_ibu ?? null,
          alamat: profile.alamat ?? null,
          no_hp_ortu: profile.no_hp_ortu ?? null,
          no_kk: profile.no_kk ?? null,
          no_nik: profile.no_nik ?? null,
          rfid_tag: profile.rfid_tag ?? null,
          sesi_mengaji: profile.sesi_mengaji ?? null,
          jilid: profile.jilid ?? null,
          foto_url: profile.foto_url ?? null,
          avatar_path: profile.avatar_path ?? null,
          berkas_foto: Boolean(profile.berkas_foto),
          berkas_akta: Boolean(profile.berkas_akta),
          berkas_kk: Boolean(profile.berkas_kk),
          berkas_form: Boolean(profile.berkas_form),
          link_qiroati: profile.link_qiroati ?? null,
          points: profile.points ?? 0,
          current_class_id: profile.current_class_id ?? null,
          status: "Aktif",
          created_by: user.id,
          updated_by: user.id,
        });
        if (santriError) {
          await admin.auth.admin.deleteUser(userId);
          return fail(req, "SANTRI_CREATE_FAILED", "Data santri gagal dibuat.", 400);
        }

        const { error: aliasError } = await admin.from("auth_login_aliases").insert({
          auth_user_id: userId,
          alias_value: nomorInduk,
          normalized_alias: nomorInduk,
          internal_email: finalEmail,
          is_active: true,
        });
        if (aliasError) {
          await admin.auth.admin.deleteUser(userId);
          return fail(req, "ALIAS_CREATE_FAILED", "Alias login santri gagal dibuat.", 400);
        }
      } else {
        const { error: guruError } = await admin.from("guru").insert({
          id: userId,
          nama: displayName,
          email: finalEmail,
          no_hp: profile.no_hp ?? null,
          jabatan: profile.jabatan ?? null,
          roles: role === "pentashih" ? ["Pentashih"] : [],
          status: "active",
          created_by: user.id,
          updated_by: user.id,
        });
        if (guruError) {
          await admin.auth.admin.deleteUser(userId);
          return fail(req, "GURU_CREATE_FAILED", "Data guru gagal dibuat.", 400);
        }
      }

      logSafe("info", "manage_user_created", { request_id: rid, target_user_id: userId, role });
      return ok(req, { user_id: userId, role }, 201);
    }

    const targetUserId = requireString(body.target_user_id, "Target user id");

    if (action === "deactivate") {
      await admin.from("user_profiles").update({ status: "inactive", updated_by: user.id }).eq("id", targetUserId);
      await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "876000h" });
      return ok(req, { user_id: targetUserId, deactivated: true });
    }

    await admin.from("user_profiles").update({
      display_name: body.profile?.display_name,
      updated_by: user.id,
    }).eq("id", targetUserId);

    return ok(req, { user_id: targetUserId, updated: true });
  } catch (error) {
    logSafe("error", "manage_user_error", { request_id: rid, message: String(error) });
    if (String(error).includes("FORBIDDEN")) return fail(req, "FORBIDDEN", "Akses ditolak.", 403);
    return fail(req, "MANAGE_USER_FAILED", "Operasi akun gagal.", 400);
  }
});
