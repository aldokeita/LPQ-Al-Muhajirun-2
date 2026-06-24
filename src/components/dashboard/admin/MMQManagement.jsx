import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Search, Calendar, Clock, CheckCircle2, XCircle, Plus, BookOpen, Trash2, Edit } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMMQAttendance } from '@/hooks/useMMQAttendance';
import MMQScheduleForm from './MMQScheduleForm';
import MMQAttendanceModal from './MMQAttendanceModal';
import { formatTimestamp, calculateTimeDifference } from '@/utils/AttendanceStatusLogic';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const StatusBadge = ({ status }) => {
    switch (status) {
        case 'Hadir': return <Badge className="mmq-status-hadir shadow-sm border-none"><CheckCircle2 className="w-3 h-3 mr-1"/> Hadir</Badge>;
        case 'Terlambat': return <Badge className="mmq-status-terlambat shadow-sm border-none"><Clock className="w-3 h-3 mr-1"/> Terlambat</Badge>;
        default: return <Badge className="mmq-status-tidak-hadir shadow-sm border-none"><XCircle className="w-3 h-3 mr-1"/> Tidak Hadir</Badge>;
    }
};

const MMQManagement = () => {
    const { toast } = useToast();
    const { fetchMMQSchedule, fetchMMQAttendance, saveMMQAttendance, deleteMMQAttendance, updateMMQSchedule, deleteMMQSchedule } = useMMQAttendance();
    
    const [activeTab, setActiveTab] = useState('history');
    
    // Data states
    const [schedules, setSchedules] = useState([]);
    const [attendances, setAttendances] = useState([]);
    const [gurus, setGurus] = useState([]);
    
    // Filter states
    const [historyDateFilter, setHistoryDateFilter] = useState(new Date().toLocaleDateString('en-CA'));
    const [historySearch, setHistorySearch] = useState('');
    const [guruSearch, setGuruSearch] = useState('');
    
    // Modals & Forms
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [editingAttendance, setEditingAttendance] = useState(null);

    const loadData = async () => {
        const scheduleData = await fetchMMQSchedule();
        if (scheduleData) setSchedules(scheduleData);

        const attendanceData = await fetchMMQAttendance({ date: historyDateFilter });
        if (attendanceData) setAttendances(attendanceData);

        const { data: guruData } = await supabase.from('guru').select('id, nama, email, no_hp, foto_url');
        if (guruData) setGurus(guruData);
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [historyDateFilter]);

    // Derived Data: Guru List with Today's MMQ Status
    const guruListWithStatus = gurus.map(guru => {
        const todayAttendance = attendances.find(a => a.guru_id === guru.id && a.attendance_date === new Date().toLocaleDateString('en-CA'));
        return {
            ...guru,
            todayStatus: todayAttendance?.status || 'Belum Tap',
            checkInTime: todayAttendance?.check_in_timestamp
        };
    }).filter(g => g.nama.toLowerCase().includes(guruSearch.toLowerCase()));

    // Filtered History
    const filteredHistory = attendances.filter(a => a.guru?.nama.toLowerCase().includes(historySearch.toLowerCase()));

    // Handlers
    const handleSaveSchedule = async (data) => {
        const result = await updateMMQSchedule(data);
        if (result.success) {
            toast({ title: "Berhasil", description: "Jadwal MMQ disimpan." });
            setIsScheduleModalOpen(false);
            loadData();
        } else {
            toast({ title: "Gagal", description: result.error, variant: "destructive" });
        }
    };

    const handleDeleteSchedule = async (id) => {
        if (!window.confirm("Hapus jadwal ini?")) return;
        const result = await deleteMMQSchedule(id);
        if (result.success) {
            toast({ title: "Berhasil", description: "Jadwal dihapus." });
            loadData();
        }
    };

    const handleSaveAttendance = async (data) => {
        const result = await saveMMQAttendance(data);
        if (result.success) {
            toast({ title: "Berhasil", description: "Absensi MMQ diperbarui." });
            loadData();
        } else {
            toast({ title: "Gagal", description: result.error, variant: "destructive" });
        }
    };

    const handleDeleteAttendance = async (id) => {
        const result = await deleteMMQAttendance(id);
        if (result.success) {
            toast({ title: "Berhasil", description: "Record dihapus." });
            loadData();
        }
    };

    return (
        <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="flex items-center gap-2 text-2xl text-slate-800 dark:text-slate-100">
                    <BookOpen className="w-6 h-6 text-primary" />
                    Manajemen MMQ (Majelis Mu'allimil Qur'an)
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="mb-6 grid grid-cols-3 max-w-2xl bg-slate-100 dark:bg-slate-800">
                        <TabsTrigger value="history">Riwayat Absensi</TabsTrigger>
                        <TabsTrigger value="schedule">Jadwal MMQ</TabsTrigger>
                        <TabsTrigger value="guru">Daftar Guru</TabsTrigger>
                    </TabsList>

                    {/* TAB: HISTORY */}
                    <TabsContent value="history" className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
                            <div className="flex items-center gap-2">
                                <Input 
                                    type="date" 
                                    value={historyDateFilter} 
                                    onChange={(e) => setHistoryDateFilter(e.target.value)}
                                    className="w-40"
                                />
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input 
                                    placeholder="Cari guru..." 
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">Guru</th>
                                            <th className="px-4 py-3 font-semibold">Waktu Masuk</th>
                                            <th className="px-4 py-3 font-semibold">Status</th>
                                            <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredHistory.length > 0 ? filteredHistory.map(record => {
                                            const timeDiff = record.status === 'Terlambat' && record.check_in_timestamp && record.schedule?.start_time
                                                ? calculateTimeDifference(record.check_in_timestamp, new Date(`${record.attendance_date}T${record.schedule.start_time}`).toISOString())
                                                : 0;

                                            return (
                                                <tr key={record.id} className="mmq-table-row">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="w-8 h-8">
                                                                <AvatarImage src={record.guru?.foto_url} />
                                                                <AvatarFallback>{record.guru?.nama?.[0]}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="font-semibold text-slate-800 dark:text-slate-200">{record.guru?.nama}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                                                        {record.check_in_timestamp ? new Date(record.check_in_timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col items-start gap-1">
                                                            <StatusBadge status={record.status} />
                                                            {timeDiff > 0 && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Lat: {timeDiff} mnt</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => { setEditingAttendance(record); setIsAttendanceModalOpen(true); }}>
                                                            <Edit className="w-4 h-4 text-blue-500" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        }) : (
                                            <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Tidak ada data absensi untuk tanggal ini.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </TabsContent>

                    {/* TAB: SCHEDULE */}
                    <TabsContent value="schedule" className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Daftar Jadwal MMQ</h3>
                            <Button onClick={() => { setEditingSchedule(null); setIsScheduleModalOpen(true); }} className="bg-primary">
                                <Plus className="w-4 h-4 mr-2" /> Tambah Jadwal
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {schedules.map(sch => (
                                <Card key={sch.id} className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-5 h-5 text-blue-500" />
                                                <span className="font-bold text-lg">{DAYS[sch.day_of_week]}</span>
                                            </div>
                                            <Badge variant={sch.is_active ? "default" : "secondary"}>
                                                {sch.is_active ? 'Aktif' : 'Nonaktif'}
                                            </Badge>
                                        </div>
                                        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4" />
                                                {sch.start_time?.substring(0, 5) || '-'}
                                                {sch.end_time ? ` - ${sch.end_time.substring(0, 5)}` : ''} WIB
                                            </div>
                                            <div className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> {sch.location}</div>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <Button variant="outline" size="sm" onClick={() => { setEditingSchedule(sch); setIsScheduleModalOpen(true); }}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => handleDeleteSchedule(sch.id)} className="text-red-500 hover:text-red-700">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {schedules.length === 0 && (
                                <div className="col-span-full text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">Belum ada jadwal MMQ diatur.</div>
                            )}
                        </div>
                    </TabsContent>

                    {/* TAB: GURU LIST */}
                    <TabsContent value="guru" className="space-y-4">
                        <div className="relative w-full sm:w-64 mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input placeholder="Cari guru..." value={guruSearch} onChange={(e) => setGuruSearch(e.target.value)} className="pl-9" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {guruListWithStatus.map(guru => (
                                <div key={guru.id} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                                        <AvatarImage src={guru.foto_url} />
                                        <AvatarFallback>{guru.nama?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{guru.nama}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {guru.todayStatus === 'Belum Tap' ? (
                                                <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 dark:bg-red-900/20">Belum Absen</Badge>
                                            ) : (
                                                <StatusBadge status={guru.todayStatus} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>

            {/* Modals */}
            <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingSchedule ? 'Edit Jadwal MMQ' : 'Tambah Jadwal MMQ'}</DialogTitle>
                    </DialogHeader>
                    <MMQScheduleForm 
                        initialData={editingSchedule} 
                        onSave={handleSaveSchedule} 
                        onCancel={() => setIsScheduleModalOpen(false)} 
                    />
                </DialogContent>
            </Dialog>

            <MMQAttendanceModal
                isOpen={isAttendanceModalOpen}
                onClose={() => { setIsAttendanceModalOpen(false); setEditingAttendance(null); }}
                record={editingAttendance}
                onSave={handleSaveAttendance}
                onDelete={handleDeleteAttendance}
            />
        </Card>
    );
};

export default MMQManagement;
