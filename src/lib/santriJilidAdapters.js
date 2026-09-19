import { rpc } from '@/lib/dataClient';
import { normalizeSantriJilid } from '@/lib/santriJilid';

export const changeSantriJilid = async ({ santriId, toJilid, reason = null }) => {
  const targetJilid = normalizeSantriJilid(toJilid);

  if (!santriId) {
    return { data: null, error: new Error('Santri belum dipilih.') };
  }
  if (!targetJilid) {
    return { data: null, error: new Error('Jilid tujuan belum dipilih.') };
  }

  const { data, error } = await rpc('change_santri_jilid', {
    p_santri_id: santriId,
    p_to_jilid: targetJilid,
    p_reason: reason,
  });

  if (error) return { data: null, error };

  // RPC lama memulangkan TABLE sehingga hasilnya berupa array; endpoint Worker memulangkan
  // satu objek. Keduanya ditangani agar modul ini tidak peduli mana yang melayaninya.
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.santri_id) {
    return {
      data: null,
      error: new Error('Perubahan jilid belum dikonfirmasi oleh database.'),
    };
  }

  return { data: result, error: null };
};
