const FALLBACK_LEVELS = [
  { name: 'Santri Biasa', min: 0, max: 20, color: '#22c55e' },
  { name: 'Santri Rajin', min: 21, max: 50, color: '#0ea5e9' },
  { name: 'Santri Super', min: 51, max: 80, color: '#f59e0b' },
  { name: 'Santri Legend', min: 81, max: Number.POSITIVE_INFINITY, color: '#ef4444' },
];

const normalizeGenderKey = (gender) => {
  const value = String(gender || '').toLowerCase();
  return value.includes('perempuan') || value.includes('putri') || value === 'p'
    ? 'female'
    : 'male';
};

export const resolveSantriLevel = ({ points = 0, gender, config }) => {
  const safePoints = Math.max(0, Number(points) || 0);
  const configuredLevels = config?.[normalizeGenderKey(gender)];
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
    name: matched.name || 'Santri Biasa',
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
