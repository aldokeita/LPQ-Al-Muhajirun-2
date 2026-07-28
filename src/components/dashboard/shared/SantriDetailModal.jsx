import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Award, Edit, Trash2, Clock, CalendarDays, History, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, X, Minus, FileText, Download, Loader2, PieChart as PieChartIcon, BookOpen, Sparkles, UserCheck, HeartHandshake } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    calculateAttendanceData,
    getHafalanProgressData,
    getPointsData,
    getCharacterAssessmentData,
    getWaliSantriName,
    getHafalanItemName,
    generateRaporPDF,
    generateRaporDOCX
} from '@/utils/reportUtils';
import { getSessionName } from '@/utils/sessionMapping';
import { fetchSantriNotes, getAcademicErrorMessage, saveSantriNote } from '@/lib/academicAdapters';
import SantriDevelopmentProfile from '@/components/dashboard/shared/SantriDevelopmentProfile';

const SantriDetailModal = ({ santri, isOpen, onOpenChange, onPromote, onDemote }) => {
    const { user, role } = useAuth();
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [editingNote, setEditingNote] = useState(null);
    const [jilidDuration, setJilidDuration] = useState(null);
    const [lastPromotedDate, setLastPromotedDate] = useState(null);
    const [attendanceHistory, setAttendanceHistory] = useState([]);
    const [hafalanData, setHafalanData] = useState(null);
    const [attendanceSummary, setAttendanceSummary] = useState(null);
    const [characterData, setCharacterData] = useState(null);
    const [isReportViewOpen, setIsReportViewOpen] = useState(false);

    // Calendar State
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Rapor State
    const [isRaporDialogOpen, setIsRaporDialogOpen] = useState(false);
    const [raporPeriodType, setRaporPeriodType] = useState('bulanan');
    const [raporMonth, setRaporMonth] = useState((new Date().getMonth() + 1).toString());
    const [raporYear, setRaporYear] = useState(new Date().getFullYear().toString());
    const [isGeneratingRapor, setIsGeneratingRapor] = useState(false);
    const [isLoadingReportData, setIsLoadingReportData] = useState(false);
    const isPtpt = String(santri?.kategori || '').toUpperCase() === 'PTPT';

    const fetchNotes = useCallback(async () => {
        if (!santri) return;
        try {
            const data = await fetchSantriNotes(santri.id);
            setNotes(data);
        } catch (error) {
            toast({ title: "Gagal memuat catatan", description: getAcademicErrorMessage(error), variant: 'destructive' });
        }
    }, [santri]);

    const fetchJilidHistory = useCallback(async () => {
        if (!santri) return;
        const { data, error } = await supabase
            .from('jilid_history')
            .select('changed_at')
            .eq('santri_id', santri.id)
            .order('changed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let startDate = new Date(santri.created_at);
        if (data?.changed_at) {
            startDate = new Date(data.changed_at);
        }

        setLastPromotedDate(startDate);

        const now = new Date();
        const diffTime = Math.abs(now - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setJilidDuration(diffDays);
    }, [santri]);

    useEffect(() => {
        if (isOpen && santri) {
            fetchNotes();
            fetchJilidHistory();
            getCharacterAssessmentData(santri.id).then(setCharacterData).catch(console.error);
        }
    }, [isOpen, santri, fetchNotes, fetchJilidHistory]);

    const handleSaveNote = async () => {
        if (!newNote.trim()) return;
        try {
            await saveSantriNote({ noteId: editingNote?.id, santriId: santri.id, note: newNote, userId: user?.id });
            toast({ title: "Catatan disimpan!" });
            setNewNote('');
            setEditingNote(null);
            fetchNotes();
        } catch (error) {
            toast({ title: "Gagal menyimpan catatan", description: getAcademicErrorMessage(error), variant: 'destructive' });
        }
    };

    const fetchReportViewData = async () => {
        if (!santri) return;
        setIsLoadingReportData(true);
        try {
            // Get full attendance history
            const { data: attData, error: attErr } = await supabase.from('attendance').select('*').eq('user_id', santri.id);
            if (attErr) throw attErr;
            setAttendanceHistory(attData || []);

            // Fetch summary stats for current month initially
            const date = currentMonth;
            const start = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
            const end = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
            const summary = await calculateAttendanceData(santri.id, start, end);
            setAttendanceSummary(summary);

            // Fetch hafalan progress & character assessment
            const [hafalan, character] = await Promise.all([
                getHafalanProgressData(santri.id),
                getCharacterAssessmentData(santri.id)
            ]);
            setHafalanData(hafalan);
            setCharacterData(character);

            setIsReportViewOpen(true);
        } catch (error) {
            toast({ title: "Gagal memuat data", description: error.message, variant: 'destructive' });
        } finally {
            setIsLoadingReportData(false);
        }
    };

    // Update attendance summary when month changes in report view
    useEffect(() => {
        if (isReportViewOpen && santri) {
            const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString().split('T')[0];
            const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString().split('T')[0];
            calculateAttendanceData(santri.id, start, end).then(setAttendanceSummary).catch(console.error);
        }
    }, [currentMonth, isReportViewOpen, santri]);

    const handleDownloadRaporPDF = async () => {
        setIsGeneratingRapor(true);
        try {
            let startDate, endDate, periodText;
            const yearNum = parseInt(raporYear);

            if (raporPeriodType === 'bulanan') {
                const monthNum = parseInt(raporMonth);
                startDate = new Date(yearNum, monthNum - 1, 1).toISOString().split('T')[0];
                endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];
                const monthName = new Date(yearNum, monthNum - 1, 1).toLocaleString('id-ID', { month: 'long' });
                periodText = `Bulan ${monthName} Tahun ${yearNum}`;
            } else {
                startDate = new Date(yearNum, 0, 1).toISOString().split('T')[0];
                endDate = new Date(yearNum, 11, 31).toISOString().split('T')[0];
                periodText = `Tahun ${yearNum}`;
            }

            const attendance = await calculateAttendanceData(santri.id, startDate, endDate);
            const hafalan = await getHafalanProgressData(santri.id);
            const points = await getPointsData(santri.id, startDate, endDate);
            const character = await getCharacterAssessmentData(santri.id);

            const doc = await generateRaporPDF(santri, attendance, hafalan, points, periodText, character);

            const cleanName = (santri.nama_lengkap || 'Santri').replace(/[^a-zA-Z0-9]/g, '_');
            const cleanPeriod = periodText.replace(/[^a-zA-Z0-9]/g, '_');

            doc.save(`Rapor_${cleanName}_${cleanPeriod}.pdf`);

            toast({ title: "Berhasil", description: "Rapor PDF berhasil diunduh!" });
            setIsRaporDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({ title: "Gagal", description: error.message, variant: "destructive" });
        } finally {
            setIsGeneratingRapor(false);
        }
    };

    const handleDownloadRaporDOCX = async () => {
        setIsGeneratingRapor(true);
        try {
            let startDate, endDate, periodText;
            const yearNum = parseInt(raporYear);

            if (raporPeriodType === 'bulanan') {
                const monthNum = parseInt(raporMonth);
                startDate = new Date(yearNum, monthNum - 1, 1).toISOString().split('T')[0];
                endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];
                const monthName = new Date(yearNum, monthNum - 1, 1).toLocaleString('id-ID', { month: 'long' });
                periodText = `Bulan ${monthName} Tahun ${yearNum}`;
            } else {
                startDate = new Date(yearNum, 0, 1).toISOString().split('T')[0];
                endDate = new Date(yearNum, 11, 31).toISOString().split('T')[0];
                periodText = `Tahun ${yearNum}`;
            }

            const attendance = await calculateAttendanceData(santri.id, startDate, endDate);
            const hafalan = await getHafalanProgressData(santri.id);
            const points = await getPointsData(santri.id, startDate, endDate);
            const character = await getCharacterAssessmentData(santri.id);

            const docxBlob = await generateRaporDOCX(santri, attendance, hafalan, points, periodText, character);

            const cleanName = (santri.nama_lengkap || 'Santri').replace(/[^a-zA-Z0-9]/g, '_');
            const cleanPeriod = periodText.replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `Rapor_${cleanName}_${cleanPeriod}.docx`;

            const url = URL.createObjectURL(docxBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast({ title: "Berhasil", description: "Rapor DOCX berhasil diunduh!" });
            setIsRaporDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({ title: "Gagal", description: error.message, variant: "destructive" });
        } finally {
            setIsGeneratingRapor(false);
        }
    };

    // Calendar & Matrix Helpers
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    // Render Working Days Attendance Matrix (5 days: Mon - Fri)
    const renderWorkingDaysAttendanceMatrix = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = new Date().toLocaleDateString('en-CA');

        const workingDays = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month, d);
            const dayOfWeek = dateObj.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat

            // Skip Saturday (6) and Sunday (0)
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isPast = dateStr < todayStr;
            const isToday = dateStr === todayStr;

            const attRecord = (attendanceHistory || []).find(a => a.attendance_date === dateStr);
            let status = '-';
            let badgeStyle = "bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 border-slate-200 dark:border-slate-800";

            if (attRecord) {
                const s = (attRecord.status || '').toLowerCase();
                if (s.includes('hadir') || s === 'on_time') {
                    status = 'Hadir';
                    badgeStyle = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold";
                } else if (s.includes('terlambat')) {
                    status = 'Terlambat';
                    badgeStyle = "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold";
                } else if (s.includes('izin') || s.includes('sakit')) {
                    status = 'Izin/Sakit';
                    badgeStyle = "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 border-sky-300 dark:border-sky-800 font-bold";
                } else {
                    status = 'TH';
                    badgeStyle = "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold";
                }
            } else if (isPast) {
                // Rule TH: Past working day without attendance record = TH (Rose)
                status = 'TH';
                badgeStyle = "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold";
            } else {
                // Rule Neutral: Today or future working day without attendance record = '-'
                status = isToday ? 'Hari Ini' : '-';
                badgeStyle = isToday
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 font-semibold"
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 border-slate-200 dark:border-slate-800";
            }

            const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'short' });

            workingDays.push({
                dayNumber: d,
                dayName,
                dateStr,
                status,
                badgeStyle
            });
        }

        return (
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-teal-600 dark:text-teal-400"/> Matriks Presensi 5 Hari Kerja (Senin – Jumat)
                    </h4>
                    <div className="flex items-center gap-2.5 text-[11px] font-medium flex-wrap">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Hadir</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Terlambat</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span> Izin/Sakit</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> TH (Berlalu)</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                    {workingDays.map((item, idx) => (
                        <div key={idx} className={cn("p-2 rounded-xl border text-center flex flex-col justify-between transition-all duration-150", item.badgeStyle)}>
                            <div className="flex justify-between items-center text-[10px] opacity-75 border-b border-current/10 pb-0.5 mb-1">
                                <span>{item.dayName}</span>
                                <span className="font-bold">{item.dayNumber}</span>
                            </div>
                            <span className="text-xs font-black py-0.5">{item.status}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (!santri) return null;

    const waliName = getWaliSantriName(santri);
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({length: 5}, (_, i) => (currentYear - i).toString());

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <DialogHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mr-6">
                            <div>
                                <DialogTitle className="text-2xl font-bold font-serif text-slate-800 dark:text-slate-100">
                                    Detail Santri: {santri.nama_lengkap}
                                </DialogTitle>
                                <DialogDescription>Informasi lengkap, biodata wali, & catatan perkembangan akademik.</DialogDescription>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {/* Aurora Neo Glass 'Absensi' Button */}
                                <Button
                                    variant="outline"
                                    onClick={fetchReportViewData}
                                    disabled={isLoadingReportData}
                                    className="bg-gradient-to-r from-teal-500/20 via-cyan-500/20 to-emerald-500/20 hover:from-teal-500/30 hover:to-cyan-500/30 text-teal-800 dark:text-teal-200 border border-teal-500/30 backdrop-blur-md shadow-sm transition-all rounded-xl font-bold"
                                >
                                    {isLoadingReportData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarDays className="w-4 h-4 mr-2 text-teal-600 dark:text-teal-400"/>}
                                    Absensi
                                </Button>
                                <Button
                                    variant="default"
                                    onClick={() => setIsRaporDialogOpen(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-xl font-semibold"
                                >
                                    <FileText className="w-4 h-4 mr-2"/> Download Rapor
                                </Button>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Santri Header Profile Card */}
                    <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6 pt-4 border-b border-slate-200 dark:border-slate-800 pb-6 relative">
                        <div className="flex flex-col gap-3 items-center">
                            <Avatar className="w-32 h-32 flex-shrink-0 border-4 border-slate-100 shadow-md">
                                <AvatarImage src={santri.foto_url} className="object-cover" />
                                <AvatarFallback className="text-4xl font-bold">{santri.nama_lengkap?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex gap-2 w-full justify-center">
                                {(onPromote || onDemote) && (
                                    <>
                                        {onPromote && (
                                            <Button onClick={onPromote} size="sm" variant="outline" className="h-8 flex-1 border-green-200 hover:bg-green-50 text-green-700" title="Naik Jilid">
                                                <ChevronUp className="w-4 h-4 mr-1" /> Naik
                                            </Button>
                                        )}
                                        {onDemote && (
                                            <Button onClick={onDemote} size="sm" variant="outline" className="h-8 flex-1 border-red-200 hover:bg-red-50 text-red-700" title="Turun Jilid">
                                                <ChevronDown className="w-4 h-4 mr-1" /> Turun
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                            {jilidDuration !== null && (
                                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${jilidDuration > 90 ? 'bg-red-100 text-red-600 border-red-200' : 'bg-blue-100 text-blue-600 border-blue-200'} flex items-center gap-1 mt-1`}>
                                    <Clock className="w-3 h-3"/> {jilidDuration} Hari di Jilid {santri.jilid}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm w-full bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Nama Lengkap</p>
                                <p className="font-bold text-base text-slate-800 dark:text-slate-200">{santri.nama_lengkap}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Nama Panggilan</p>
                                <p className="font-bold text-base text-slate-800 dark:text-slate-200">{santri.nama_panggilan || '-'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Wali Santri (Ibu/Ayah)</p>
                                <p className="font-bold text-base text-indigo-700 dark:text-indigo-400">{waliName}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Jilid Saat Ini</p>
                                <p className="font-black text-lg text-purple-600 dark:text-purple-400">{santri.jilid}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Kelas & Sesi</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{santri.class?.nama_kelas || '-'} ({santri.sesi_mengaji || '-'})</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Terakhir Naik Jilid</p>
                                <p className="font-bold flex items-center gap-1 text-slate-800 dark:text-slate-200">
                                    <CalendarDays className="w-4 h-4 text-purple-500"/>
                                    {lastPromotedDate ? new Date(lastPromotedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric'}) : '-'}
                                </p>
                            </div>
                            {characterData?.strengths?.length > 0 && (
                                <div className="col-span-1 sm:col-span-2 md:col-span-3 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold flex items-center gap-1 mb-1">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500"/> Karakter Unggulan
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {characterData.strengths.map((str, idx) => (
                                            <Badge key={idx} variant="secondary" className="bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border-teal-200 dark:border-teal-800 text-xs font-semibold">
                                                ★ {str}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-6">
                        <SantriDevelopmentProfile
                            santriId={santri.id}
                            userId={user?.id}
                            editable={role === 'guru'}
                            showBehavior={role === 'guru'}
                        />
                    </div>

                    <div className="pt-6 space-y-4">
                        <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <Award className="w-5 h-5 text-yellow-500"/> Catatan Guru & Perkembangan
                        </h3>
                        <div className="space-y-3 bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <Textarea
                                placeholder="Tulis catatan, rekomendasi, atau evaluasi akademik..."
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                className="border-slate-300 dark:border-slate-700 focus:border-primary min-h-[100px] resize-none"
                            />
                            <div className="flex justify-end gap-2">
                                {editingNote && <Button variant="ghost" onClick={() => { setEditingNote(null); setNewNote('')}}>Batal Edit</Button>}
                                <Button onClick={handleSaveNote} className="bg-primary hover:bg-primary/90 text-white shadow-sm">
                                    {editingNote ? 'Simpan Perubahan' : 'Tambah Catatan'}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-4 mt-6">
                            {notes.map(note => (
                                <div key={note.id} className="text-sm p-4 border border-slate-200 dark:border-slate-800 rounded-xl relative group bg-white dark:bg-slate-900 hover:shadow-md transition-all duration-200">
                                    <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 text-base leading-relaxed">{note.note}</p>
                                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                                                {note.guru?.nama?.substring(0,2) || 'GU'}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800 dark:text-slate-200">{note.guru?.nama || 'Unknown'}</p>
                                                <p className="text-[10px] text-muted-foreground">{new Date(note.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                            </div>
                                        </div>
                                        {note.guru_id === user.id && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600" onClick={() => { setEditingNote(note); setNewNote(note.note); }}>
                                                    <Edit className="w-4 h-4"/>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {notes.length === 0 && (
                                <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                                    <p className="text-muted-foreground italic">Belum ada catatan evaluasi untuk santri ini.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Comprehensive Interactive Preview Rapor Dialog */}
            <Dialog open={isReportViewOpen} onOpenChange={setIsReportViewOpen}>
                <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0 bg-slate-50 dark:bg-slate-950">
                    <div className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-indigo-600"/> Preview Rapor Santri
                            </DialogTitle>
                            <DialogDescription>Ringkasan presensi, matriks 5 hari kerja, hafalan terstruktur & 15 aspek karakter</DialogDescription>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="h-4 w-4"/></Button>
                                <span className="text-sm font-bold min-w-[120px] text-center">{currentMonth.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</span>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="h-4 w-4"/></Button>
                            </div>
                            <Button onClick={() => setIsRaporDialogOpen(true)} variant="default" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                <Download className="w-4 h-4 mr-2"/> Unduh Rapor
                            </Button>
                        </div>
                    </div>

                    <div className="p-6 space-y-8 bg-white dark:bg-slate-950 m-4 rounded-2xl shadow-sm border">
                        {/* Header Banner Rapor (Royal Blue) */}
                        <div className="text-center py-6 px-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white rounded-xl shadow-sm">
                            <h2 className="text-2xl font-black font-serif uppercase tracking-widest text-white">Laporan Akademik Santri LPQ Al-Muhajirun</h2>
                            <p className="text-amber-300 font-medium text-sm mt-1">Laporan Capaian Presensi, Hafalan & Pembentukan Karakter</p>
                            <p className="text-slate-200 text-xs mt-1">Periode: {currentMonth.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</p>
                        </div>

                        {/* Profil Ringkas Santri */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Nama Lengkap</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{santri.nama_lengkap}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Wali Santri (Ibu/Ayah)</p>
                                <p className="font-bold text-indigo-700 dark:text-indigo-400">{waliName}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Kelas / Sesi</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{santri.class?.nama_kelas || '-'} ({santri.sesi_mengaji || '-'})</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Jilid / Tingkat</p>
                                <p className="font-bold text-purple-600 dark:text-purple-400">{santri.jilid || '-'} ({santri.kategori || 'Anak'})</p>
                            </div>
                        </div>

                        {/* 5 Working Days Attendance Matrix Grid */}
                        {renderWorkingDaysAttendanceMatrix()}

                        {/* Ringkasan Presensi Table */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <History className="w-5 h-5 text-blue-500"/> Rekapitulasi Presensi Bulan Ini
                            </h3>

                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold uppercase text-xs">
                                        <tr>
                                            <th className="p-3">Status</th>
                                            <th className="p-3 text-center">Hadir</th>
                                            <th className="p-3 text-center">Terlambat</th>
                                            <th className="p-3 text-center">Izin / Sakit</th>
                                            <th className="p-3 text-center">Alpha / TH</th>
                                            <th className="p-3 text-right">Persentase</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendanceSummary ? (
                                            <tr className="border-t border-slate-100 dark:border-slate-800/60 font-medium">
                                                <td className="p-3">
                                                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold", attendanceSummary.attendancePercentage >= 85 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : attendanceSummary.attendancePercentage >= 70 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300")}>
                                                        {attendanceSummary.attendancePercentage >= 85 ? 'Sangat Baik' : attendanceSummary.attendancePercentage >= 70 ? 'Cukup' : 'Kurang'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center font-bold">{attendanceSummary.totalPresent} Hari</td>
                                                <td className="p-3 text-center font-bold">{attendanceSummary.totalLate || 0} Hari</td>
                                                <td className="p-3 text-center font-bold">{attendanceSummary.totalPermit} Hari</td>
                                                <td className="p-3 text-center font-bold">{attendanceSummary.totalAbsent} Hari</td>
                                                <td className="p-3 text-right font-black text-base text-indigo-600 dark:text-indigo-400">
                                                    {attendanceSummary.attendancePercentage}%
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr><td colSpan="6" className="p-4 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto"/></td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 15 Aspek Perkembangan Karakter Table */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <Award className="w-5 h-5 text-teal-600 dark:text-teal-400"/> 15 Aspek Perkembangan Karakter & Adab
                            </h3>

                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-teal-700 text-white font-bold uppercase text-xs">
                                        <tr>
                                            <th className="p-3 w-12 text-center">No</th>
                                            <th className="p-3">Aspek Karakter & Adab</th>
                                            <th className="p-3 text-center w-28">Skor (1-4)</th>
                                            <th className="p-3 text-center w-48">Predikat</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {characterData?.items?.length > 0 ? (
                                            characterData.items.map((item, idx) => (
                                                <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                                    <td className="p-3 text-center font-bold text-muted-foreground">{idx + 1}</td>
                                                    <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{item.item_name}</td>
                                                    <td className="p-3 text-center font-black text-teal-700 dark:text-teal-300">{item.score} / 4</td>
                                                    <td className="p-3 text-center">
                                                        <span className={cn(
                                                            "px-2.5 py-0.5 rounded-full text-xs font-bold border",
                                                            item.score === 4 ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" :
                                                            item.score === 3 ? "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300" :
                                                            item.score === 2 ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300" :
                                                            "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
                                                        )}>
                                                            {item.code} · {item.label}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="p-6 text-center text-muted-foreground italic">Belum ada data penilaian karakter.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Structured Hafalan Items Table (Doa -> Sholat -> Surat -> Tahfizh) */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400"/> Progres Hafalan (Doa, Sholat, Surat & Tahfizh)
                            </h3>

                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-800 text-white font-bold uppercase text-xs">
                                        <tr>
                                            <th className="p-3">Nama Item / Surat</th>
                                            <th className="p-3">Kategori</th>
                                            <th className="p-3 text-center">Status Penyelesaian</th>
                                            <th className="p-3 text-right">Tanggal Update</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {hafalanData?.allItems?.length > 0 ? (
                                            hafalanData.allItems.map((item, idx) => (
                                                <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                                    <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                                                        {getHafalanItemName(item)}
                                                    </td>
                                                    <td className="p-3 text-muted-foreground">{item.category || '-'}</td>
                                                    <td className="p-3 text-center">
                                                        {item.is_completed ? (
                                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center gap-1 w-fit mx-auto">
                                                                <Check className="w-3 h-3"/> Lulus
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center gap-1 w-fit mx-auto">
                                                                <Clock className="w-3 h-3"/> Belum Lulus
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right text-xs text-muted-foreground">
                                                        {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric'}) : '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="p-6 text-center text-muted-foreground italic">Belum ada data hafalan yang tercatat.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="pt-6 border-t text-center space-y-3">
                            <p className="text-sm text-muted-foreground">Unduh dokumen resmi Rapor Santri LPQ Al-Muhajirun dalam format PDF atau Word DOCX.</p>
                            <div className="flex justify-center gap-3">
                                <Button onClick={() => { setIsReportViewOpen(false); setIsRaporDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                                    <Download className="w-4 h-4 mr-2"/> Unduh Rapor Official
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Rapor Download Options Dialog */}
            <Dialog open={isRaporDialogOpen} onOpenChange={setIsRaporDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold font-serif">Download Rapor Santri</DialogTitle>
                        <DialogDescription>Pilih periode evaluasi dan format file (PDF / DOCX).</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tipe Periode Evaluasi</label>
                            <Select value={raporPeriodType} onValueChange={setRaporPeriodType}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Pilih tipe periode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="bulanan">Rapor Bulanan</SelectItem>
                                    <SelectItem value="tahunan">Rapor Tahunan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {raporPeriodType === 'bulanan' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Bulan</label>
                                    <Select value={raporMonth} onValueChange={setRaporMonth}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Bulan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({length: 12}, (_, i) => (
                                                <SelectItem key={i+1} value={(i+1).toString()}>
                                                    {new Date(2000, i, 1).toLocaleString('id-ID', { month: 'long' })}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className={raporPeriodType === 'tahunan' ? "col-span-2 space-y-2" : "space-y-2"}>
                                <label className="text-sm font-medium">Tahun</label>
                                <Select value={raporYear} onValueChange={setRaporYear}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Tahun" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {yearOptions.map(y => (
                                            <SelectItem key={y} value={y}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-muted-foreground space-y-1">
                            <p className="font-semibold text-slate-700 dark:text-slate-300">Catatan Dokumen Official:</p>
                            <p>• <strong>PDF Native:</strong> Siap cetak presisi dengan Kop Royal Blue & 3 Blok Tanda Tangan.</p>
                            <p>• <strong>DOCX Native:</strong> Dokumen Microsoft Word murni tanpa error unreadable content.</p>
                        </div>
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => setIsRaporDialogOpen(false)} disabled={isGeneratingRapor} className="rounded-xl">Batal</Button>

                        <Button onClick={handleDownloadRaporDOCX} disabled={isGeneratingRapor} variant="secondary" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                            {isGeneratingRapor ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Download className="w-4 h-4 mr-1"/>}
                            Unduh DOCX
                        </Button>

                        <Button onClick={handleDownloadRaporPDF} disabled={isGeneratingRapor} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                            {isGeneratingRapor ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Download className="w-4 h-4 mr-1"/>}
                            Unduh PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default SantriDetailModal;
