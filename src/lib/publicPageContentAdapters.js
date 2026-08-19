import { supabase } from '@/lib/customSupabaseClient';
import { getPublicContentErrorMessage, slugify } from '@/lib/publicContentAdapters';

export const PUBLIC_PAGE_DEFINITIONS = [
  { key: 'home', label: 'Beranda', description: 'Identitas, hero, jadwal, dan ajakan utama.' },
  { key: 'registration', label: 'Pendaftaran', description: 'Biaya, syarat, dan catatan pendaftaran.' },
  { key: 'learning-system', label: 'Sistem Mengaji', description: 'Metode, jadwal belajar, dan media pembelajaran.' },
  { key: 'parenting', label: 'Artikel Parenting', description: 'Materi pendampingan wali santri.' },
  { key: 'educational-media', label: 'Media Edukatif', description: 'Galeri, pustaka, dan media belajar.' },
  { key: 'profile', label: 'Profil', description: 'Profil lembaga dan fasilitas.' },
  { key: 'contact', label: 'Kontak', description: 'Informasi hubungan dan layanan publik.' },
  { key: 'apresiasi', label: 'Apresiasi', description: 'Papan peringkat dan apresiasi lembaga.' },
  { key: 'facilities', label: 'Fasilitas', description: 'Ruang belajar dan fasilitas LPQ.' },
  { key: 'gallery', label: 'Galeri', description: 'Dokumentasi kegiatan dan suasana belajar.' },
  { key: 'registration-brochure', label: 'Brosur Pendaftaran', description: 'Brosur dan dokumen pendaftaran.' },
  { key: 'registration-system', label: 'Sistem Pendaftaran', description: 'Penjelasan alur dan sistem pendaftaran.' },
  { key: 'parenting-media', label: 'Media Parenting', description: 'Media edukatif untuk wali santri.' },
  { key: 'wali-discussion', label: 'Diskusi Wali', description: 'Agenda dan ruang diskusi wali santri.' },
  { key: 'parenting-article', label: 'Detail Artikel Parenting', description: 'Blok tambahan untuk detail artikel.' },
  { key: 'news', label: 'Berita', description: 'Berita yang tampil di halaman publik.' },
  { key: 'news-detail', label: 'Detail Berita', description: 'Blok tambahan untuk detail berita.' },
  { key: 'announcements', label: 'Pengumuman', description: 'Pengumuman dan informasi penting.' },
  { key: 'announcement-detail', label: 'Detail Pengumuman', description: 'Blok tambahan untuk detail pengumuman.' },
  { key: 'tv-display', label: 'TV Display', description: 'Blok informasi untuk layar display.' },
];
export const PUBLIC_BLOCK_TYPES = [
  { value: 'rich_text', label: 'Teks' },
  { value: 'image', label: 'Gambar' },
  { value: 'link', label: 'Tautan' },
  { value: 'cards', label: 'Kumpulan Kartu' },
  { value: 'embed', label: 'Embed' },
];

const PAGE_KEYS = new Set(PUBLIC_PAGE_DEFINITIONS.map((page) => page.key));
const BLOCK_TYPES = new Set(PUBLIC_BLOCK_TYPES.map((type) => type.value));

export const normalizePublicContactConfig = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

export const normalizePhoneForLink = (value) => {
  const digits = String(value || '').replace(/[^0-9+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  return digits.startsWith('+') ? digits.slice(1) : digits;
};

const normalizePageKey = (value) => String(value || '').trim().toLowerCase();

const assertPageKey = (value) => {
  const pageKey = normalizePageKey(value);
  if (!PAGE_KEYS.has(pageKey)) throw new Error('Halaman publik tidak dikenali.');
  return pageKey;
};

const normalizeContent = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (Array.isArray(value)) return { items: value };
  return { body: String(value || '') };
};

const isHttpUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const validatePublicBlockContent = (blockType, content) => {
  if (['image', 'link', 'embed'].includes(blockType) && !isHttpUrl(content.url)) {
    throw new Error('Blok ini membutuhkan URL http atau https yang valid.');
  }
  if (blockType === 'cards' && !Array.isArray(content.items)) {
    throw new Error('Blok kartu membutuhkan daftar items.');
  }
  if (Array.isArray(content.paragraphs) && content.paragraphs.some((item) => typeof item !== 'string')) {
    throw new Error('Paragraphs harus berupa daftar teks.');
  }
};
export const normalizePublicContentBlock = (row) => ({
  id: row.id,
  page_key: row.page_key,
  block_key: row.block_key,
  block_type: row.block_type || 'rich_text',
  title: row.title || '',
  content: normalizeContent(row.content),
  sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
  is_visible: row.is_visible !== false,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const selectColumns = 'id,page_key,block_key,block_type,title,content,sort_order,is_visible,created_at,updated_at';

export const fetchPublicContentBlocks = async (pageKey) => {
  const normalizedPageKey = assertPageKey(pageKey);
  const { data, error } = await supabase
    .from('public_content_blocks')
    .select(selectColumns)
    .eq('page_key', normalizedPageKey)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizePublicContentBlock);
};

export const fetchAdminPublicContentBlocks = async (pageKey) => {
  const normalizedPageKey = assertPageKey(pageKey);
  const { data, error } = await supabase
    .from('public_content_blocks')
    .select(selectColumns)
    .eq('page_key', normalizedPageKey)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizePublicContentBlock);
};

export const savePublicContentBlock = async (block) => {
  const pageKey = assertPageKey(block?.page_key);
  const title = String(block?.title || '').trim();
  if (!title) throw new Error('Judul blok wajib diisi.');
  const blockKey = String(block?.block_key || slugify(title)).trim();
  if (!blockKey) throw new Error('Identifier blok wajib diisi.');
  const blockType = String(block?.block_type || 'rich_text').trim();
  if (!BLOCK_TYPES.has(blockType)) throw new Error('Jenis blok tidak didukung.');
  const sortOrder = Number(block?.sort_order ?? 0);
  if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new Error('Urutan tampil harus berupa angka 0 atau lebih.');

  const normalizedContent = normalizeContent(block?.content);
  validatePublicBlockContent(blockType, normalizedContent);

  const payload = {
    page_key: pageKey,
    block_key: blockKey,
    block_type: blockType,
    title,
    content: normalizedContent,
    sort_order: sortOrder,
    is_visible: block?.is_visible !== false,
  };

  const query = block?.id
    ? supabase.from('public_content_blocks').update(payload).eq('id', block.id)
    : supabase.from('public_content_blocks').insert(payload);
  const { data, error } = await query.select(selectColumns).single();
  if (error) throw error;
  return normalizePublicContentBlock(data);
};

export const deletePublicContentBlock = async (id) => {
  if (!id) throw new Error('Blok yang akan dihapus tidak ditemukan.');
  const { error } = await supabase.from('public_content_blocks').delete().eq('id', id);
  if (error) throw error;
};

export { getPublicContentErrorMessage };
