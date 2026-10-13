import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import { formatRupiah, getDailyReportIndicators } from './dailyPaymentRecap.js';
import { DEFAULT_CLASS_ATTENDANCE_PRINT_CONFIG } from './classAttendancePrintConfig.js';

applyPlugin(jsPDF);

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

export const DAILY_REPORT_PAYMENT_HEADERS = ['No', 'Waktu (WIB)', 'Nama Santri', 'No Induk', 'Kelas', 'Kategori', 'Periode', 'Metode', 'Nominal', 'ID Transaksi'];

export const getDailyReportMetadata = (report) => ({
  branding: { ...DEFAULT_CLASS_ATTENDANCE_PRINT_CONFIG.content, ...report.branding },
  generatedLabel: `${new Date(report.generatedAt || Date.now()).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
});

export const getDailyReportFilename = (report, extension) => (
  `rekap-harian-${report.date}-${report.method || 'all'}.${extension}`
);

export const buildDailyPaymentReportRows = (payments = [], numericAmounts = false) => payments.map((payment, index) => [
  index + 1, payment.waktu, payment.nama_santri, String(payment.nomor_induk || '-'),
  payment.kelas, payment.kategori_pembayaran, payment.periode, payment.metode_label,
  numericAmounts ? Number(payment.jumlah || 0) : formatRupiah(payment.jumlah),
  String(payment.transaction_id || '-'),
]);

export const buildDailyPaymentHtml = (report) => {
  const { payments, adultSppPayments, expenses, summary, periodLabel, methodLabel } = report;
  const { branding, generatedLabel } = getDailyReportMetadata(report);
  const renderTable = (title, headers, rows, total, emptyLabel) => `
    <section class="detail"><h2>${escapeHtml(title)}</h2><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
    <tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell, index) => `<td${index === 8 && headers.length === 10 || index === 3 && headers.length === 4 ? ' class="amount"' : ''}>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">${escapeHtml(emptyLabel)}</td></tr>`}</tbody>
    <tfoot><tr><td colspan="${headers.length === 10 ? 8 : 3}">Total ${escapeHtml(title)}</td><td class="amount">${escapeHtml(formatRupiah(total))}</td>${headers.length === 10 ? '<td></td>' : ''}</tr></tfoot></table></section>`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Rekap Harian ${escapeHtml(periodLabel)}</title><style>
    @page{size:A4 landscape;margin:14mm}body{font-family:Arial,sans-serif;color:#172033;margin:24px;font-size:12px}
    header{display:flex;align-items:center;justify-content:center;gap:20px;border-bottom:3px solid #0f766e;padding-bottom:16px;text-align:center}header img{width:70px;height:70px;object-fit:contain}header h1{font-size:22px;margin:6px 0}header p{margin:3px 0}
    h2{font-size:15px;margin:18px 0 8px}.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:20px 0}.card{border:1px solid #dce4ee;padding:12px;border-radius:6px;break-inside:avoid}.card strong{display:block;margin-top:6px;color:#0f766e;font-size:16px}
    .note{color:#536078;font-size:11px}table{width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed}th,td{border:1px solid #dce4ee;padding:7px;text-align:left;overflow-wrap:anywhere}th{background:#0f766e;color:white}tbody tr:nth-child(even){background:#f1f5f4}.amount{text-align:right}tfoot{font-weight:bold}thead{display:table-header-group}tr{break-inside:avoid}footer{margin-top:20px;color:#536078;font-size:10px}
    @media print{body{margin:0}th{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body><header>${branding.logoDataUrl ? `<img src="${escapeHtml(branding.logoDataUrl)}" alt="Logo LPQ Al-Muhajirun">` : ''}<div><p><strong>${escapeHtml(branding.yayasanName)}</strong></p><p>${escapeHtml(branding.institutionEyebrow)}</p><h1>${escapeHtml(branding.institutionName)}</h1><p>${escapeHtml(branding.address)}</p></div></header>
    <h2>Rekap Harian</h2><p>${escapeHtml(periodLabel)} · ${escapeHtml(methodLabel)}</p>
    <section class="summary">${getDailyReportIndicators(summary).map(([label, value]) => `<div class="card">${escapeHtml(label)}<strong>${escapeHtml(formatRupiah(value))}</strong></div>`).join('')}</section>
    <p class="note">${summary.count} transaksi pembayaran. Total SPP Dewasa termasuk dalam Total Pemasukan. Pengeluaran mencakup seluruh pengeluaran lembaga pada tanggal ini.</p>
    ${renderTable('Seluruh Pembayaran', DAILY_REPORT_PAYMENT_HEADERS, buildDailyPaymentReportRows(payments), summary.total, 'Belum ada pembayaran untuk filter ini.')}
    ${renderTable('SPP Dewasa', DAILY_REPORT_PAYMENT_HEADERS, buildDailyPaymentReportRows(adultSppPayments), summary.adultSppTotal, 'Belum ada pembayaran SPP Dewasa untuk filter ini.')}
    ${renderTable('Pengeluaran', ['No', 'Kategori', 'Keterangan', 'Nominal'], expenses.map((expense, index) => [index + 1, expense.kategori, expense.deskripsi, formatRupiah(expense.jumlah)]), summary.expenseTotal, 'Belum ada pengeluaran pada tanggal ini.')}
    <footer>Diekspor ${escapeHtml(generatedLabel)}</footer></body></html>`;
};

