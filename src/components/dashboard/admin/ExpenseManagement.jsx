import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

const categories = [
    "Operasional", "Konsumsi", "Acara", "Perawatan", "Transportasi",
    "Administrasi", "Promosi/Marketing", "Donasi/Sosial",
    "Inventaris", "Teknologi", "Custom"
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const ExpenseManagement = () => {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [formData, setFormData] = useState({});
    const [filter, setFilter] = useState({ year: currentYear, month: 'all' });

    const fetchExpenses = useCallback(async () => {
        const { data, error } = await supabase.from('expenses').select('*').order('tanggal_pengeluaran', { ascending: false });
        if (error) {
            toast({ title: "Gagal memuat data", description: error.message, variant: "destructive" });
        } else {
            setExpenses(data);
        }
    }, []);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    const resetForm = () => {
        setFormData({
            tanggal_pengeluaran: new Date().toISOString().split('T')[0],
            kategori: categories[0],
            nama_pengeluaran: '',
            jumlah: '',
            catatan: '',
        });
        setEditingExpense(null);
    };

    const handleAdd = () => { resetForm(); setIsFormOpen(true); };
    const handleEdit = (expense) => { setEditingExpense(expense); setFormData({ ...expense, jumlah: String(expense.jumlah), }); setIsFormOpen(true); };

    const handleDelete = async (id) => {
        if (window.confirm("Yakin ingin menghapus pengeluaran ini?")) {
            const { error } = await supabase.from('expenses').delete().eq('id', id);
            if (error) { toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" }); }
            else { toast({ title: "Berhasil!", description: "Data pengeluaran telah dihapus." }); fetchExpenses(); }
        }
    };

    const handleInputChange = (e) => { const { id, value } = e.target; setFormData(prev => ({ ...prev, [id]: value })); };
    const handleSelectChange = (id, value) => { setFormData(prev => ({ ...prev, [id]: value })); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const dataToSubmit = {
            ...formData,
            jumlah: parseFloat(formData.jumlah),
            created_by: user.id,
            updated_at: new Date().toISOString(),
        };
        delete dataToSubmit.bukti_url; // Ensure this field is removed

        let result;
        if (editingExpense) {
            result = await supabase.from('expenses').update(dataToSubmit).eq('id', editingExpense.id);
        } else {
            result = await supabase.from('expenses').insert(dataToSubmit);
        }

        if (result.error) { toast({ title: "Gagal menyimpan", description: result.error.message, variant: "destructive" }); }
        else { toast({ title: "Berhasil!", description: "Data pengeluaran berhasil disimpan." }); setIsFormOpen(false); fetchExpenses(); }
    };
    
    const handleExport = () => {
        const dataToExport = filteredExpenses.map(e => ({
            'Tanggal': e.tanggal_pengeluaran, 'Kategori': e.kategori, 'Nama Pengeluaran': e.nama_pengeluaran,
            'Jumlah': e.jumlah, 'Catatan': e.catatan,
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data Pengeluaran");
        XLSX.writeFile(workbook, `Pengeluaran_${filter.year}_${filter.month === 'all' ? 'Semua' : months[filter.month]}.xlsx`);
    };

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            const expenseDate = new Date(e.tanggal_pengeluaran);
            const yearMatch = expenseDate.getFullYear() === filter.year;
            const monthMatch = filter.month === 'all' || expenseDate.getMonth() === filter.month;
            return yearMatch && monthMatch;
        });
    }, [expenses, filter]);

    const chartData = useMemo(() => {
        const monthlyTotals = Array(12).fill(0);
        expenses.forEach(e => {
            const expenseDate = new Date(e.tanggal_pengeluaran);
            if (expenseDate.getFullYear() === filter.year) {
                monthlyTotals[expenseDate.getMonth()] += parseFloat(e.jumlah);
            }
        });
        return months.map((month, index) => ({ name: month.substring(0, 3), Pengeluaran: monthlyTotals[index] }));
    }, [expenses, filter.year]);

    return (
        <div className="bg-card p-6 rounded-2xl shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-accent-foreground">Manajemen Pengeluaran</h2>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleExport} variant="outline"><Download className="w-4 h-4 mr-2" /> Ekspor Excel</Button>
                    <Button onClick={handleAdd}><Plus className="w-4 h-4 mr-2" /> Tambah Pengeluaran</Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <Select value={filter.year.toString()} onValueChange={(val) => setFilter(f => ({ ...f, year: Number(val) }))}><SelectTrigger className="w-full md:w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
                <Select value={filter.month.toString()} onValueChange={(val) => setFilter(f => ({ ...f, month: val === 'all' ? 'all' : Number(val) }))}><SelectTrigger className="w-full md:w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua Bulan</SelectItem>{months.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent></Select>
            </div>
            
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(value) => `Rp${(value/1000).toLocaleString('id-ID')}k`} />
                        <Tooltip formatter={(value) => `Rp${Number(value).toLocaleString('id-ID')}`} />
                        <Legend />
                        <Line type="monotone" dataKey="Pengeluaran" stroke="#ef4444" activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="overflow-auto max-h-[60vh] border rounded-lg">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-secondary"><tr>
                        <th className="p-3 text-left">Tanggal</th><th className="p-3 text-left">Kategori</th>
                        <th className="p-3 text-left">Nama Pengeluaran</th><th className="p-3 text-left">Jumlah</th>
                        <th className="p-3 text-left">Catatan</th><th className="p-3 text-left">Aksi</th>
                    </tr></thead>
                    <tbody>{filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="border-b last:border-b-0 hover:bg-muted/50">
                            <td className="p-3">{expense.tanggal_pengeluaran}</td><td className="p-3">{expense.kategori}</td>
                            <td className="p-3 font-medium">{expense.nama_pengeluaran}</td>
                            <td className="p-3">
                                {`Rp ${Number(expense.jumlah).toLocaleString('id-ID')}`}
                            </td>
                            <td className="p-3">{expense.catatan}</td>
                            <td className="p-3"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => handleEdit(expense)}><Edit className="w-4 h-4" /></Button><Button size="sm" variant="destructive" onClick={() => handleDelete(expense.id)}><Trash2 className="w-4 h-4" /></Button></div></td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}><DialogContent><DialogHeader><DialogTitle>{editingExpense ? 'Edit Pengeluaran' : 'Tambah Pengeluaran Baru'}</DialogTitle><DialogDescription>Isi detail pengeluaran. Pastikan data yang dimasukkan benar.</DialogDescription></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium mb-1" htmlFor="tanggal_pengeluaran">Tanggal</label><Input id="tanggal_pengeluaran" type="date" value={formData.tanggal_pengeluaran || ''} onChange={handleInputChange} required /></div>
                        <div><label className="block text-sm font-medium mb-1" htmlFor="kategori">Kategori</label><Select value={formData.kategori || ''} onValueChange={(val) => handleSelectChange('kategori', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    <div><label className="block text-sm font-medium mb-1" htmlFor="nama_pengeluaran">Nama Pengeluaran</label><Input id="nama_pengeluaran" type="text" value={formData.nama_pengeluaran || ''} onChange={handleInputChange} required /></div>
                    <div><label className="block text-sm font-medium mb-1" htmlFor="jumlah">Jumlah (Rp)</label><Input id="jumlah" type="number" value={formData.jumlah || ''} onChange={handleInputChange} required /></div>
                    <div><label className="block text-sm font-medium mb-1" htmlFor="catatan">Catatan</label><Textarea id="catatan" value={formData.catatan || ''} onChange={handleInputChange} /></div>
                    <DialogFooter><Button type="submit">Simpan</Button></DialogFooter>
                </form>
            </DialogContent></Dialog>
        </div>
    );
};

export default ExpenseManagement;