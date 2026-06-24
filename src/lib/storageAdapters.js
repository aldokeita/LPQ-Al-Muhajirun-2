import { supabase } from '@/lib/customSupabaseClient';
import { enableEdgeFunctions, edgeFunctionDisabledMessage } from '@/lib/featureFlags';

const AVATAR_BUCKET = 'avatars';
const WEBSITE_ASSETS_BUCKET = 'website-assets';
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_WEBSITE_ASSET_SIZE = 20 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const WEBSITE_ASSET_TYPES = new Set([...IMAGE_TYPES, 'application/pdf']);

const EXTENSION_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const getStorageErrorMessage = (error) => {
  const message = error?.message || String(error || '');
  if (!message) return 'Operasi Storage gagal.';
  if (message.toLowerCase().includes('row-level security') || message.includes('403')) {
    return 'Akses Storage ditolak untuk akun ini.';
  }
  return message;
};

export const validateAvatarFile = (file) => {
  if (!file) throw new Error('File avatar belum dipilih.');
  if (!IMAGE_TYPES.has(file.type)) throw new Error('Avatar harus berupa JPG, JPEG, PNG, atau WebP.');
  if (file.size > MAX_AVATAR_SIZE) throw new Error('Ukuran avatar maksimal 2 MB.');
};

export const validateWebsiteAssetFile = (file) => {
  if (!file) throw new Error('File aset belum dipilih.');
  if (!WEBSITE_ASSET_TYPES.has(file.type)) throw new Error('Aset website harus berupa JPG, JPEG, PNG, WebP, atau PDF.');
  if (file.size > MAX_WEBSITE_ASSET_SIZE) throw new Error('Ukuran aset website maksimal 20 MB.');
};

export const getAvatarPath = ({ ownerType, ownerId }) => {
  if (!ownerId) throw new Error('Akun harus tersimpan sebelum avatar dapat diunggah.');
  const folder = ownerType === 'santri' ? 'santri' : 'guru';
  return `${folder}/${ownerId}/profile.webp`;
};

const uploadViaSignedUrl = async ({ bucket, path, file, purpose }) => {
  if (!enableEdgeFunctions) throw new Error(edgeFunctionDisabledMessage);

  const { data, error } = await supabase.functions.invoke('generate-signed-upload-url', {
    body: {
      bucket,
      path,
      content_type: file.type,
      size: file.size,
      purpose,
    },
  });

  if (error) throw error;
  const signedUpload = data?.data || data;
  if (!signedUpload?.signed_url) throw new Error('Signed URL upload tidak tersedia.');

  const response = await fetch(normalizeLocalSignedUrl(signedUpload.signed_url), {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!response.ok) throw new Error('Upload file ke Storage gagal.');
  return signedUpload.path || path;
};

const normalizeLocalSignedUrl = (signedUrl) => {
  try {
    const configuredUrl = import.meta.env.VITE_SUPABASE_URL;
    const targetUrl = new URL(signedUrl);
    if (configuredUrl && targetUrl.hostname === 'kong') {
      const publicBaseUrl = new URL(configuredUrl);
      targetUrl.protocol = publicBaseUrl.protocol;
      targetUrl.hostname = publicBaseUrl.hostname;
      targetUrl.port = publicBaseUrl.port;
    }
    return targetUrl.toString();
  } catch {
    return signedUrl;
  }
};

export const createSignedAvatarUrl = async (path, expiresIn = 3600) => {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl || null;
};

export const uploadAvatar = async ({ ownerType, ownerId, file }) => {
  validateAvatarFile(file);
  const path = getAvatarPath({ ownerType, ownerId });
  const storedPath = await uploadViaSignedUrl({
    bucket: AVATAR_BUCKET,
    path,
    file,
    purpose: `${ownerType}-avatar`,
  });
  const signedUrl = await createSignedAvatarUrl(storedPath);
  return { path: storedPath, signedUrl };
};

export const deleteAvatar = async ({ ownerType, ownerId }) => {
  const path = getAvatarPath({ ownerType, ownerId });
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw error;
  return { path };
};

export const resolveAvatarUrl = async ({ ownerType, ownerId, avatarPath, fallbackUrl }) => {
  const path = avatarPath || (ownerId ? getAvatarPath({ ownerType, ownerId }) : null);
  const signedUrl = await createSignedAvatarUrl(path);
  return signedUrl || fallbackUrl || '';
};

const fileExtensionFor = (file) => EXTENSION_BY_TYPE[file.type] || 'bin';

export const getWebsiteAssetPath = ({ folder = 'general', key, file }) => {
  const safeFolder = String(folder || 'general').replace(/[^a-zA-Z0-9/_-]/g, '-');
  const ext = fileExtensionFor(file);
  if (key) {
    const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '-');
    return `${safeFolder}/${safeKey}.${ext}`;
  }
  const randomPart = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${safeFolder}/${randomPart}.${ext}`;
};

export const uploadWebsiteAsset = async ({ folder, key, file }) => {
  validateWebsiteAssetFile(file);
  const path = getWebsiteAssetPath({ folder, key, file });
  const { error } = await supabase.storage
    .from(WEBSITE_ASSETS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: Boolean(key),
      contentType: file.type,
    });
  if (error) throw error;

  const { data } = supabase.storage.from(WEBSITE_ASSETS_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
};
