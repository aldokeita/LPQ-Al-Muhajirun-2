import { queryAll } from '@/lib/dataClient';
import { resolveAvatarRecords } from '@/lib/storageAdapters';
import { fetchWebsiteContentMap } from '@/lib/publicContentAdapters';
import { getSessionName } from '@/utils/sessionMapping';

export const SANTRI_ID_CARD_COLUMNS = [
  'id', 'nama_lengkap', 'nama_panggilan', 'nomor_induk_qiroati', 'kategori',
  'tanggal_pendaftaran', 'sesi_mengaji', 'foto_url', 'avatar_path',
  'status', 'deleted_at', 'created_at',
];

export const fetchSantriForIdCards = async () => {
  const { data, error } = await queryAll({
    table: 'santri',
    columns: SANTRI_ID_CARD_COLUMNS,
    filters: [
      { column: 'deleted_at', op: 'is_null' },
      { column: 'kategori', op: 'in', value: ['Anak', 'TPQ'] },
    ],
    order: [{ column: 'nama_lengkap', ascending: true }, { column: 'id', ascending: true }],
  });
  if (error) throw error;
  const activeRows = (data || []).filter((row) => (
    !row.deleted_at
    && ['anak', 'tpq'].includes(String(row.kategori || '').trim().toLowerCase())
    && ['aktif', 'active'].includes(String(row.status || '').trim().toLowerCase())
  ));
  const resolved = await resolveAvatarRecords(activeRows, { ownerType: 'santri' });
  return resolved.map((row) => ({
    ...row,
    tanggal_pendaftaran: row.tanggal_pendaftaran || row.created_at?.slice(0, 10) || null,
    sesi_label: getSessionName(row.sesi_mengaji),
  }));
};

export const fetchIdCardBranding = async () => {
  const content = await fetchWebsiteContentMap({ keys: ['logoUrl', 'qiroatiLogoUrl'] });
  return { logoUrl: typeof content.logoUrl === 'string' ? content.logoUrl.trim() : '', logoRightUrl: typeof content.qiroatiLogoUrl === 'string' ? content.qiroatiLogoUrl.trim() : '' };
};
