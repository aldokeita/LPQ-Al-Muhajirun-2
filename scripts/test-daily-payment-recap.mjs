import assert from 'node:assert/strict';
import {
  buildDailyPaymentSummary,
  enrichDailyPayments,
  filterDailyPayments,
  getDailyPaymentDateKey,
  getPaymentDateParts,
  normalizePaymentMethod,
} from '../src/lib/dailyPaymentRecap.js';

const payments = [
  { id: 'cash', santri_id: 's1', tanggal_pembayaran: '2026-08-03', created_at: '2026-08-03T01:00:00Z', jumlah: '100000.00', metode_pembayaran: 'Tunai', status: 'paid', deleted_at: null, bulan: 8, tahun: 2026 },
  { id: 'transfer', santri_id: 's2', tanggal_pembayaran: '2026-08-03', created_at: '2026-08-03T02:00:00Z', jumlah: '50000.00', metode_pembayaran: 'Transfer Bank', status: 'paid', deleted_at: null, bulan: 8, tahun: 2026 },
  { id: 'deleted', santri_id: 's1', tanggal_pembayaran: '2026-08-03', created_at: '2026-08-03T03:00:00Z', jumlah: '90000.00', metode_pembayaran: 'Tunai', status: 'paid', deleted_at: '2026-08-03T04:00:00Z' },
  { id: 'unpaid', santri_id: 's1', tanggal_pembayaran: '2026-08-03', created_at: '2026-08-03T05:00:00Z', jumlah: '90000.00', metode_pembayaran: 'Tunai', status: 'unpaid', deleted_at: null },
  { id: 'other-day', santri_id: 's1', tanggal_pembayaran: '2026-08-02', created_at: '2026-08-02T01:00:00Z', jumlah: '75000.00', metode_pembayaran: 'Tunai', status: 'paid', deleted_at: null },
];

assert.deepEqual(getPaymentDateParts('2026-08-03'), { year: 2026, month: 8, day: 3 });
assert.equal(getDailyPaymentDateKey({ day: 3, month: 8, year: 2026 }), '2026-08-03');
assert.equal(normalizePaymentMethod('Tunai'), 'cash');
assert.equal(normalizePaymentMethod('Transfer Bank'), 'transfer');

const allForDay = filterDailyPayments(payments, { day: 3, month: 8, year: 2026, method: 'all' });
assert.deepEqual(allForDay.map((payment) => payment.id), ['transfer', 'cash']);
assert.deepEqual(buildDailyPaymentSummary(allForDay), { total: 150000, cash: 100000, transfer: 50000, other: 0, count: 2 });

const transfers = filterDailyPayments(payments, { day: 3, month: 8, year: 2026, method: 'transfer' });
assert.deepEqual(transfers.map((payment) => payment.id), ['transfer']);

const detailed = enrichDailyPayments(allForDay, [
  { id: 's1', nama_lengkap: 'Santri Satu', nomor_induk_qiroati: 'TEST001', current_class: { nama_kelas: 'Pagi A' } },
  { id: 's2', nama_lengkap: 'Santri Dua', nomor_induk_qiroati: 'TEST002', current_class: null },
]);
assert.equal(detailed[0].nama_santri, 'Santri Dua');
assert.equal(detailed[1].kelas, 'Pagi A');
assert.equal(detailed[1].periode, 'Agustus 2026');

console.log('Daily payment recap tests: 10/10 passed');
