// Berkas disimpan di R2 dan dilayani Worker lewat /api/files/<awalan>/<path>.
//
// Tidak ada lagi signed URL. Dulu tiap avatar diakses lewat URL bertanda tangan yang
// dirotasi berkala, dan tiap rotasi mengubah URL-nya sehingga cache peramban meleset dan
// seluruh avatar terunduh ulang — salah satu dari dua sebab kuota egress Supabase jebol.
// Sekarang alamatnya tetap, hak aksesnya diperiksa per permintaan dari cookie sesi, dan
// peramban boleh menyimpannya lama.
//
// Karena alamatnya tetap, seluruh mesin cache URL yang dulu ada di berkas ini — beserta
// penyimpanannya di localStorage — ikut hilang. Tidak ada lagi yang perlu di-cache: URL-nya
// bisa dihitung langsung dari path-nya.

const AVATAR_BUCKET = 'avatars';
const WEBSITE_ASSETS_BUCKET = 'website-assets';
export const MUSIC_BUCKET = 'music-files';
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_AVATAR_SOURCE_SIZE = 12 * 1024 * 1024;
const MAX_AVATAR_DIMENSION = 400;
const MAX_WEBSITE_ASSET_SIZE = 20 * 1024 * 1024;
const MAX_WEBSITE_IMAGE_DIMENSION = 2400;
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
  if (file.size > MAX_AVATAR_SOURCE_SIZE) throw new Error('Ukuran foto sumber maksimal 12 MB.');
};

const canvasToWebpBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('Browser gagal mengonversi gambar ke WebP.'));
  }, 'image/webp', quality);
});

const loadAvatarImage = async (file) => {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Foto avatar tidak dapat dibaca.'));
    };
    image.src = objectUrl;
  });
  return {
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
};

export const compressAvatarToWebp = async (file) => {
  validateAvatarFile(file);

  if (file.type === 'image/webp' && file.size <= MAX_AVATAR_SIZE) {
    return new File([file], 'profile.webp', { type: 'image/webp', lastModified: file.lastModified });
  }

  if (typeof document === 'undefined') {
    throw new Error('Kompresi avatar hanya dapat dilakukan di browser.');
  }

  const decoded = await loadAvatarImage(file);
  try {
    const initialScale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(decoded.width, decoded.height));
    let width = Math.max(1, Math.round(decoded.width * initialScale));
    let height = Math.max(1, Math.round(decoded.height * initialScale));
    const qualitySteps = [0.86, 0.78, 0.7, 0.62];
    let outputBlob = null;

    for (let resizeAttempt = 0; resizeAttempt < 3; resizeAttempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) throw new Error('Browser tidak mendukung kompresi avatar.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(decoded.image, 0, 0, width, height);

      for (const quality of qualitySteps) {
        outputBlob = await canvasToWebpBlob(canvas, quality);
        if (outputBlob.size <= MAX_AVATAR_SIZE) break;
      }
      if (outputBlob?.size <= MAX_AVATAR_SIZE) break;
      width = Math.max(1, Math.round(width * 0.78));
      height = Math.max(1, Math.round(height * 0.78));
    }

    if (!outputBlob || outputBlob.size > MAX_AVATAR_SIZE) {
      throw new Error('Foto masih lebih dari 2 MB setelah dikompres. Pilih foto dengan resolusi lebih kecil.');
    }

    return new File([outputBlob], 'profile.webp', { type: 'image/webp', lastModified: Date.now() });
  } finally {
    decoded.cleanup();
  }
};

