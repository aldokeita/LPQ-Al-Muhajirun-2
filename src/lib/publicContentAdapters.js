import { insert, query, remove, update, upsert } from '@/lib/dataClient';
import { deleteWebsiteAssetByUrl } from '@/lib/storageAdapters';

// Kolom content bertipe jsonb. Lapisan data yang membongkar dan merangkainya, jadi modul
// ini tetap bekerja dengan objek seperti sebelumnya.
const NEWS_COLUMNS = ['id', 'title', 'slug', 'excerpt', 'content', 'cover_image_url', 'status', 'published_at', 'created_at'];
const ANNOUNCEMENT_COLUMNS = ['id', 'title', 'slug', 'excerpt', 'content', 'cover_image_url', 'status', 'priority', 'valid_until', 'published_at', 'created_at'];
const todayText = () => new Date().toISOString().slice(0, 10);

const toDateText = (value) => value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

export const slugify = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || `konten-${Date.now()}`;

export const getPublicContentErrorMessage = (error) => {
  if (!error) return 'Terjadi kesalahan tidak diketahui.';
  if (error.code === '23505') return 'Slug sudah digunakan. Ubah judul atau slug konten.';
  if (error.code === '42501') return 'Akses ditolak oleh kebijakan keamanan.';
  return error.message || String(error);
};

export const normalizeNewsRow = (row) => ({
  id: row.id,
  title: row.title || '',
  slug: row.slug || row.id,
  summary: row.excerpt || row.summary || '',
  excerpt: row.excerpt || row.summary || '',
  content: typeof row.content === 'string' ? row.content : (row.content?.body || row.content?.text || ''),
  image_url: row.cover_image_url || '',
  cover_image_url: row.cover_image_url || '',
  status: row.status || 'draft',
  date: toDateText(row.published_at || row.created_at),
  published_at: row.published_at,
  created_at: row.created_at,
});

export const normalizeAnnouncementRow = (row) => ({
  id: row.id,
  title: row.title || '',
  slug: row.slug || row.id,
  summary: row.excerpt || row.summary || '',
  excerpt: row.excerpt || row.summary || '',
  content: typeof row.content === 'string' ? row.content : (row.content?.body || row.content?.text || ''),
  image_url: row.cover_image_url || '',
  cover_image_url: row.cover_image_url || '',
  status: row.status || 'draft',
  priority: row.priority || 'normal',
  valid_until: row.valid_until || '',
  date: toDateText(row.published_at || row.created_at),
  published_at: row.published_at,
  created_at: row.created_at,
});

export const fetchWebsiteContentMap = async ({ keys, publicOnly = true } = {}) => {
  const filters = [];
  if (Array.isArray(keys) && keys.length > 0) filters.push({ column: 'key', op: 'in', value: keys });
  if (publicOnly) filters.push({ column: 'is_public', op: 'eq', value: 1 });
  const { data, error } = await query({
    table: 'website_content',
    columns: ['key', 'content', 'is_public'],
    filters,
    limit: 1000,
  });
  if (error) throw error;
  return (data || []).reduce((acc, item) => {
    acc[item.key] = item.content;
    return acc;
  }, {});
};

export const normalizeWebsiteContentValue = (value) => {
  if (value === undefined || value === null) return {};
  if (typeof value === 'string') return value.trim();
  return value;
};

export const assertNonEmptyWebsiteContentString = (key, value) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(`${key} tidak boleh kosong.`);
  return normalized;
};

export const saveWebsiteContentItem = async ({ key, content, isPublic = true }) => {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) throw new Error('Key konten wajib diisi.');
  const normalizedContent = normalizeWebsiteContentValue(content);
  const payload = {
    key: normalizedKey,
    content: normalizedContent,
    is_public: isPublic,
  };
  const { error } = await upsert('website_content', payload, 'key');
  if (error) throw error;
  return payload;
};

export const saveWebsiteContentItems = async (items) => {
  const payload = (items || [])
    .map((item) => ({
      key: String(item.key || '').trim(),
      content: normalizeWebsiteContentValue(item.content),
      is_public: item.is_public ?? item.isPublic ?? true,
    }))
    .filter((item) => item.key);
  if (payload.length === 0) return [];
  // Endpoint upsert menangani satu baris, jadi penyimpanan massal dikirim berurutan.
  // Satu kegagalan menghentikan sisanya, sama seperti upsert massal yang gagal sebagian.
  for (const item of payload) {
    const { error } = await upsert('website_content', item, 'key');
    if (error) throw error;
  }
  return payload;
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Gagal membaca gambar logo.'));
  reader.readAsDataURL(blob);
});

