import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { CheckCircle, XCircle, User, MapPin, Smartphone, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';

const LoginLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', description: '', onConfirm: () => {} });
    const ITEMS_PER_PAGE = 15;

    const fetchLogs = useCallback(async (reset = false) => {
        setLoading(true);
        const currentPage = reset ? 0 : page;

        let query = supabase
            .from('login_logs')
            .select('*')
            // The policy "Allow admin to read non-admin login logs" handles the filtering on the backend
            .order('created_at', { ascending: false })
            .range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1);
        
        if (searchTerm) {
            query = query.or(`username_attempt.ilike.%${searchTerm}%,ip_address.ilike.%${searchTerm}%,role.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query;
        
        if (error) {
            toast({ title: 'Gagal memuat log', description: error.message, variant: 'destructive' });
        } else {
            setLogs(prev => {
                if (reset) return data;
                const newItems = data.filter(d => !prev.some(p => p.id === d.id));
                return [...prev, ...newItems];
            });

            if (data.length < ITEMS_PER_PAGE) {
                setHasMore(false);
            } else {
                setHasMore(true);
                if (!reset) setPage(currentPage + 1);
            }
        }
        setLoading(false);
    }, [page, searchTerm]);

    useEffect(() => {
        setPage(0);
        fetchLogs(true);
    }, [searchTerm]);


    const handleSearch = (e) => {
        e.preventDefault();
        setPage(0);
        setLogs([]);
        fetchLogs(true);
    };
    
    const handleDeleteLog = (logId) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Hapus Log Login',
            description: 'Apakah Anda yakin ingin menghapus catatan log ini? Tindakan ini tidak dapat dibatalkan.',
            onConfirm: async () => {
                const { error } = await supabase.from('login_logs').delete().eq('id', logId);
                if (error) {
                    toast({ title: 'Gagal Hapus Log', description: error.message, variant: 'destructive'});
                } else {
                    toast({ title: 'Berhasil', description: 'Log berhasil dihapus.'});
                    setLogs(prev => prev.filter(log => log.id !== logId));
                }
            }
        });
    };

    return (
        <div className="bg-card p-6 rounded-2xl shadow-xl">
            <h2 className="text-2xl font-bold text-accent-foreground mb-4">Log Aktivitas Login</h2>
            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                <Input
                    placeholder="Cari username, IP, atau peran..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button type="submit">Cari</Button>
            </form>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                {logs.map(log => (
                    <div key={log.id} className={`p-4 border-l-4 rounded-r-lg group ${log.status === 'success' ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}>
                        <div className="flex flex-wrap justify-between items-start gap-2">
                            <div className="flex items-center gap-3">
                                {log.status === 'success' ? <CheckCircle className="w-6 h-6 text-green-500" /> : <XCircle className="w-6 h-6 text-red-500" />}
                                <div className="font-bold text-lg">{log.username_attempt}</div>
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${log.status === 'success' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                    {log.status === 'success' ? 'Berhasil' : 'Gagal'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                {new Date(log.created_at).toLocaleString('id-ID')}
                                <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteLog(log.id)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                        <div className="mt-2 pl-9 grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1"><User className="w-4 h-4"/> Peran: <span className="font-medium text-foreground">{log.role || 'N/A'}</span></div>
                            <div className="flex items-center gap-1"><MapPin className="w-4 h-4"/> Lokasi: <span className="font-medium text-foreground">{log.city || 'N/A'}, {log.country || 'N/A'}</span></div>
                            <div className="flex items-center gap-1"><Smartphone className="w-4 h-4"/> Perangkat: <span className="font-medium text-foreground">{log.device || 'N/A'}</span></div>
                            <div className="col-span-1 md:col-span-3 flex items-center gap-1 truncate">
                                IP: <span className="font-medium text-foreground">{log.ip_address}</span>
                            </div>
                        </div>
                    </div>
                ))}
                {loading && <p>Memuat...</p>}
                {!loading && logs.length === 0 && <p className="text-center text-muted-foreground py-8">Tidak ada log yang ditemukan.</p>}
            </div>
            {hasMore && !loading && (
                <div className="text-center mt-6">
                    <Button onClick={() => fetchLogs()} variant="outline">Muat Lebih Banyak</Button>
                </div>
            )}
            <ConfirmationDialog 
                isOpen={confirmDialog.isOpen} 
                onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} 
                onConfirm={confirmDialog.onConfirm} 
                title={confirmDialog.title} 
                description={confirmDialog.description} 
            />
        </div>
    );
};

export default LoginLogs;