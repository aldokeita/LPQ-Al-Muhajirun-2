import assert from 'node:assert/strict';
import {
  buildDailyPaymentSummary,
  buildDailyPaymentReportData,
  enrichDailyPayments,
  filterDailyPayments,
  getDailyPaymentDateKey,
  getPaymentDateParts,
  getPaymentCategory,
  normalizePaymentMethod,
} from '../src/lib/dailyPaymentRecap.js';

const payments = [
  { id: 'cash', santri_id: 's1', tanggal_pembayaran: '2026-08-03', created_at: '2026-08-03T01:00:00Z', jumlah: '100000.00', metode_pembayaran: 'Tunai', status: 'paid', deleted_at: null, bulan: 8, tahun: 2026, catatan: 'SPP (Agustus 2026)' },
  { id: 'transfer', santri_id: 's2', tanggal_pembayaran: '2026-08-03', created_at: '2026-08-03T02:00:00Z', jumlah: '50000.00', metode_pembayaran: 'Transfer Bank', status: 'paid', deleted_at: null, bulan: 8, tahun: 2026, catatan: 'SPP (Agustus 2026)' },
  { id: 'non-spp', santri_id: 's1', tanggal_pembayaran: '2026-08-03', created_at: '2026-08-03T02:30:00Z', jumlah: '25000.00', metode_pembayaran: 'Tunai', status: 'paid', deleted_at: null, catatan: 'Buku Prestasi (Qty: 1)' },
  { id: 'deleted', santri_id: 's1', tanggal_pembayaran: '2026-08-03', created_at: '2026-08-03T03:00:00Z', jumlah: '90000.00', metode_pembayaran: 'Tunai', status: 'paid', deleted_at: '2026-08-03T04:00:00Z', catatan: 'SPP (Agustus 2026)' },
  { id: 'unpaid', santri_id: 's1', tanggal_pembayaran: '2026-08-03', created_at: '2026-08-03T05:00:00Z', jumlah: '90000.00', metode_pembayaran: 'Tunai', status: 'unpaid', deleted_at: null, catatan: 'SPP (Agustus 2026)' },
  { id: 'other-day', santri_id: 's1', tanggal_pembayaran: '2026-08-02', created_at: '2026-08-02T01:00:00Z', jumlah: '75000.00', metode_pembayaran: 'Tunai', status: 'paid', deleted_at: null, catatan: 'SPP (Agustus 2026)' },
];

assert.deepEqual(getPaymentDateParts('2026-08-03'), { year: 2026, month: 8, day: 3 });
assert.equal(getDailyPaymentDateKey({ day: 3, month: 8, year: 2026 }), '2026-08-03');
assert.equal(normalizePaymentMethod('Tunai'), 'cash');
assert.equal(normalizePaymentMethod('Transfer Bank'), 'transfer');
assert.equal(getPaymentCategory(payments[0].catatan), 'SPP');
assert.equal(getPaymentCategory(payments[2].catatan), 'Buku Prestasi');

const allForDay = filterDailyPayments(payments, { day: 3, month: 8, year: 2026, method: 'all' });
assert.deepEqual(allForDay.map((payment) => payment.id), ['non-spp', 'transfer', 'cash']);
assert.deepEqual(buildDailyPaymentSummary(allForDay), { total: 175000, cash: 125000, transfer: 50000, other: 0, count: 3 });

const transfers = filterDailyPayments(payments, { day: 3, month: 8, year: 2026, method: 'transfer' });
assert.deepEqual(transfers.map((payment) => payment.id), ['transfer']);

const detailed = enrichDailyPayments(allForDay, [
  { id: 's1', nama_lengkap: 'Santri Satu', nomor_induk_qiroati: 'TEST001', current_class: { nama_kelas: 'Pagi A' } },
  { id: 's2', nama_lengkap: 'Santri Dua', nomor_induk_qiroati: 'TEST002', current_class: null },
]);
assert.equal(detailed[0].nama_santri, 'Santri Satu');
assert.equal(detailed[1].kelas, '-');
assert.equal(detailed[2].periode, 'Agustus 2026');

const mixedSantri = [
  { id: 'tpq', kategori: 'Anak', nama_lengkap: 'Santri TPQ' },
  { id: 'ptpt', kategori: 'PTPT', nama_lengkap: 'Santri PTPT' },
  { id: 'adult', kategori: '  dEWaSa  ', status: 'Nonaktif', nama_lengkap: 'Santri Dewasa', nomor_induk_qiroati: '0000123' },
  { id: 'unknown', kategori: '', nama_lengkap: 'Kategori kosong' },
];
const makePayment = (id, owner, note, amount, overrides = {}) => ({
  ...payments[0], id, santri_id: owner, catatan: note, jumlah: amount, ...overrides,
});
const mixedPayments = [
  makePayment('tpq-spp', 'tpq', 'SPP Bulanan', '100000.10'),
  makePayment('ptpt-spp', 'ptpt', 'SPP', '150000.20'),
  makePayment('adult-cash', 'adult', '  spp Bulanan (Agustus 2026)', '50000.10'),
  makePayment('adult-transfer', 'adult', 'SPP (50k)', '50000.20', { metode_pembayaran: 'Transfer Bank' }),
  makePayment('adult-book', 'adult', 'Buku Prestasi', '20000.30'),
  makePayment('not-spp-prefix', 'adult', 'SPPT', '1000.40'),
  makePayment('not-spp', 'adult', 'Buku SPP', '1000.50'),
  makePayment('unknown-spp', 'unknown', 'SPP', '1000.60'),
  makePayment('missing-owner', 'missing', 'SPP', '1000.70'),
  makePayment('deleted-adult', 'adult', 'SPP', '999', { deleted_at: '2026-08-03' }),
  makePayment('unpaid-adult', 'adult', 'SPP', '999', { status: 'unpaid' }),
  makePayment('other-date-adult', 'adult', 'SPP', '999', { tanggal_pembayaran: '2026-08-02' }),
];
const dailyFilters = { day: 3, month: 8, year: 2026, method: 'all' };
const report = buildDailyPaymentReportData({
  payments: filterDailyPayments(mixedPayments, dailyFilters), santri: mixedSantri,
  expenses: [{ jumlah: '10000.10' }, { jumlah: '10000.20' }],
});
assert.deepEqual(report.adultSppPayments.map((payment) => payment.id).sort(), ['adult-cash', 'adult-transfer']);
assert.equal(report.summary.adultSppTotal, 100000.30);
assert.equal(report.summary.total, 374003.10);
assert.equal(report.summary.expenseTotal, 20000.30);
assert.equal(report.summary.netBalance, 354002.80);
assert.equal(report.summary.count, 9);
assert.equal(report.adultSppPayments[0].nomor_induk, '0000123');
const transferReport = buildDailyPaymentReportData({
  payments: filterDailyPayments(mixedPayments, { ...dailyFilters, method: 'transfer' }), santri: mixedSantri,
});
assert.equal(transferReport.summary.adultSppTotal, 50000.20);
assert.equal(transferReport.summary.total, 50000.20);
const emptyReport = buildDailyPaymentReportData({});
assert.equal(emptyReport.summary.adultSppTotal, 0);
assert.equal(emptyReport.summary.netBalance, 0);
assert.deepEqual(emptyReport.adultSppPayments, []);
console.log('Daily payment recap regression tests passed (including adult SPP, historical owners, filters, and decimal totals).');