export const getEmbeddableImageUrl = async (url, fallback = '') => {
  const target = typeof url === 'string' && url.trim() ? url.trim() : fallback;
  if (!target) return '';
  if (target.startsWith('data:') || target.startsWith('/')) return target;
  try {
    const response = await fetch(target, { mode: 'cors', cache: 'no-store' });
    if (!response.ok) throw new Error(`Logo tidak dapat dimuat (${response.status}).`);
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return fallback;
  }
};

export const fetchReceiptLogoDataUrl = async (fallback = '') => {
  try {
    const contentMap = await fetchWebsiteContentMap({ keys: ['logoUrl'], publicOnly: true });
    return await getEmbeddableImageUrl(contentMap.logoUrl, fallback);
  } catch {
    return fallback;
  }
};

export const waitForImagesToLoad = async (rootElement) => {
  if (!rootElement) return;
  const images = Array.from(rootElement.querySelectorAll('img'));
  await Promise.all(images.map((image) => {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
    });
  }));
};

// Identitas bisa berupa slug atau UUID. Pola lamanya mencari keduanya sekaligus ketika
// bentuknya menyerupai UUID, dan itu dipertahankan.
const identityFilter = (slugOrId) => {
  const value = String(slugOrId || '');
  if (/^[0-9a-fA-F-]{36}$/.test(value)) {
    return { or: [{ column: 'slug', op: 'eq', value }, { column: 'id', op: 'eq', value }] };
  }
  return { column: 'slug', op: 'eq', value };
};

const PUBLISHED_ORDER = [
  { column: 'published_at', ascending: false, nullsFirst: false },
  { column: 'created_at', ascending: false },
];

export const fetchPublishedNews = async ({ limit } = {}) => {
  const { data, error } = await query({
    table: 'news',
    columns: NEWS_COLUMNS,
    filters: [{ column: 'status', op: 'eq', value: 'published' }],
    order: PUBLISHED_ORDER,
    limit: limit || 1000,
  });
  if (error) throw error;
  return (data || []).map(normalizeNewsRow);
};

export const fetchNewsDetail = async (slugOrId) => {
  const { data, error } = await query({
    table: 'news',
    columns: NEWS_COLUMNS,
    filters: [{ column: 'status', op: 'eq', value: 'published' }, identityFilter(slugOrId)],
    limit: 1,
  });
  if (error) throw error;
  return data?.length > 0 ? normalizeNewsRow(data[0]) : null;
};

export const fetchPublishedAnnouncements = async ({ limit } = {}) => {
  const { data, error } = await query({
    table: 'announcements',
    columns: ANNOUNCEMENT_COLUMNS,
    filters: [
      { column: 'status', op: 'eq', value: 'published' },
      { or: [{ column: 'valid_until', op: 'is_null' }, { column: 'valid_until', op: 'gte', value: todayText() }] },
    ],
    order: PUBLISHED_ORDER,
    limit: limit || 1000,
  });
  if (error) throw error;
  return (data || []).map(normalizeAnnouncementRow);
};

export const fetchAnnouncementDetail = async (slugOrId) => {
  const { data, error } = await query({
    table: 'announcements',
    columns: ANNOUNCEMENT_COLUMNS,
    filters: [{ column: 'status', op: 'eq', value: 'published' }, identityFilter(slugOrId)],
    limit: 1,
  });
  if (error) throw error;
  const row = data?.[0];
  if (row?.valid_until && row.valid_until < todayText()) return null;
  return row ? normalizeAnnouncementRow(row) : null;
};

export const fetchAdminNews = async () => {
  const { data, error } = await query({
    table: 'news',
    columns: NEWS_COLUMNS,
    order: [{ column: 'created_at', ascending: false }],
    limit: 1000,
  });
  if (error) throw error;
  return (data || []).map(normalizeNewsRow);
};

