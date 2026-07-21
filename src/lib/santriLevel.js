const FALLBACK_LEVELS = [
  { name: 'Pemula', min: 0, max: 100, color: '#3b82f6' },
  { name: 'Menengah', min: 101, max: 300, color: '#22c55e' },
  { name: 'Mahir', min: 301, max: Number.POSITIVE_INFINITY, color: '#eab308' },
];

const normalizeGenderKey = (gender) => {
  const value = String(gender || '').toLowerCase();
  return value.includes('perempuan') || value.includes('putri') || value === 'p'
    ? 'female'
    : 'male';
};

const parseLevelConfig = (config) => {
  if (typeof config !== 'string') return config;
  try {
    return JSON.parse(config);
  } catch {
    return null;
  }
};

const toLevelArray = (value) => {
  if (Array.isArray(value)) return value.filter((level) => level && typeof level === 'object');
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).filter((level) => level && typeof level === 'object' && !Array.isArray(level));
};

export const normalizeLevelConfigShape = (config) => {
  const parsed = parseLevelConfig(config);
  if (!parsed || typeof parsed !== 'object') return { male: [], female: [] };

  if (Array.isArray(parsed)) {
    const sharedLevels = toLevelArray(parsed);
    return { male: sharedLevels, female: sharedLevels };
  }

  const hasGenderGroups = ['male', 'female', 'putra', 'putri', 'laki_laki', 'perempuan']
    .some((key) => Object.prototype.hasOwnProperty.call(parsed, key));
  const sharedLevels = hasGenderGroups ? [] : toLevelArray(parsed);

  return {
    male: toLevelArray(parsed.male ?? parsed.putra ?? parsed.laki_laki ?? sharedLevels),
    female: toLevelArray(parsed.female ?? parsed.putri ?? parsed.perempuan ?? sharedLevels),
  };
};

export const resolveSantriLevel = ({ points = 0, gender, config }) => {
  const safePoints = Math.max(0, Number(points) || 0);
  const configuredLevels = normalizeLevelConfigShape(config)[normalizeGenderKey(gender)];
  const levels = Array.isArray(configuredLevels) && configuredLevels.length > 0
    ? configuredLevels
    : FALLBACK_LEVELS;

  const matched = levels.find((level) => {
    const min = Number(level.min ?? 0);
    const max = Number(level.max ?? Number.POSITIVE_INFINITY);
    return safePoints >= min && safePoints <= max;
  }) || levels[levels.length - 1] || FALLBACK_LEVELS[0];

  const accentColor = matched.accentColor || matched.color || '#0ea5e9';

  return {
    name: matched.name || 'Pemula',
    min: Number(matched.min ?? 0),
    max: Number(matched.max ?? Number.POSITIVE_INFINITY),
    accentColor,
    textColor: matched.textColor || accentColor,
    cardBgColor: matched.cardBgColor || '#ffffff',
    cardBorderThickness: matched.cardDepth ?? matched.cardBorderThickness ?? 8,
    avatarBorderThickness: matched.avatarDepth ?? matched.avatarBorderThickness ?? 4,
    enableGradient: matched.enableGradient ?? true,
    textGradient: matched.textGradient ?? true,
  };
};

export { FALLBACK_LEVELS };