export const validateWebsiteAssetFile = (file) => {
  if (!file) throw new Error('File aset belum dipilih.');
  if (!WEBSITE_ASSET_TYPES.has(file.type)) throw new Error('Aset website harus berupa JPG, JPEG, PNG, WebP, atau PDF.');
  if (file.size > MAX_WEBSITE_ASSET_SIZE) throw new Error('Ukuran aset website maksimal 20 MB.');
};
export const compressWebsiteImageToWebp = async (file) => {
  validateWebsiteAssetFile(file);
  if (!IMAGE_TYPES.has(file.type)) return file;
  if (typeof document === 'undefined') {
    throw new Error('Kompresi gambar hanya dapat dilakukan di browser.');
  }

  const decoded = await loadAvatarImage(file);
  try {
    const initialScale = Math.min(1, MAX_WEBSITE_IMAGE_DIMENSION / Math.max(decoded.width, decoded.height));
    let width = Math.max(1, Math.round(decoded.width * initialScale));
    let height = Math.max(1, Math.round(decoded.height * initialScale));
    const qualitySteps = [0.88, 0.8, 0.72, 0.64];
    let outputBlob = null;

    for (let resizeAttempt = 0; resizeAttempt < 4; resizeAttempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) throw new Error('Browser tidak mendukung kompresi gambar.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(decoded.image, 0, 0, width, height);

      for (const quality of qualitySteps) {
        outputBlob = await canvasToWebpBlob(canvas, quality);
        if (outputBlob.size <= MAX_WEBSITE_ASSET_SIZE) break;
      }
      if (outputBlob?.size <= MAX_WEBSITE_ASSET_SIZE) break;
      width = Math.max(1, Math.round(width * 0.78));
      height = Math.max(1, Math.round(height * 0.78));
    }

    if (!outputBlob || outputBlob.size > MAX_WEBSITE_ASSET_SIZE) {
      throw new Error('Gambar masih lebih dari 20 MB setelah dikompres. Pilih gambar dengan resolusi lebih kecil.');
    }

    return new File([outputBlob], 'content.webp', {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } finally {
    decoded.cleanup();
  }
};


export const getAvatarPath = ({ ownerType, ownerId }) => {
  if (!ownerId) throw new Error('Akun harus tersimpan sebelum avatar dapat diunggah.');
  const folder = ownerType === 'santri' ? 'santri' : 'guru';
  return `${folder}/${ownerId}/profile.webp`;
};

const parseSafeResponseBody = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
};

// Alamat berkas. Tetap dan bisa dihitung, jadi tidak ada yang perlu diminta ke server
// hanya untuk tahu di mana sebuah gambar berada.
export const fileUrl = (bucket, path) => (path ? `/api/files/${bucket}/${path}` : '');

const putFile = async ({ bucket, path, file }) => {
  const response = await fetch(`/api/files/${bucket}/${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': file.type },
    body: file,
  });
  if (!response.ok) {
    const body = await parseSafeResponseBody(response);
    throw new Error(body?.message || `Unggah berkas gagal (${response.status}).`);
  }
  return path;
};

const deleteFile = async ({ bucket, path }) => {
  const response = await fetch(`/api/files/${bucket}/${path}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await parseSafeResponseBody(response);
    throw new Error(body?.message || `Hapus berkas gagal (${response.status}).`);
  }
  return path;
};

// Berkas audio tidak dikompres maupun diubah: yang diunggah admin adalah yang disimpan.
export const uploadMusicFile = async ({ path, file }) => {
  await putFile({ bucket: MUSIC_BUCKET, path, file });
  return { path, publicUrl: fileUrl(MUSIC_BUCKET, path) };
};

export const uploadAvatar = async ({ ownerType, ownerId, file }) => {
  const webpFile = await compressAvatarToWebp(file);
  const path = getAvatarPath({ ownerType, ownerId });
  await putFile({ bucket: AVATAR_BUCKET, path, file: webpFile });
  // Namanya tetap signedUrl agar pemanggil tidak perlu diubah, tetapi isinya sekarang
  // alamat tetap, bukan URL bertanda tangan.
  return { path, signedUrl: fileUrl(AVATAR_BUCKET, path) };
};

export const deleteAvatar = async ({ ownerType, ownerId }) => {
  const path = getAvatarPath({ ownerType, ownerId });
  await deleteFile({ bucket: AVATAR_BUCKET, path });
  return { path };
};

export const preloadAvatarUrl = (url) => {
  if (!url || typeof Image === 'undefined') return url || '';
  const image = new Image();
  image.decoding = 'async';
  image.fetchPriority = 'high';
  image.src = url;
  return url;
};

// Dulu ini memanggil server untuk menandatangani URL, jadi meresolusi satu halaman penuh
// avatar berarti ratusan permintaan. Sekarang alamatnya dihitung saja, tanpa permintaan
// apa pun — fungsinya tetap async supaya seluruh pemanggil tidak perlu diubah.
//
// avatar_path yang kosong berarti pemiliknya belum pernah mengunggah foto, dan foto_url
// lama dipakai sebagai cadangan seperti sebelumnya.
export const resolveAvatarUrl = async ({ ownerType, ownerId, avatarPath, fallbackUrl }) => {
  if (!avatarPath) return fallbackUrl || '';
  return preloadAvatarUrl(fileUrl(AVATAR_BUCKET, avatarPath));
};

export const resolveAvatarRecord = async (
  record,
  {
    ownerType,
    ownerIdKey = 'id',
    avatarPathKey = 'avatar_path',
    fallbackUrlKey = 'foto_url',
    outputKey = 'foto_url',
  } = {},
) => {
  if (!record) return record;

  const resolvedUrl = await resolveAvatarUrl({
    ownerType,
    ownerId: record[ownerIdKey],
    avatarPath: record[avatarPathKey],
    fallbackUrl: record[fallbackUrlKey],
  });

  return { ...record, [outputKey]: resolvedUrl };
};

export const resolveAvatarRecords = async (records, options) => Promise.all(
  (records || []).map((record) => resolveAvatarRecord(record, options)),
);

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

export const uploadWebsiteAsset = async ({ folder, key, file, convertToWebp = false }) => {
  const preparedFile = convertToWebp && IMAGE_TYPES.has(file?.type)
    ? await compressWebsiteImageToWebp(file)
    : file;
  validateWebsiteAssetFile(preparedFile);
  const path = getWebsiteAssetPath({ folder, key, file: preparedFile });
  await putFile({ bucket: WEBSITE_ASSETS_BUCKET, path, file: preparedFile });
  return { path, publicUrl: fileUrl(WEBSITE_ASSETS_BUCKET, path) };
};

// Mengenali berkas milik sendiri dari URL yang tersimpan di basis data.
//
// Isi website_content masih menyimpan URL Supabase lama dari sebelum pemindahan, jadi
// keduanya dikenali: alamat baru /api/files/website-assets/<path>, dan alamat Supabase
// lama .../storage/v1/object/<visibilitas>/website-assets/<path>. Yang lama tetap dikenali
// supaya penghapusan aset lama tidak diam-diam gagal.
export const getWebsiteAssetPathFromUrl = (assetUrl) => {
  if (!assetUrl) return null;

  const modern = `/api/files/${WEBSITE_ASSETS_BUCKET}/`;
  const modernIndex = String(assetUrl).indexOf(modern);
  if (modernIndex >= 0) {
    const path = String(assetUrl).slice(modernIndex + modern.length).split('?')[0];
    try {
      return decodeURIComponent(path) || null;
    } catch {
      return path || null;
    }
  }

  const marker = '/storage/v1/object/';
  const markerIndex = String(assetUrl).indexOf(marker);
  if (markerIndex < 0) return null;

  const segments = String(assetUrl)
    .slice(markerIndex + marker.length)
    .split('?')[0]
    .split('/')
    .filter(Boolean);
  if (segments.length < 3) return null;

  const visibility = segments.shift();
  const bucket = segments.shift();
  if (!['public', 'sign', 'authenticated'].includes(visibility)) return null;
  if (bucket !== WEBSITE_ASSETS_BUCKET) return null;

  try {
    return decodeURIComponent(segments.join('/'));
  } catch {
    return null;
  }
};

export const deleteWebsiteAssetByUrl = async (assetUrl) => {
  const path = getWebsiteAssetPathFromUrl(assetUrl);
  if (!path) return { deleted: false, path: null };
  await deleteFile({ bucket: WEBSITE_ASSETS_BUCKET, path });
  return { deleted: true, path };
};
