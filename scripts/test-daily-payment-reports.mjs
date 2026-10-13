import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { buildDailyPaymentReportData } from '../src/lib/dailyPaymentRecap.js';
import { buildDailyPaymentHtml, buildDailyPaymentPdf, getDailyReportFilename } from '../src/lib/dailyPaymentReportAdapters.js';
import { buildDailyPaymentWorkbook } from '../src/lib/dailyPaymentExcelReport.js';

const report = buildDailyPaymentReportData({
  payments: Array.from({ length: 80 }, (_, index) => ({
    id: `p${index}`, santri_id: index % 2 ? 'adult' : 'tpq', jumlah: 100000.25,
    created_at: '2026-08-03T01:00:00Z', tanggal_pembayaran: '2026-08-03', bulan: 8, tahun: 2026,
    catatan: index % 4 === 1 ? 'SPP Bulanan (Agustus 2026)' : 'Buku Prestasi (Qty: 1)',
    metode_pembayaran: index % 3 ? 'Tunai' : 'Transfer Bank', transaction_id: `0000-${index}-12345678-12345678-12345678`,
  })),
  santri: [
    { id: 'adult', kategori: 'Dewasa', nama_lengkap: 'Santri Dewasa Dengan Nama Yang Sangat Panjang Untuk Uji Laporan', nomor_induk_qiroati: '000001234', current_class: { nama_kelas: 'Kelas Dewasa Malam' } },
    { id: 'tpq', kategori: 'TPQ', nama_lengkap: 'Santri TPQ <script>alert(1)</script>', nomor_induk_qiroati: '000009876', current_class: { nama_kelas: 'Kelas Pagi' } },
  ],
  expenses: [{ id: 'e1', kategori: 'Operasional', deskripsi: 'Pengeluaran operasional harian dengan keterangan yang panjang untuk memeriksa pembungkusan teks.', jumlah: 12345.67 }],
  date: '2026-08-03', periodLabel: '3 Agustus 2026', method: 'all', methodLabel: 'Semua Metode',
  generatedAt: '2026-08-03T04:00:00Z',
});
assert.equal(getDailyReportFilename(report, 'xlsx'), 'rekap-harian-2026-08-03-all.xlsx');
const html = buildDailyPaymentHtml(report);
assert.ok(html.includes('Total SPP Dewasa'));
assert.ok(html.includes('YAYASAN GRIYA MUDA'));
assert.ok(html.includes('&lt;script&gt;'));
assert.ok(!html.includes('<script>alert(1)</script>'));
assert.ok(html.includes('Total SPP Dewasa</td>'));
assert.ok(html.includes('Pengeluaran operasional'));

const workbook = await buildDailyPaymentWorkbook(report);
const buffer = await workbook.xlsx.writeBuffer();
const reopened = new ExcelJS.Workbook();
await reopened.xlsx.load(buffer);
assert.deepEqual(reopened.worksheets.map((sheet) => sheet.name), ['Ringkasan', 'Transaksi', 'SPP Dewasa', 'Pengeluaran']);
assert.equal(reopened.getWorksheet('Ringkasan').getCell('D14').value, report.summary.adultSppTotal);
assert.equal(reopened.getWorksheet('Ringkasan').getCell('D16').value, report.summary.netBalance);
const transactions = reopened.getWorksheet('Transaksi');
assert.equal(transactions.getCell('D11').value, '000009876');
assert.equal(typeof transactions.getCell('J11').value, 'string');
assert.equal(typeof transactions.getCell('I11').value, 'number');
assert.ok(transactions.getCell('I11').numFmt.includes('Rp'));
assert.equal(transactions.getCell('A10').fill.fgColor.argb, 'FF0F766E');
assert.equal(transactions.views[0].ySplit, 10);
assert.equal(transactions.pageSetup.paperSize, 9);
assert.equal(transactions.pageSetup.printTitlesRow, '1:10');
assert.ok(transactions.autoFilter);
assert.equal(transactions.getCell('I92').value, report.summary.total);
assert.equal(reopened.getWorksheet('SPP Dewasa').getCell('I32').value, report.summary.adultSppTotal);
assert.equal(reopened.getWorksheet('SPP Dewasa').getCell('J32').value, null);
assert.equal(transactions.getCell('D11').type, ExcelJS.ValueType.String);
assert.equal(transactions.getCell('A5').border.bottom.style, 'medium');

const pdf = buildDailyPaymentPdf(report);
assert.ok(pdf.getNumberOfPages() >= 4);
const pdfText = pdf.output();
assert.ok(pdfText.includes('Total SPP Dewasa'));
assert.ok(pdfText.includes('Halaman 1 dari'));
assert.ok(pdfText.includes('No Induk'));

const empty = buildDailyPaymentReportData({ ...report, payments: [], santri: [], expenses: [] });
const emptyWorkbook = await buildDailyPaymentWorkbook(empty);
assert.match(emptyWorkbook.getWorksheet('SPP Dewasa').getCell('A11').value, /Belum ada pembayaran SPP Dewasa/);
assert.equal(emptyWorkbook.getWorksheet('SPP Dewasa').getCell('I13').value, 0);
assert.equal(emptyWorkbook.getWorksheet('Ringkasan').getCell('D14').value, 0);
assert.ok(buildDailyPaymentPdf(empty).getNumberOfPages() >= 1);
assert.ok(buildDailyPaymentHtml(empty).includes('Belum ada pembayaran SPP Dewasa'));

// Opsional: simpan sampel untuk QA visual, tidak diperlukan oleh regression test.
const outputDirectory = process.argv[2];
if (outputDirectory) {
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(path.join(outputDirectory, 'daily-report.xlsx'), buffer);
  await fs.writeFile(path.join(outputDirectory, 'daily-report.pdf'), Buffer.from(pdf.output('arraybuffer')));
  await fs.writeFile(path.join(outputDirectory, 'daily-report.html'), html);
}
console.log(`Daily report regression tests passed (4 Excel sheets, HTML escaping, empty data, ${pdf.getNumberOfPages()} PDF pages).`);
