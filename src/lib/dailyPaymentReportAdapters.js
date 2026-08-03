import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatRupiah } from './dailyPaymentRecap.js';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export const buildDailyPaymentReportRows = (payments = []) => payments.map((payment, index) => [
  index + 1,
  payment.waktu,
  payment.nama_santri,
  payment.kelas,
  payment.kategori_pembayaran,
  payment.periode,
  payment.metode_label,
  formatRupiah(payment.jumlah),
  payment.transaction_id || '-',
]);

export const printDailyPaymentHtml = ({ payments, summary, periodLabel, methodLabel }) => {
  const rows = buildDailyPaymentReportRows(payments);
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) throw new Error('Browser memblokir jendela laporan. Izinkan pop-up lalu coba lagi.');
  printWindow.opener = null;

  const tableRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
  printWindow.document.write(`<!doctype html>
    <html lang="id"><head><meta charset="utf-8"><title>Rekap Harian</title>
    <style>
      body{font-family:Arial,sans-serif;color:#172033;margin:32px}h1{font-size:22px;margin:0 0 6px}p{margin:3px 0;color:#536078}
      .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:22px 0}.card{border:1px solid #dce4ee;padding:12px;border-radius:6px}.card strong{display:block;margin-top:6px;color:#0f766e}
      table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #dce4ee;padding:8px;text-align:left}th{background:#eff6f5}td:nth-child(7){text-align:right}footer{margin-top:18px;font-size:10px;color:#7b8798}
    </style></head><body>
    <h1>Rekap Harian</h1><p>LPQ Al-Muhajirun</p><p>${escapeHtml(periodLabel)} · ${escapeHtml(methodLabel)}</p>
    <section class="summary"><div class="card">Total<strong>${escapeHtml(formatRupiah(summary.total))}</strong></div><div class="card">Cash<strong>${escapeHtml(formatRupiah(summary.cash))}</strong></div><div class="card">Transfer<strong>${escapeHtml(formatRupiah(summary.transfer))}</strong></div><div class="card">Transaksi<strong>${summary.count}</strong></div></section>
    <table><thead><tr><th>No</th><th>Waktu</th><th>Santri</th><th>Kelas</th><th>Kategori</th><th>Periode</th><th>Metode</th><th>Nominal</th><th>ID Transaksi</th></tr></thead><tbody>${tableRows}</tbody></table>
    <footer>Dicetak ${escapeHtml(new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }))} WIB</footer>
    <script>window.onload=()=>{window.print();};</script></body></html>`);
  printWindow.document.close();
};

export const downloadDailyPaymentPdf = ({ payments, summary, periodLabel, methodLabel }) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(16);
  doc.text('Rekap Harian', 14, 15);
  doc.setFontSize(10);
  doc.text(`LPQ Al-Muhajirun | ${periodLabel} | ${methodLabel}`, 14, 22);
  doc.text(`Total ${formatRupiah(summary.total)} | Cash ${formatRupiah(summary.cash)} | Transfer ${formatRupiah(summary.transfer)} | ${summary.count} transaksi`, 14, 28);
  doc.autoTable({
    startY: 34,
    head: [['No', 'Waktu', 'Santri', 'Kelas', 'Kategori', 'Periode', 'Metode', 'Nominal', 'ID Transaksi']],
    body: buildDailyPaymentReportRows(payments),
    styles: { fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [15, 118, 110] },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 18 }, 7: { halign: 'right' } },
  });
  doc.save(`rekap-harian-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`);
};
