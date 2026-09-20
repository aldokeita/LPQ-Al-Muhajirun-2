import { insert, query, remove, update } from '@/lib/dataClient';

// D1 menyimpan uang sebagai INTEGER dalam satuan sen, sedangkan seluruh modul ini dan
// antarmukanya bekerja dengan rupiah desimal. Konversinya dilakukan di batas modul agar
// sisa berkas dan komponen yang memakainya tidak perlu berubah.
//
// Ini bukan detail kosmetik: membaca nilai sen sebagai rupiah akan menampilkan angka
// seratus kali lipat, dan menulis rupiah sebagai sen akan mencatat seperseratusnya.
const centsToRupiah = (cents) => Number(cents ?? 0) / 100;
const rupiahToCents = (rupiah) => Math.round(Number(rupiah || 0) * 100);
const withRupiah = (rows) => rows.map((row) => (
  Object.prototype.hasOwnProperty.call(row, 'jumlah') ? { ...row, jumlah: centsToRupiah(row.jumlah) } : row
));

export const expenseCategories = [
    'Operasional',
    'Konsumsi',
    'Acara',
    'Perawatan',
    'Transportasi',
    'Administrasi',
    'Promosi/Marketing',
    'Donasi/Sosial',
    'Inventaris',
    'Teknologi',
    'Lainnya'
];

export const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember'
];

const toDateString = (date) => date.toISOString().slice(0, 10);

export const getMonthOptions = () => monthNames.map((label, index) => ({
    label,
    value: index + 1
}));

export const getPeriodDateRange = ({ year, month = 'all' }) => {
    const selectedYear = Number(year);
    if (!Number.isInteger(selectedYear)) {
        throw new Error('Tahun tidak valid.');
    }

    if (month === 'all') {
        return {
            startDate: `${selectedYear}-01-01`,
            endDate: `${selectedYear}-12-31`
        };
    }

    const selectedMonth = Number(month);
    if (!Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
        throw new Error('Bulan tidak valid.');
    }

    const start = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1));
    const end = new Date(Date.UTC(selectedYear, selectedMonth, 0));
    return {
        startDate: toDateString(start),
        endDate: toDateString(end)
    };
};

export const parseCurrencyAmount = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Nominal wajib lebih besar dari nol.');
    }
    return Math.round(amount * 100) / 100;
};

export const formatRupiah = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export const normalizeExpensePayload = (formData, userId) => {
    if (!formData?.tanggal_pengeluaran || Number.isNaN(Date.parse(formData.tanggal_pengeluaran))) {
        throw new Error('Tanggal pengeluaran wajib valid.');
    }

    const jumlah = parseCurrencyAmount(formData.jumlah);
    const kategori = String(formData.kategori || '').trim();
    const deskripsi = String(formData.deskripsi || '').trim();

    if (!kategori) {
        throw new Error('Kategori pengeluaran wajib diisi.');
    }

    if (!deskripsi) {
        throw new Error('Keterangan pengeluaran wajib diisi.');
    }

    return {
        tanggal_pengeluaran: formData.tanggal_pengeluaran,
        kategori,
        deskripsi,
        jumlah,
        bukti_url: String(formData.bukti_url || '').trim() || null,
        updated_by: userId || null
    };
};

export const fetchExpensesByPeriod = async ({ year, month = 'all', date = null }) => {
    const filters = [{ column: 'deleted_at', op: 'is_null' }];

    if (date) {
        filters.push({ column: 'tanggal_pengeluaran', op: 'eq', value: date });
    } else {
        const { startDate, endDate } = getPeriodDateRange({ year, month });
        filters.push({ column: 'tanggal_pengeluaran', op: 'gte', value: startDate });
        filters.push({ column: 'tanggal_pengeluaran', op: 'lte', value: endDate });
    }

    const { data, error } = await query({
        table: 'expenses',
        columns: ['id', 'tanggal_pengeluaran', 'kategori', 'deskripsi', 'jumlah', 'bukti_url', 'created_at', 'updated_at', 'deleted_at'],
        filters,
        order: [
            { column: 'tanggal_pengeluaran', ascending: false },
            { column: 'created_at', ascending: false },
        ],
        limit: 1000,
    });

    if (error) throw error;
    return withRupiah(data || []);
};

