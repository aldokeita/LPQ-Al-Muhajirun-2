export const CLASS_ATTENDANCE_PRINT_CONFIG_KEY = 'classAttendancePrintConfig';
export const CLASS_ATTENDANCE_QIROATI_LOGO_KEY = 'qiroatiLogoUrl';

export const CLASS_ATTENDANCE_HEADER_FONTS = {
  cinzel: {
    label: 'Cinzel elegan',
    stack: "'Cinzel', Georgia, 'Times New Roman', serif",
  },
  serif: {
    label: 'Klasik institusional',
    stack: "Georgia, 'Times New Roman', serif",
  },
  sans: {
    label: 'Modern profesional',
    stack: 'Arial, Helvetica, sans-serif',
  },
  rounded: {
    label: 'Ramah dan lembut',
    stack: "'Trebuchet MS', Arial, sans-serif",
  },
  condensed: {
    label: 'Ringkas formal',
    stack: "'Arial Narrow', Arial, sans-serif",
  },
};

export const DEFAULT_CLASS_ATTENDANCE_PRINT_CONFIG = {
  version: 1,
  content: {
    yayasanName: 'YAYASAN GRIYA MUDA QUR\u2019ANI',
    institutionEyebrow: 'LEMBAGA PENDIDIKAN QURAN',
    institutionName: 'LPQ AL-MUHAJIRUN',
    address: 'Jl. R. Suprapto No. 195, Kemalaraja, Baturaja, Sumatera Selatan',
    documentCategory: 'ABSENSI KELAS',
    teacherLabel: 'NAMA GURU',
    classLabel: 'KELAS',
    sessionLabel: 'SESI',
    createdLabel: 'DIBUAT',
    pageLabel: 'Halaman',
    numberColumn: 'NO',
    nameColumn: 'NAMA',
    levelColumn: 'JILID',
    phoneColumn: 'NO HP',
    monthColumn: 'BULAN',
    progressColumn: 'JILID & HAL\nAWAL\u2013AKHIR',
    percentageColumn: 'PERSENTASE',
    teacherAttendanceLabel: 'ABSEN GURU',
    notesLabel: 'Catatan:',
    absenceLabel: 'Absen:',
    substituteLabel: 'Menggantikan:',
    printButtonLabel: 'Cetak A4',
    privacyNotice: 'Dokumen ini memuat data pribadi santri. Simpan dan bagikan hanya untuk kebutuhan resmi LPQ Al-Muhajirun.',
  },
  typography: {
    headerFont: 'serif',
    yayasanFont: 'serif',
    yayasanSize: 10,
    yayasanOffsetY: 0,
    eyebrowFont: 'serif',
    titleFont: 'serif',
    titleSize: 19,
    titleWeight: 700,
    titleItalic: false,
    titleUppercase: true,
    headerOffsetY: 0,
    addressFont: 'serif',
    addressOffsetY: 0,
    eyebrowSize: 8,
    addressSize: 6.5,
    categorySize: 7.5,
    tableHeaderSize: 6,
    tableHeaderWeight: 800,
    tableHeaderItalic: false,
    tableHeaderUppercase: true,
    bodySize: 6.5,
    bodyWeight: 400,
  },
  columnWidths: {
    number: 7,
    name: 41,
    jilid: 14,
    phone: 26,
    date: 5,
    progress: 32,
    percentage: 14,
  },
  branding: {
    showLpqLogo: true,
    showQiroatiLogo: true,
    lpqLogoSize: 21,
    qiroatiLogoSize: 21,
    headerColor: '#111827',
    headerTextColor: '#111827',
    accentColor: '#0369a1',
    tableHeaderBackground: '#22b8e6',
    tableHeaderText: '#082f49',
    sessionHeaderColors: {
      Pagi: '#16a34a',
      'Pagi 2': '#0d9488',
      Siang: '#2563eb',
      Sore: '#ea580c',
      Malam: '#374151',
    },
  },
};

const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_CLASS_ATTENDANCE_PRINT_CONFIG));

const normalizeText = (value, fallback, maxLength = 180) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || fallback;
};

const normalizeNumber = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

const normalizeWeight = (value, fallback) => {
  const parsed = Math.round(Number(value) / 100) * 100;
  return [400, 500, 600, 700, 800, 900].includes(parsed) ? parsed : fallback;
};

const normalizeColor = (value, fallback) => (
  /^#[0-9a-f]{6}$/i.test(String(value || '').trim()) ? String(value).trim().toLowerCase() : fallback
);

