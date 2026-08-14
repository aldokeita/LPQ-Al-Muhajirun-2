import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatRupiah } from './financeAdapters.js';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export const buildDailyExpenseRows = (expenses = []) => expenses.map((expense, index) => [
  index + 1,
  expense.kategori || 'Lainnya',
  expense.deskripsi || '-',
  formatRupiah(expense.jumlah),
]);

export const getDayTotal = (expenses = []) =>
  expenses.reduce((sum, expense) => sum + Number(expense.jumlah || 0), 0);

const dayLabel = (date, fallback = '') => {
  if (!date) return fallback;
  try {
    const parsed = new Date(`${date}T00:00:00`);
    return parsed.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return fallback || date;
  }
};

export const printDailyExpenseHtml = ({ expenses = [], date, total }) => {
  const rows = buildDailyExpenseRows(expenses);
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) throw new Error('Browser memblokir jendela laporan. Izinkan pop-up lalu coba lagi.');
  printWindow.opener = null;

  const tableRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
  printWindow.document.write(`<!doctype html>
    <html lang="id"><head><meta charset="utf-8"><title>Detail Pengeluaran Harian</title>
    <style>
      body{font-family:Arial,sans-serif;color:#172033;margin:32px}h1{font-size:22px;margin:0 0 6px}p{margin:3px 0;color:#536078}
      .summary{display:flex;gap:24px;margin:22px 0}.card{border:1px solid #dce4ee;padding:12px 18px;border-radius:6px}.card strong{display:block;margin-top:6px;color:#b91c1c}
      table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #dce4ee;padding:8px;text-align:left}th{background:#fef2f2}td:nth-child(4){text-align:right}footer{margin-top:18px;font-size:10px;color:#7b8798}
    </style></head><body>
    <h1>Detail Pengeluaran Harian</h1><p>LPQ Al-Muhajirun</p><p>${escapeHtml(dayLabel(date))}</p>
    <section class="summary"><div class="card">Total Pengeluaran<strong>${escapeHtml(formatRupiah(total))}</strong></div><div class="card">Jumlah Transaksi<strong>${expenses.length}</strong></div></section>
    <table><thead><tr><th>No</th><th>Kategori</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>${tableRows}</tbody></table>
    <footer>Dicetak ${escapeHtml(new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }))} WIB</footer>
    <script>window.onload=()=>{window.print();};</script></body></html>`);
  printWindow.document.close();
};

export const downloadDailyExpensePdf = ({ expenses = [], date, total }) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFontSize(16);
  doc.text('Detail Pengeluaran Harian', 14, 15);
  doc.setFontSize(10);
  doc.text(`LPQ Al-Muhajirun | ${dayLabel(date)}`, 14, 22);
  doc.text(`Total ${formatRupiah(total)} | ${expenses.length} transaksi`, 14, 28);
  doc.autoTable({
    startY: 34,
    head: [['No', 'Kategori', 'Keterangan', 'Nominal']],
    body: buildDailyExpenseRows(expenses),
    styles: { fontSize: 9, cellPadding: 2.4 },
    headStyles: { fillColor: [185, 28, 28] },
    columnStyles: { 0: { cellWidth: 10 }, 3: { halign: 'right' } },
  });
  doc.save(`pengeluaran-harian-${date}.pdf`);
};

export const downloadDailyExpenseExcel = ({ expenses = [], date, total }) => {
  const data = expenses.map((expense, index) => ({
    No: index + 1,
    Tanggal: expense.tanggal_pengeluaran,
    Kategori: expense.kategori || 'Lainnya',
    Keterangan: expense.deskripsi || '-',
    Jumlah: Number(expense.jumlah || 0),
    Bukti: expense.bukti_url || '',
  }));
  if (total > 0) {
    data.push({
      No: '',
      Tanggal: '',
      Kategori: 'TOTAL',
      Keterangan: '',
      Jumlah: total,
      Bukti: '',
    });
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.sheet_add_aoa(worksheet, [['Detail Pengeluaran Harian - ' + dayLabel(date)]], { origin: 'A1' });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Detail Pengeluaran');
  XLSX.writeFile(workbook, `pengeluaran-harian-${date}.xlsx`);
};