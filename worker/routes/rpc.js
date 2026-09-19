// Endpoint RPC bisnis.
//
// Nama rutenya sengaja sama dengan nama function lama, supaya pemetaan dari kode frontend
// yang memanggil supabase.rpc('nama') bisa ditelusuri satu lawan satu.

import { createAuthContext } from '../auth/predicates.js';
import { RpcError, changeSantriJilid, incrementSantriPoints } from '../rpc/santri.js';
import {
  changeSantriCategory, getGuruTransferClassOptions, moveSantriToClass, transferSantriToClassByGuru,
} from '../rpc/class-transfer.js';
import { readSessionCookie, verifySession } from '../auth/session.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const HANDLERS = {
  increment_santri_points: (db, ctx, body) =>
    incrementSantriPoints(db, ctx, { santriId: body?.p_santri_id, amount: body?.p_amount }),
  change_santri_jilid: (db, ctx, body) =>
    changeSantriJilid(db, ctx, { santriId: body?.p_santri_id, toJilid: body?.p_to_jilid }),
  change_santri_category: (db, ctx, body) =>
    changeSantriCategory(db, ctx, {
      santriId: body?.p_santri_id, targetCategory: body?.p_target_category, reason: body?.p_reason,
    }),
  move_santri_to_class: (db, ctx, body) =>
    moveSantriToClass(db, ctx, { santriId: body?.p_santri_id, toClassId: body?.p_to_class_id, reason: body?.p_reason }),
  transfer_santri_to_class_by_guru: (db, ctx, body) =>
    transferSantriToClassByGuru(db, ctx, {
      santriId: body?.p_santri_id, toClassId: body?.p_to_class_id, reason: body?.p_reason,
    }),
  get_guru_transfer_class_options: (db, ctx, body) =>
    getGuruTransferClassOptions(db, ctx, { santriId: body?.p_santri_id }),
};

export const handleRpc = async (request, env, url) => {
  const name = url.pathname.replace('/api/rpc/', '');
  const handler = HANDLERS[name];
  if (!handler) return null;
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body', message: 'Body harus berupa JSON.' }, 400);
  }

  const payload = await verifySession(env.SESSION_SECRET, readSessionCookie(request));
  const ctx = createAuthContext(env.DB, payload?.sub ?? null);

  try {
    return json({ data: await handler(env.DB, ctx, body) });
  } catch (error) {
    // Pesan RpcError memang ditujukan untuk pengguna dan ditampilkan apa adanya,
    // persis seperti pesan exception dari RPC lama.
    if (error instanceof RpcError) {
      return json({ error: 'rpc_error', message: error.message }, error.status);
    }
    console.error(`[rpc] ${name} gagal:`, error.message);
    return json({ error: 'rpc_failed', message: 'Permintaan tidak dapat diproses.' }, 500);
  }
};
