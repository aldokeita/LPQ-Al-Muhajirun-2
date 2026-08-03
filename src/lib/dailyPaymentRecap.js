import { formatPaymentPeriod } from './paymentAdapters.js';

export const DAILY_PAYMENT_METHODS = {
  all: 'Semua Metode',
  cash: 'Cash',
  transfer: 'Transfer',
};

const padNumber = (value) => String(value).padStart(2, '0');

export const getJakartaDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    day: Number(values.day),
    month: Number(values.month),
    year: Number(values.year),
  };
};

export const getPaymentDateParts = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

export const normalizePaymentMethod = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('transfer')) return 'transfer';
  if (normalized === 'cash' || normalized.includes('tunai')) return 'cash';
  return 'other';
};

export const getPaymentCategory = (value) => {
  const note = String(value || '').trim();
  if (!note) return 'Lainnya';
  return note.replace(/\s*\([^)]*\)\s*$/, '').trim() || 'Lainnya';
};

const amountToCents = (value) => {
  const normalized = String(value ?? '0').trim().replace(',', '.');
  const match = normalized.match(/^(-?\d+)(?:\.(\d{1,2}))?/);
  if (!match) return 0;
  const whole = Number(match[1]);
  const fraction = Number((match[2] || '').padEnd(2, '0'));
  return whole * 100 + (whole < 0 ? -fraction : fraction);
};

export const formatRupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

export const formatJakartaTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace('.', ':');
};

export const getDailyPaymentDateKey = ({ day, month, year }) => (
  `${year}-${padNumber(month)}-${padNumber(day)}`
);

export const filterDailyPayments = (payments = [], filters = {}) => {
  const selectedMethod = filters.method || 'all';

  return payments
    .filter((payment) => {
      if (payment?.deleted_at || payment?.status !== 'paid') return false;
      const dateParts = getPaymentDateParts(payment.tanggal_pembayaran);
      if (!dateParts) return false;
      const dateMatches = dateParts.day === Number(filters.day)
        && dateParts.month === Number(filters.month)
        && dateParts.year === Number(filters.year);
      const methodMatches = selectedMethod === 'all'
        || normalizePaymentMethod(payment.metode_pembayaran) === selectedMethod;
      return dateMatches && methodMatches;
    })
    .sort((a, b) => new Date(b.created_at || b.tanggal_pembayaran) - new Date(a.created_at || a.tanggal_pembayaran));
};

export const buildDailyPaymentSummary = (payments = []) => {
  const totals = payments.reduce((summary, payment) => {
    const cents = amountToCents(payment.jumlah);
    summary.totalCents += cents;
    const method = normalizePaymentMethod(payment.metode_pembayaran);
    if (method === 'cash') summary.cashCents += cents;
    if (method === 'transfer') summary.transferCents += cents;
    if (method === 'other') summary.otherCents += cents;
    return summary;
  }, { totalCents: 0, cashCents: 0, transferCents: 0, otherCents: 0 });

  return {
    total: totals.totalCents / 100,
    cash: totals.cashCents / 100,
    transfer: totals.transferCents / 100,
    other: totals.otherCents / 100,
    count: payments.length,
  };
};

export const enrichDailyPayments = (payments = [], santri = []) => {
  const santriMap = new Map(santri.map((item) => [item.id, item]));

  return payments.map((payment) => {
    const owner = santriMap.get(payment.santri_id);
    return {
      ...payment,
      nama_santri: owner?.nama_lengkap || 'Santri tidak ditemukan',
      nomor_induk: owner?.nomor_induk_qiroati || '-',
      kelas: owner?.current_class?.nama_kelas || '-',
      periode: formatPaymentPeriod(payment.bulan, payment.tahun),
      kategori_pembayaran: getPaymentCategory(payment.catatan),
      waktu: formatJakartaTime(payment.created_at),
      metode_label: normalizePaymentMethod(payment.metode_pembayaran) === 'cash'
        ? 'Cash'
        : normalizePaymentMethod(payment.metode_pembayaran) === 'transfer'
          ? 'Transfer'
          : payment.metode_pembayaran || 'Lainnya',
    };
  });
};
