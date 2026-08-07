export const HIJAIYAH_LETTERS = [
  { char: 'ا', name: 'Alif' },
  { char: 'ب', name: 'Ba' },
  { char: 'ت', name: 'Ta' },
  { char: 'ث', name: 'Tsa' },
  { char: 'ج', name: 'Jim' },
  { char: 'ح', name: 'Ha' },
  { char: 'خ', name: 'Kho' },
  { char: 'د', name: 'Dal' },
  { char: 'ذ', name: 'Dzal' },
  { char: 'ر', name: 'Ro' },
  { char: 'ز', name: 'Zay' },
  { char: 'س', name: 'Sin' },
  { char: 'ش', name: 'Syin' },
  { char: 'ص', name: 'Shod' },
  { char: 'ض', name: 'Dhod' },
  { char: 'ط', name: 'Tho' },
  { char: 'ظ', name: 'Zho' },
  { char: 'ع', name: 'Ain' },
  { char: 'غ', name: 'Ghoin' },
  { char: 'ف', name: 'Fa' },
  { char: 'ق', name: 'Qof' },
  { char: 'ك', name: 'Kaf' },
  { char: 'ل', name: 'Lam' },
  { char: 'م', name: 'Mim' },
  { char: 'ن', name: 'Nun' },
  { char: 'ه', name: 'Ha' },
  { char: 'و', name: 'Waw' },
  { char: 'ي', name: 'Ya' },
];

export const HARAKAT = [
  { id: 'fathah', symbol: 'َ', name: 'Fathah', sound: 'a' },
  { id: 'kasrah', symbol: 'ِ', name: 'Kasrah', sound: 'i' },
  { id: 'dhammah', symbol: 'ُ', name: 'Dhammah', sound: 'u' },
];

export const HARAKAT_READING = {
  fathah: (letter) => `${letter} (a)`,
  kasrah: (letter) => `${letter} (i)`,
  dhammah: (letter) => `${letter} (u)`,
};

export const MODES = [
  {
    id: 'tracing',
    label: 'Menebalkan',
    subtitle: 'Tebalkan huruf dengan harakat',
    description: 'Sentuh dan tebalkan garis huruf hijaiyah bersama harakat fathah, kasrah, atau dhammah.',
    color: '#10b981',
    pointsPerRound: 2,
  },
  {
    id: 'matching',
    label: 'Memasangkan',
    subtitle: 'Huruf ↔ harakat',
    description: 'Pasangkan huruf hijaiyah dengan harakat yang tepat.',
    color: '#8b5cf6',
    pointsPerRound: 3,
  },
  {
    id: 'finding',
    label: 'Mencari',
    subtitle: 'Temukan huruf',
    description: 'Cari dan temukan huruf hijaiyah yang diminta pada kumpulan huruf.',
    color: '#f59e0b',
    pointsPerRound: 1,
  },
];

export const JILID_OPTIONS = [
  { value: '1', label: 'Jilid 1 — Pengenalan huruf & fathah' },
  { value: '2', label: 'Jilid 2 — Fathah, kasrah, dhammah' },
  { value: '3', label: 'Jilid 3 — Gabungan harakat' },
];
