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
  { id: 'fathah', symbol: '\u064E', name: 'Fathah', sound: 'a' },
  { id: 'kasrah', symbol: '\u0650', name: 'Kasrah', sound: 'i' },
  { id: 'dhammah', symbol: '\u064F', name: 'Dhammah', sound: 'u' },
];

export const combineLetterHarakat = (char, harakatSymbol) => `${char}${harakatSymbol}`;

export const readLetterHarakat = (char, harakat) => {
  const name = HIJAIYAH_LETTERS.find((l) => l.char === char)?.name || char;
  const reading = combineLetterHarakat(char, harakat.symbol);
  return `${reading} — ${name} ${harakat.name}`;
};

export const MODES = [
  {
    id: 'tracing',
    label: 'Menebalkan',
    subtitle: 'Tebalkan huruf berharakat',
    description: 'Guru membacakan huruf beserta harakatnya. Tebalkan huruf hijaiyah yang tampil di layar.',
    color: '#10b981',
  },
  {
    id: 'matching',
    label: 'Memasangkan',
    subtitle: 'Seret huruf & harakat',
    description: 'Guru menyebutkan huruf dengan harakatnya. Seret huruf dan harakat ke kotak jawaban.',
    color: '#8b5cf6',
  },
  {
    id: 'finding',
    label: 'Mencari',
    subtitle: 'Temukan di pemandangan',
    description: 'Guru mengucapkan sebuah huruf. Carilah huruf itu yang tersembunyi di dalam gambar.',
    color: '#f59e0b',
  },
];

export const REWARD_OPTIONS = [1, 3, 5];