export const normalizeClassAttendancePrintConfig = (value) => {
  const defaults = cloneDefaults();
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const content = source.content && typeof source.content === 'object' ? source.content : {};
  const typography = source.typography && typeof source.typography === 'object' ? source.typography : {};
  const branding = source.branding && typeof source.branding === 'object' ? source.branding : {};
  const sourceWidths = source.columnWidths && typeof source.columnWidths === 'object' ? source.columnWidths : {};
  const defaultWidths = defaults.columnWidths;

  const normalizeFontKey = (val, fallback) => Object.hasOwn(CLASS_ATTENDANCE_HEADER_FONTS, val) ? val : fallback;

  return {
    version: 1,
    content: Object.fromEntries(Object.entries(defaults.content).map(([key, fallback]) => [
      key,
      normalizeText(content[key], fallback, key === 'privacyNotice' || key === 'address' ? 320 : 90),
    ])),
    typography: {
      headerFont: normalizeFontKey(typography.headerFont, defaults.typography.headerFont),
      yayasanFont: normalizeFontKey(typography.yayasanFont, defaults.typography.yayasanFont),
      yayasanSize: normalizeNumber(typography.yayasanSize, defaults.typography.yayasanSize, 6, 18),
      yayasanOffsetY: normalizeNumber(typography.yayasanOffsetY, defaults.typography.yayasanOffsetY, -12, 12),
      eyebrowFont: normalizeFontKey(typography.eyebrowFont, defaults.typography.eyebrowFont),
      titleFont: normalizeFontKey(typography.titleFont, defaults.typography.titleFont),
      titleSize: normalizeNumber(typography.titleSize, defaults.typography.titleSize, 12, 30),
      titleWeight: normalizeWeight(typography.titleWeight, defaults.typography.titleWeight),
      titleItalic: typography.titleItalic === true,
      titleUppercase: typography.titleUppercase !== false,
      headerOffsetY: normalizeNumber(typography.headerOffsetY, defaults.typography.headerOffsetY, -12, 12),
      addressFont: normalizeFontKey(typography.addressFont, defaults.typography.addressFont),
      addressOffsetY: normalizeNumber(typography.addressOffsetY, defaults.typography.addressOffsetY, -8, 8),
      eyebrowSize: normalizeNumber(typography.eyebrowSize, defaults.typography.eyebrowSize, 5, 14),
      addressSize: normalizeNumber(typography.addressSize, defaults.typography.addressSize, 5, 12),
      categorySize: normalizeNumber(typography.categorySize, defaults.typography.categorySize, 5, 14),
      tableHeaderSize: normalizeNumber(typography.tableHeaderSize, defaults.typography.tableHeaderSize, 5, 10),
      tableHeaderWeight: normalizeWeight(typography.tableHeaderWeight, defaults.typography.tableHeaderWeight),
      tableHeaderItalic: typography.tableHeaderItalic === true,
      tableHeaderUppercase: typography.tableHeaderUppercase !== false,
      bodySize: normalizeNumber(typography.bodySize, defaults.typography.bodySize, 5, 10),
      bodyWeight: normalizeWeight(typography.bodyWeight, defaults.typography.bodyWeight),
    },
    columnWidths: {
      number: normalizeNumber(sourceWidths.number, defaultWidths.number, 4, 15),
      name: normalizeNumber(sourceWidths.name, defaultWidths.name, 25, 60),
      jilid: normalizeNumber(sourceWidths.jilid, defaultWidths.jilid, 8, 25),
      phone: normalizeNumber(sourceWidths.phone, defaultWidths.phone, 15, 40),
      date: normalizeNumber(sourceWidths.date, defaultWidths.date, 3, 8),
      progress: normalizeNumber(sourceWidths.progress, defaultWidths.progress, 15, 50),
      percentage: normalizeNumber(sourceWidths.percentage, defaultWidths.percentage, 8, 25),
    },
    branding: {
      showLpqLogo: branding.showLpqLogo !== false,
      showQiroatiLogo: branding.showQiroatiLogo !== false,
      lpqLogoSize: normalizeNumber(branding.lpqLogoSize, defaults.branding.lpqLogoSize, 12, 25),
      qiroatiLogoSize: normalizeNumber(branding.qiroatiLogoSize, defaults.branding.qiroatiLogoSize, 12, 25),
      headerColor: normalizeColor(branding.headerColor, defaults.branding.headerColor),
      headerTextColor: normalizeColor(
        branding.headerTextColor,
        normalizeColor(branding.headerColor, defaults.branding.headerTextColor),
      ),
      accentColor: normalizeColor(branding.accentColor, defaults.branding.accentColor),
      tableHeaderBackground: normalizeColor(branding.tableHeaderBackground, defaults.branding.tableHeaderBackground),
      tableHeaderText: normalizeColor(branding.tableHeaderText, defaults.branding.tableHeaderText),
      sessionHeaderColors: Object.fromEntries(
        Object.entries(defaults.branding.sessionHeaderColors).map(([name, fallback]) => [
          name,
          normalizeColor(
            branding.sessionHeaderColors?.[name],
            normalizeColor(branding.tableHeaderBackground, fallback),
          ),
        ]),
      ),
    },
  };
};

export const getClassAttendanceMonthHeaderLabel = (config, monthLabel) => {
  const configuredLabel = String(config?.content?.monthColumn || '').trim();
  const defaultLabel = String(DEFAULT_CLASS_ATTENDANCE_PRINT_CONFIG.content.monthColumn || '').trim();

  return configuredLabel && configuredLabel !== defaultLabel
    ? configuredLabel
    : monthLabel;
};

export const getClassAttendanceHeaderFontStack = (fontKey) => (
  CLASS_ATTENDANCE_HEADER_FONTS[fontKey]?.stack || CLASS_ATTENDANCE_HEADER_FONTS.serif.stack
);