export const fetchAdminAnnouncements = async () => {
  const { data, error } = await query({
    table: 'announcements',
    columns: ANNOUNCEMENT_COLUMNS,
    order: [{ column: 'created_at', ascending: false }],
    limit: 1000,
  });
  if (error) throw error;
  return (data || []).map(normalizeAnnouncementRow);
};

const publicationTimestamp = (status, existingPublishedAt) => {
  if (status !== 'published') return existingPublishedAt || null;
  return existingPublishedAt || new Date().toISOString();
};

export const saveNews = async (item) => {
  const status = item.status || 'draft';
  const payload = {
    title: String(item.title || '').trim(),
    slug: String(item.slug || slugify(item.title)).trim(),
    excerpt: String(item.summary || item.excerpt || '').trim() || null,
    content: { body: String(item.content || '').trim() },
    cover_image_url: String(item.image_url || item.cover_image_url || '').trim() || null,
    status,
    published_at: publicationTimestamp(status, item.published_at),
  };
  if (!payload.title) throw new Error('Judul berita wajib diisi.');
  if (item.id) payload.id = item.id;
  const { data, error } = await upsert('news', payload);
  if (error) throw error;
  return normalizeNewsRow({ ...payload, id: item.id ?? data?.id ?? null });
};

export const saveAnnouncement = async (item) => {
  const status = item.status || 'draft';
  const payload = {
    title: String(item.title || '').trim(),
    slug: String(item.slug || slugify(item.title)).trim(),
    excerpt: String(item.summary || item.excerpt || '').trim() || null,
    content: { body: String(item.content || '').trim() },
    cover_image_url: String(item.image_url || item.cover_image_url || '').trim() || null,
    status,
    priority: item.priority || 'normal',
    valid_until: item.valid_until || null,
    published_at: publicationTimestamp(status, item.published_at),
  };
  if (!payload.title) throw new Error('Judul pengumuman wajib diisi.');
  if (item.id) payload.id = item.id;
  const { data, error } = await upsert('announcements', payload);
  if (error) throw error;
  return normalizeAnnouncementRow({ ...payload, id: item.id ?? data?.id ?? null });
};

export const archiveNews = async (id) => {
  const { error } = await update('news', id, { status: 'archived' });
  if (error) throw error;
};

const deletePublicContentRecord = async ({ table, id }) => {
  const { data: records, error: fetchError } = await query({
    table,
    columns: ['id', 'cover_image_url'],
    filters: [{ column: 'id', op: 'eq', value: id }],
    limit: 1,
  });
  if (fetchError) throw fetchError;
  const record = records?.[0];
  if (!record) throw new Error('Konten tidak ditemukan.');

  if (record.cover_image_url) {
    await deleteWebsiteAssetByUrl(record.cover_image_url);
  }

  const { data: deleted, error: deleteError } = await remove(table, id);
  if (deleteError) throw deleteError;
  if (!deleted) throw new Error('Konten tidak dapat dihapus.');
  return deleted;
};
export const archiveAnnouncement = async (id) => {
  const { error } = await update('announcements', id, { status: 'archived' });
  if (error) throw error;
};
export const deleteNews = async (id) => deletePublicContentRecord({ table: 'news', id });
export const deleteAnnouncement = async (id) => deletePublicContentRecord({ table: 'announcements', id });


export const submitPublicFeedback = async ({ nama, name, email, phone, no_hp, message, pesan }) => {
  const payload = {
    nama: String(nama || name || '').trim() || null,
    email: String(email || '').trim() || null,
    phone: String(phone || no_hp || '').trim() || null,
    message: String(message || pesan || '').trim(),
  };
  if (!payload.message) throw new Error('Pesan wajib diisi.');
  // Pengunjung tanpa login boleh mengirim masukan, sesuai kebijakan tabel feedbacks.
  const { error } = await insert('feedbacks', payload);
  if (error) throw error;
};

export const fetchAdminFeedbacks = async () => {
  const { data, error } = await query({
    table: 'feedbacks',
    columns: ['id', 'nama', 'email', 'phone', 'message', 'status', 'created_at'],
    order: [{ column: 'created_at', ascending: false }],
    limit: 1000,
  });
  if (error) throw error;
  return data || [];
};

export const deleteFeedback = async (id) => {
  const { error } = await remove('feedbacks', id);
  if (error) throw error;
};

