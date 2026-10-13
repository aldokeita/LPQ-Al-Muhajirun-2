import { getDailyReportIndicators } from './dailyPaymentRecap.js';
import { buildDailyPaymentReportRows, DAILY_REPORT_PAYMENT_HEADERS, getDailyReportFilename, getDailyReportMetadata } from './dailyPaymentReportAdapters.js';

const GREEN = 'FF0F766E';
const INK = 'FF172033';
const BORDER = { style: 'thin', color: { argb: 'FFDCE4EE' } };
const RUPIAH = '"Rp" #,##0.00;[Red]("Rp" #,##0.00);"Rp" 0.00';
const HEADER_ROW = 10;

export const buildDailyPaymentWorkbook = async (report) => {
  const module = await import('exceljs');
  const ExcelJS = module.default || module;
  const workbook = new ExcelJS.Workbook();
  const { branding, generatedLabel } = getDailyReportMetadata(report);
  workbook.creator = branding.institutionName;
  workbook.created = new Date(report.generatedAt || Date.now());
  workbook.title = `Rekap Harian ${report.periodLabel}`;
  let logoId;
  if (branding.logoDataUrl) {
    logoId = workbook.addImage({ base64: branding.logoDataUrl, extension: 'png' });
  }

  const makeSheet = (name, title, widths) => {
    const sheet = workbook.addWorksheet(name, {
      properties: { defaultRowHeight: 22, tabColor: { argb: GREEN } },
      views: [{ state: 'frozen', ySplit: HEADER_ROW, showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }, printTitlesRow: `1:${HEADER_ROW}` },
      headerFooter: { oddFooter: `${branding.institutionName.replace(/&/g, '&&')}&RHalaman &P dari &N` },
    });
    sheet.columns = widths.map((width) => ({ width }));
    const last = widths.length;
    const writeMerged = (row, text, start = 1, size = 11, bold = false) => {
      sheet.mergeCells(row, start, row, last);
      const cell = sheet.getCell(row, start);
      cell.value = text;
      cell.font = { name: 'Calibri', size, bold, color: { argb: INK } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    };
    const start = logoId === undefined ? 1 : 2;
    writeMerged(1, branding.yayasanName, start, 12, true);
    writeMerged(2, branding.institutionEyebrow, start, 10);
    writeMerged(3, branding.institutionName, start, 18, true);
    writeMerged(4, branding.address, start, 10);
    sheet.getRow(3).height = 30;
    sheet.getRow(4).height = 32;
    for (let column = 1; column <= last; column += 1) {
      sheet.getCell(5, column).border = { bottom: { style: 'medium', color: { argb: GREEN } } };
    }
    writeMerged(6, title, 1, 14, true);
    sheet.getRow(6).height = 28;
    writeMerged(7, `${report.periodLabel} · ${report.methodLabel}`);
    writeMerged(8, `Diekspor ${generatedLabel}`, 1, 10);
    if (logoId !== undefined) {
      sheet.addImage(logoId, { tl: { col: 0.1, row: 0.15 }, ext: { width: 64, height: 64 }, editAs: 'oneCell' });
    }
    return sheet;
  };

  const styleRow = (row, header = false) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: header, color: { argb: header ? 'FFFFFFFF' : INK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: header ? GREEN : row.number % 2 ? 'FFFFFFFF' : 'FFF1F5F4' } };
      cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
      cell.alignment = { vertical: 'middle', wrapText: true, ...(header ? { horizontal: 'center' } : {}) };
    });
    row.height = header ? 28 : 36;
  };
  const finishSheet = (sheet) => {
    sheet.pageSetup.printArea = `A1:${sheet.getColumn(sheet.columnCount).letter}${sheet.rowCount}`;
  };

  const overview = makeSheet('Ringkasan', 'Rekap Harian', [22, 24, 24, 26]);
  overview.getRow(HEADER_ROW).values = ['Indikator', '', '', 'Nominal'];
  overview.mergeCells(HEADER_ROW, 1, HEADER_ROW, 3);
  styleRow(overview.getRow(HEADER_ROW), true);
  getDailyReportIndicators(report.summary).forEach(([label, value], index) => {
    const row = overview.getRow(HEADER_ROW + 1 + index);
    row.values = [label, '', '', value];
    overview.mergeCells(row.number, 1, row.number, 3);
    styleRow(row);
    row.getCell(4).numFmt = RUPIAH;
    row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    if (label === 'Saldo Bersih') row.font = { name: 'Calibri', size: 11, bold: true, color: { argb: GREEN } };
  });
  overview.getRow(17).values = ['Jumlah Transaksi', '', '', report.summary.count];
  overview.mergeCells(17, 1, 17, 3); styleRow(overview.getRow(17));
  overview.mergeCells('A19:D19'); overview.getCell('A19').value = 'Total SPP Dewasa termasuk dalam Total Pemasukan. Pengeluaran mencakup seluruh pengeluaran lembaga pada tanggal ini.';
  overview.getCell('A19').alignment = { wrapText: true, vertical: 'middle' };
  overview.getCell('A19').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF536078' } };
  overview.getRow(19).height = 36;
  finishSheet(overview);

  const addDetail = (name, title, headers, widths, rows, total, amountColumn, emptyLabel) => {
    const sheet = makeSheet(name, title, widths);
    sheet.getRow(HEADER_ROW).values = headers;
    styleRow(sheet.getRow(HEADER_ROW), true);
    rows.forEach((values, index) => {
      const row = sheet.getRow(HEADER_ROW + 1 + index);
      row.values = values;
      styleRow(row);
      row.getCell(amountColumn).numFmt = RUPIAH;
      row.getCell(amountColumn).alignment = { horizontal: 'right', vertical: 'middle' };
      // Nomor induk dan ID transaksi tetap teks, termasuk angka nol di depan.
      if (headers.length === 10) {
        row.getCell(4).numFmt = '@'; row.getCell(10).numFmt = '@';
      }
      // Tinggi baris cukup untuk nama/keterangan panjang dan ID UUID.
      row.height = Math.max(36, ...values.map((value, column) => Math.ceil(String(value ?? '').length / Math.max(1, widths[column] - 2)) * 16 + 8));
    });
    sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + rows.length, column: headers.length } };
    if (!rows.length) {
      sheet.mergeCells(HEADER_ROW + 1, 1, HEADER_ROW + 1, headers.length);
      sheet.getCell(HEADER_ROW + 1, 1).value = emptyLabel;
      sheet.getCell(HEADER_ROW + 1, 1).font = { name: 'Calibri', size: 11, italic: true };
      sheet.getRow(HEADER_ROW + 1).height = 30;
    }
    const totalRow = sheet.getRow(HEADER_ROW + Math.max(1, rows.length) + 2);
    totalRow.getCell(headers.length).value = null;
    sheet.mergeCells(totalRow.number, 1, totalRow.number, amountColumn - 1);
    totalRow.getCell(1).value = `TOTAL ${title.toUpperCase()}`;
    totalRow.getCell(amountColumn).value = total;
    styleRow(totalRow);
    totalRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: GREEN } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5F1EE' } };
    });
    totalRow.getCell(amountColumn).numFmt = RUPIAH;
    totalRow.getCell(amountColumn).alignment = { horizontal: 'right', vertical: 'middle' };
    finishSheet(sheet);
  };

  const widths = [7, 16, 38, 22, 24, 28, 24, 20, 26, 44];
  addDetail('Transaksi', 'Seluruh Pembayaran', DAILY_REPORT_PAYMENT_HEADERS, widths, buildDailyPaymentReportRows(report.payments, true), report.summary.total, 9, 'Belum ada pembayaran untuk filter ini.');
  addDetail('SPP Dewasa', 'SPP Dewasa', DAILY_REPORT_PAYMENT_HEADERS, widths, buildDailyPaymentReportRows(report.adultSppPayments, true), report.summary.adultSppTotal, 9, 'Belum ada pembayaran SPP Dewasa untuk filter ini.');
  addDetail('Pengeluaran', 'Pengeluaran', ['No', 'Kategori', 'Keterangan', 'Nominal'], [12, 28, 76, 26], report.expenses.map((expense, index) => [index + 1, expense.kategori, expense.deskripsi, Number(expense.jumlah || 0)]), report.summary.expenseTotal, 4, 'Belum ada pengeluaran pada tanggal ini.');
  return workbook;
};

export const downloadDailyPaymentExcel = async (report) => {
  const workbook = await buildDailyPaymentWorkbook(report);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url; link.download = getDailyReportFilename(report, 'xlsx');
    document.body.appendChild(link); link.click(); link.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
};