export const fetchDailyExpenseSummary = async ({ year, month = 'all' }) => {
    const { startDate, endDate } = getPeriodDateRange({ year, month });
    const { data, error } = await query({
        table: 'expenses',
        columns: ['tanggal_pengeluaran', 'jumlah'],
        filters: [
            { column: 'deleted_at', op: 'is_null' },
            { column: 'tanggal_pengeluaran', op: 'gte', value: startDate },
            { column: 'tanggal_pengeluaran', op: 'lte', value: endDate },
        ],
        limit: 1000,
    });

    if (error) throw error;

    // Penjumlahan tetap dilakukan dalam sen agar tidak ada pembulatan yang menumpuk.
    const totals = {};
    (data || []).forEach((row) => {
        const day = row.tanggal_pengeluaran;
        totals[day] = (totals[day] || 0) + Number(row.jumlah ?? 0);
    });

    return Object.keys(totals)
        .sort((a, b) => b.localeCompare(a))
        .map((tanggal) => ({
            tanggal,
            total: totals[tanggal] / 100
        }));
};

export const createExpense = async (formData, userId) => {
    const payload = {
        ...normalizeExpensePayload(formData, userId),
        created_by: userId || null
    };

    // created_by dan updated_by ditetapkan server; nilai dari sini akan diabaikan.
    const { data, error } = await insert('expenses', {
        ...payload,
        jumlah: rupiahToCents(payload.jumlah),
    });

    if (error) throw error;
    return { ...payload, id: data?.id ?? null };
};

export const updateExpense = async (id, formData, userId) => {
    const payload = normalizeExpensePayload(formData, userId);
    const { error } = await update('expenses', id, {
        ...payload,
        jumlah: rupiahToCents(payload.jumlah),
    });

    if (error) throw error;
    return { ...payload, id };
};

export const softDeleteExpense = async (id) => {
    // Tabel expenses punya kolom deleted_at, jadi endpoint hapus melakukan penghapusan
    // lunak dan sekaligus mengisi updated_by dengan identitas pemanggil.
    const { error } = await remove('expenses', id);
    if (error) throw error;
};

const sumAmounts = (rows) => rows.reduce((totalCents, row) => {
    const cents = Math.round(Number(row.jumlah || 0) * 100);
    return totalCents + cents;
}, 0) / 100;

export const fetchCashflowSummary = async ({ year, month = 'all' }) => {
    const selectedYear = Number(year);
    const selectedMonth = month === 'all' ? 'all' : Number(month);
    const { startDate, endDate } = getPeriodDateRange({ year: selectedYear, month: selectedMonth });

    const [paymentsResult, expenses] = await Promise.all([
        query({
            table: 'payments',
            columns: ['jumlah', 'tanggal_pembayaran', 'status', 'deleted_at'],
            filters: [
                { column: 'status', op: 'eq', value: 'paid' },
                { column: 'deleted_at', op: 'is_null' },
                { column: 'tanggal_pembayaran', op: 'gte', value: startDate },
                { column: 'tanggal_pembayaran', op: 'lte', value: endDate },
            ],
            limit: 1000,
        }),
        fetchExpensesByPeriod({ year: selectedYear, month: selectedMonth })
    ]);

    if (paymentsResult.error) throw paymentsResult.error;

    const totalPemasukan = sumAmounts(withRupiah(paymentsResult.data || []));
    const totalPengeluaran = sumAmounts(expenses);

    return {
        totalPemasukan,
        totalPengeluaran,
        saldoBersih: Math.round((totalPemasukan - totalPengeluaran) * 100) / 100,
        paymentCount: (paymentsResult.data || []).length,
        expenseCount: expenses.length
    };
};

export const getFinanceErrorMessage = (error) => {
    const message = String(error?.message || error || '');
    if (message.includes('row-level security') || error?.code === '42501') {
        return 'Anda tidak memiliki akses untuk mengelola data keuangan ini.';
    }
    if (message.includes('jumlah') || message.includes('Nominal')) {
        return 'Nominal wajib lebih besar dari nol.';
    }
    return message || 'Operasi keuangan gagal.';
};
