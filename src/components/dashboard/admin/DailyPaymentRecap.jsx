import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarDays, CreditCard, Download, FileText, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import {
  buildDailyPaymentSummary,
  DAILY_PAYMENT_METHODS,
  enrichDailyPayments,
  filterDailyPayments,
  formatRupiah,
  getJakartaDateParts,
  getPaymentDateParts,
} from '@/lib/dailyPaymentRecap';
import { downloadDailyPaymentPdf, printDailyPaymentHtml } from '@/lib/dailyPaymentReportAdapters';
import { MONTH_NAMES } from '@/lib/paymentAdapters';

const methodOptions = [
  { value: 'all', label: 'Semua', icon: Receipt },
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'transfer', label: 'Transfer', icon: CreditCard },
];

const DailyPaymentRecap = ({ payments = [], santri = [] }) => {
  const today = useMemo(() => getJakartaDateParts(), []);
  const [filters, setFilters] = useState({ ...today, method: 'all' });

  const availableYears = useMemo(() => {
    const paymentYears = payments
      .map((payment) => getPaymentDateParts(payment.tanggal_pembayaran)?.year)
      .filter(Boolean);
    return [...new Set([today.year, ...paymentYears])].sort((a, b) => b - a);
  }, [payments, today.year]);

  const daysInMonth = useMemo(
    () => new Date(Number(filters.year), Number(filters.month), 0).getDate(),
    [filters.month, filters.year],
  );

  useEffect(() => {
    if (Number(filters.day) > daysInMonth) {
      setFilters((current) => ({ ...current, day: daysInMonth }));
    }
  }, [daysInMonth, filters.day]);

  const filteredPayments = useMemo(
    () => filterDailyPayments(payments, filters),
    [filters, payments],
  );
  const detailedPayments = useMemo(
    () => enrichDailyPayments(filteredPayments, santri),
    [filteredPayments, santri],
  );
  const summary = useMemo(
    () => buildDailyPaymentSummary(filteredPayments),
    [filteredPayments],
  );

  const periodLabel = `${filters.day} ${MONTH_NAMES[Number(filters.month) - 1]} ${filters.year}`;
  const methodLabel = DAILY_PAYMENT_METHODS[filters.method];

  const reportPayload = { payments: detailedPayments, summary, periodLabel, methodLabel };

  const handleHtmlReport = () => {
    try {
      printDailyPaymentHtml(reportPayload);
    } catch (error) {
      toast({ title: 'Laporan belum dapat dibuka', description: error.message, variant: 'destructive' });
    }
  };

  const handlePdfReport = () => {
    try {
      downloadDailyPaymentPdf(reportPayload);
    } catch (error) {
      toast({ title: 'PDF gagal dibuat', description: 'Coba muat ulang halaman lalu ulangi ekspor.', variant: 'destructive' });
    }
  };

  return (
    <section className="space-y-5" aria-labelledby="daily-payment-heading">
      <div className="rounded-lg border border-slate-200/80 bg-white/70 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/45">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
              <h3 id="daily-payment-heading" className="text-lg font-bold text-slate-950 dark:text-white">Rekap Harian</h3>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Ringkasan transaksi berdasarkan tanggal pembayaran, bukan periode tagihan.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Hari</label>
              <Select value={String(filters.day)} onValueChange={(value) => setFilters((current) => ({ ...current, day: Number(value) }))}>
                <SelectTrigger className="min-w-[92px]" aria-label="Pilih hari"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => <SelectItem key={day} value={String(day)}>{day}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Bulan</label>
              <Select value={String(filters.month)} onValueChange={(value) => setFilters((current) => ({ ...current, month: Number(value) }))}>
                <SelectTrigger className="min-w-[148px]" aria-label="Pilih bulan"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTH_NAMES.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Tahun</label>
              <Select value={String(filters.year)} onValueChange={(value) => setFilters((current) => ({ ...current, year: Number(value) }))}>
                <SelectTrigger className="w-full min-w-[104px]" aria-label="Pilih tahun"><SelectValue /></SelectTrigger>
                <SelectContent>{availableYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
          <div className="inline-flex w-full rounded-md border border-slate-200 bg-slate-100/80 p-1 sm:w-auto dark:border-slate-700 dark:bg-slate-900" aria-label="Filter metode pembayaran">
            {methodOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filters.method === value}
                onClick={() => setFilters((current) => ({ ...current, method: value }))}
                className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded px-3 text-sm font-semibold transition sm:flex-none ${filters.method === value ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />{label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleHtmlReport} disabled={!detailedPayments.length} className="flex-1 sm:flex-none">
              <FileText className="mr-2 h-4 w-4" aria-hidden="true" />Cetak HTML
            </Button>
            <Button type="button" onClick={handlePdfReport} disabled={!detailedPayments.length} className="flex-1 sm:flex-none">
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />Unduh PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="admin-stat-card admin-stat-card--accent">
          <p className="admin-stat-card-label">Total Pemasukan Harian</p><p className="admin-stat-card-value">{formatRupiah(summary.total)}</p>
        </article>
        <article className="admin-stat-card">
          <p className="admin-stat-card-label">Cash</p><p className="admin-stat-card-value">{formatRupiah(summary.cash)}</p>
        </article>
        <article className="admin-stat-card admin-stat-card--amber">
          <p className="admin-stat-card-label">Transfer</p><p className="admin-stat-card-value">{formatRupiah(summary.transfer)}</p>
        </article>
        <article className="admin-stat-card">
          <p className="admin-stat-card-label">Jumlah Transaksi</p><p className="admin-stat-card-value">{summary.count}</p>
        </article>
      </div>

      {summary.other > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Terdapat metode lain senilai {formatRupiah(summary.other)}. Nilai tersebut tetap masuk ke total harian.
        </p>
      )}

      <div className="admin-table-shell">
        <div className="admin-table-scroll" style={{ maxHeight: '560px' }}>
          <table>
            <thead><tr><th>No</th><th>Waktu</th><th>Nama Santri</th><th>Kelas</th><th>Kategori</th><th>Periode</th><th>Metode</th><th>Nominal</th><th>ID Transaksi</th></tr></thead>
            <tbody>
              {detailedPayments.length === 0 ? (
                <tr><td colSpan="9"><div className="flex min-h-48 flex-col items-center justify-center px-4 text-center"><Receipt className="mb-3 h-9 w-9 text-slate-400" aria-hidden="true" /><p className="font-semibold text-slate-800 dark:text-slate-100">Belum ada pembayaran</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tidak ada transaksi untuk {periodLabel} dengan filter {methodLabel.toLowerCase()}.</p></div></td></tr>
              ) : detailedPayments.map((payment, index) => (
                <tr key={payment.id}>
                  <td>{index + 1}</td>
                  <td className="font-mono">{payment.waktu} WIB</td>
                  <td><div className="font-semibold">{payment.nama_santri}</div><div className="text-xs text-muted-foreground">{payment.nomor_induk}</div></td>
                  <td>{payment.kelas}</td>
                  <td className="font-medium">{payment.kategori_pembayaran}</td>
                  <td>{payment.periode}</td>
                  <td><span className={`admin-status-badge ${payment.metode_label === 'Transfer' ? 'admin-status-badge--info' : 'admin-status-badge--success'}`}>{payment.metode_label}</span></td>
                  <td className="whitespace-nowrap text-right font-semibold">{formatRupiah(payment.jumlah)}</td>
                  <td className="max-w-[180px] truncate font-mono text-xs" title={payment.transaction_id || '-'}>{payment.transaction_id || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default DailyPaymentRecap;
