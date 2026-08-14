export const QUIZ_HAFALAN_JILIDS = ['1', '2', '3', '4', '5', '6'];

export const QUIZ_HAFALAN_CATEGORIES = [
  {
    id: 'doa-harian',
    key: 'Doa',
    label: 'Do’a Harian',
    color: '#3b82f6',
  },
  {
    id: 'bacaan-shalat',
    key: 'Sholat',
    label: 'Bacaan Shalat',
    color: '#f59e0b',
  },
  {
    id: 'surat-pendek',
    key: 'Surat',
    label: 'Surat Pendek',
    color: '#a855f7',
  },
];

const normalizeLabel = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[’'`]/g, '')
  .replace(/\s+/g, ' ');

const CATEGORY_ALIASES = {
  doa: 'Doa',
  'doa harian': 'Doa',
  'doa-harian': 'Doa',
  sholat: 'Sholat',
  shalat: 'Sholat',
  'bacaan sholat': 'Sholat',
  'bacaan shalat': 'Sholat',
  'bacaan-shalat': 'Sholat',
  surat: 'Surat',
  'surat pendek': 'Surat',
  'surat-pendek': 'Surat',
};

const categoryDefinitionFor = (category) => {
  const categoryKey = CATEGORY_ALIASES[normalizeLabel(category?.key || category?.label || category?.id)];
  return QUIZ_HAFALAN_CATEGORIES.find((definition) => definition.key === categoryKey);
};

const normalizeJilid = (value) => {
  const match = String(value || '').match(/(?:jilid\s*)?(\d+)/i);
  return match && QUIZ_HAFALAN_JILIDS.includes(match[1]) ? match[1] : null;
};

const createDefaultJilids = () => Object.fromEntries(
  QUIZ_HAFALAN_JILIDS.map((jilid) => [jilid, true])
);

const readJilidEnabled = (rawJilidConfig, jilid, legacySelectedJilids) => {
  if (Array.isArray(legacySelectedJilids)) {
    return legacySelectedJilids.some((value) => normalizeJilid(value) === jilid);
  }

  if (!rawJilidConfig || typeof rawJilidConfig !== 'object') return true;

  const rawValue = rawJilidConfig[jilid] ?? rawJilidConfig[`Jilid ${jilid}`];
  if (typeof rawValue === 'boolean') return rawValue;
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    return rawValue.enabled !== false;
  }
  if (Array.isArray(rawValue)) return true;
  return rawValue === undefined;
};

export const createDefaultQuizHafalanConfig = () => ({
  version: 2,
  categories: QUIZ_HAFALAN_CATEGORIES.map((definition) => ({
    ...definition,
    enabled: true,
    jilids: createDefaultJilids(),
  })),
});

export const normalizeQuizHafalanConfig = (content) => {
  const sourceCategories = Array.isArray(content)
    ? content
    : Array.isArray(content?.categories)
      ? content.categories
      : [];
  const legacySelectedJilids = content && !Array.isArray(content) && content.selectedJilids && typeof content.selectedJilids === 'object'
    ? content.selectedJilids
    : {};

  return {
    version: 2,
    categories: QUIZ_HAFALAN_CATEGORIES.map((definition) => {
      const source = sourceCategories.find((category) => categoryDefinitionFor(category)?.key === definition.key);
      const selectedForSource = source
        ? legacySelectedJilids[source.id] ?? legacySelectedJilids[source.key] ?? legacySelectedJilids[definition.id]
        : legacySelectedJilids[definition.id] ?? legacySelectedJilids[definition.key];

      return {
        ...definition,
        enabled: source?.enabled !== false,
        jilids: Object.fromEntries(
          QUIZ_HAFALAN_JILIDS.map((jilid) => [
            jilid,
            readJilidEnabled(source?.jilids, jilid, selectedForSource),
          ])
        ),
      };
    }),
  };
};

export const getEnabledQuizJilids = (category) => QUIZ_HAFALAN_JILIDS.filter(
  (jilid) => category?.jilids?.[jilid] === true
);

export const getQuizCategoryByBackendKey = (categoryKey) => {
  const canonicalKey = CATEGORY_ALIASES[normalizeLabel(categoryKey)] || categoryKey;
  return QUIZ_HAFALAN_CATEGORIES.find((category) => category.key === canonicalKey) || null;
};

export const normalizeQuizItemJilid = normalizeJilid;