export const printDailyPaymentHtml = (report) => {
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) throw new Error('Browser memblokir jendela laporan. Izinkan pop-up lalu coba lagi.');
  printWindow.opener = null;
  printWindow.onload = () => { printWindow.print(); };
  printWindow.document.write(buildDailyPaymentHtml(report));
  printWindow.document.close();
};

export const buildDailyPaymentPdf = (report) => {
  const { payments, adultSppPayments, expenses, summary, periodLabel, methodLabel } = report;
  const { branding, generatedLabel } = getDailyReportMetadata(report);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const autoTable = (options) => doc.autoTable(options);
  const headedPages = new Set();
  const drawHeader = () => {
    const page = doc.internal.getCurrentPageInfo().pageNumber;
    if (headedPages.has(page)) return;
    headedPages.add(page);
    if (branding.logoDataUrl) {
      try { doc.addImage(branding.logoDataUrl, 'PNG', 14, 10, 22, 22); } catch { /* Kop teks tetap dicetak. */ }
    }
    doc.setTextColor(23, 32, 51);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(branding.yayasanName, 148.5, 13, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(branding.institutionEyebrow, 148.5, 19, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(branding.institutionName, 148.5, 26, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(doc.splitTextToSize(branding.address, 220), 148.5, 32, { align: 'center' });
    doc.setDrawColor(15, 118, 110); doc.line(14, 40, 283, 40);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Rekap Harian', 14, 47);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`${periodLabel} | ${methodLabel}`, 14, 53);
  };
  const tableOptions = {
    margin: { top: 64, bottom: 18, left: 14, right: 14 },
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 118, 110] },
    alternateRowStyles: { fillColor: [241, 245, 244] },
    footStyles: { fillColor: [229, 241, 238], textColor: [23, 32, 51] },
    showHead: 'everyPage', showFoot: 'lastPage', rowPageBreak: 'avoid', didDrawPage: drawHeader,
  };
  drawHeader();
  autoTable({ ...tableOptions, startY: 64, head: [['Ringkasan', 'Nominal']],
    body: getDailyReportIndicators(summary).map(([label, value]) => [label, formatRupiah(value)]),
    columnStyles: { 1: { halign: 'right' } },
  });
  let cursor = doc.lastAutoTable.finalY + 7;
  const ensureRoom = (height) => {
    if (cursor + height > 192) { doc.addPage(); drawHeader(); cursor = 64; }
  };
  ensureRoom(14);
  doc.setFontSize(8); doc.text(`${summary.count} transaksi. Total SPP Dewasa termasuk dalam Total Pemasukan.`, 14, cursor);
  cursor += 5;
  doc.text('Pengeluaran mencakup seluruh pengeluaran lembaga pada tanggal ini.', 14, cursor);
  cursor += 8;
  const addTable = (title, headers, rows, total, emptyLabel, columnStyles) => {
    ensureRoom(25);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(title, 14, cursor);
    doc.setFont('helvetica', 'normal');
    const foot = [{ content: `Total ${title}`, colSpan: headers.length - 2 }, formatRupiah(total), ''];
    autoTable({ ...tableOptions, startY: cursor + 4, head: [headers],
      body: rows.length ? rows : [[{ content: emptyLabel, colSpan: headers.length }]],
      foot: [headers.length === 4 ? [{ content: `Total ${title}`, colSpan: 3 }, formatRupiah(total)] : foot],
      columnStyles,
    });
    cursor = doc.lastAutoTable.finalY + 10;
  };
  const paymentWidths = { 0: { cellWidth: 9 }, 1: { cellWidth: 19 }, 2: { cellWidth: 48 }, 3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 24 }, 6: { cellWidth: 23 }, 7: { cellWidth: 21 }, 8: { cellWidth: 29, halign: 'right' }, 9: { cellWidth: 52 } };
  addTable('Seluruh Pembayaran', DAILY_REPORT_PAYMENT_HEADERS, buildDailyPaymentReportRows(payments), summary.total, 'Belum ada pembayaran untuk filter ini.', paymentWidths);
  addTable('SPP Dewasa', DAILY_REPORT_PAYMENT_HEADERS, buildDailyPaymentReportRows(adultSppPayments), summary.adultSppTotal, 'Belum ada pembayaran SPP Dewasa untuk filter ini.', paymentWidths);
  addTable('Pengeluaran', ['No', 'Kategori', 'Keterangan', 'Nominal'], expenses.map((expense, index) => [index + 1, expense.kategori, expense.deskripsi, formatRupiah(expense.jumlah)]), summary.expenseTotal, 'Belum ada pengeluaran pada tanggal ini.', { 0: { cellWidth: 10 }, 3: { halign: 'right', cellWidth: 35 } });
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(83, 96, 120);
    doc.text(`Diekspor ${generatedLabel}`, 14, 202);
    doc.text(`Halaman ${page} dari ${pageCount}`, 283, 202, { align: 'right' });
  }
  return doc;
};

export const downloadDailyPaymentPdf = (report) => buildDailyPaymentPdf(report).save(getDailyReportFilename(report, 'pdf'));
