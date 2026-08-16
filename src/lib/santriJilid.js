const LEGACY_JILID_ALIASES = Object.freeze({
  'Jilid 6A': 'Jilid 6',
  'Jilid 6B': 'Jilid 6',
});

export const SANTRI_PTPT_LABEL = 'Santri PTPT';
export const SANTRI_JILID_OPTIONS = Object.freeze([
  'Pra TK A', 'Pra TK B', 'Pra TK C',
  'Jilid 1A', 'Jilid 1B', 'Jilid 1C',
  'Jilid 2A', 'Jilid 2B',
  'Jilid 3A', 'Jilid 3B',
  'Jilid 4A', 'Jilid 4B',
  'Jilid 5A', 'Jilid 5B',
  'Jilid Juz 27',
  'Jilid 6',
  "Al-Qur'an", 'Ghorib Tajwid', 'Finishing',
]);

export const SANTRI_PROMOTION_OPTIONS = Object.freeze([...SANTRI_JILID_OPTIONS, SANTRI_PTPT_LABEL]);

export const normalizeSantriJilid = (value) => {
  const normalized = String(value ?? '').trim();
  return LEGACY_JILID_ALIASES[normalized] || normalized;
};

export const getSantriJilidQueryValues = (value) => {
  const normalized = normalizeSantriJilid(value);
  if (normalized === 'Jilid 6') return ['Jilid 6', 'Jilid 6A', 'Jilid 6B'];
  return normalized ? [normalized] : [];
};

export const getNextSantriJilid = (value, direction = 'up') => {
  const normalized = normalizeSantriJilid(value);
  const currentIndex = SANTRI_JILID_OPTIONS.indexOf(normalized);
  if (currentIndex < 0) return null;
  const nextIndex = direction === 'down' ? currentIndex - 1 : currentIndex + 1;
  return SANTRI_JILID_OPTIONS[nextIndex] || null;
};
