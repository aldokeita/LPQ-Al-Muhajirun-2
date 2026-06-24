import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Percent, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import AttendanceDetailsModal from '../shared/AttendanceDetailsModal';
import { determineAttendanceStatus, calculateTimeDifference } from '@/utils/AttendanceStatusLogic';

const sessionTimes = {
  'Pagi': { start: '08:00' },
  'Siang': { start: '13:00' },
  'Sore': { start: '16:00' },
  'Malam': { start: '18:30' },
};

const getSessionStartTimestamp = (dateStr, sesiName) => {
    if (!sesiName || !sessionTimes[sesiName]) return null;
    const { start } = sessionTimes[sesiName];
    return new Date(`${dateStr}T${start}:00`).toISOString();
};

const normalizeStatus = (rawStatus) => {
    if (!rawStatus) return 'Tidak Hadir';
    const s = String(rawStatus).toLowerCase().trim();
    
    if (s === 'on_time' || s === 'hadir' || s.includes('tepat waktu')) {
        return 'Hadir';
    }
    if (s.includes('terlambat')) {
        return 'Terlambat';
    }
    if (s.includes('tidak hadir') || s === 'alpa' || s === 'alpha') {
        return 'Tidak Hadir';
    }
    
    return 'Hadir'; // Fallback for unexpected valid values
};

// Helper strictly using timestamp comparison if available
const getComputedStatus = (record, sessionStart) => {
    if (!record) return 'Tidak Hadir';
    
    if (record.check_in_timestamp) {
        return determineAttendanceStatus(record.check_in_timestamp, sessionStart);
    }
    
    // Fallback to raw status if no timestamp is provided
    return normalizeStatus(record.status);
};

const SantriAbsensiRecap = () => {
    const { user } = useAuth();
    const [attendance, setAttendance] = useState([]);
    const [holidays, setHolidays] = useState(new Set());
    const [santriData, setSantriData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalDetails, setModalDetails] = useState(null);

    const fetchAllData = async () => {
        if (!user?.id) {
            console.error("SantriAbsensiRecap Error: No user_id available.");
            return;
        }

        setIsLoading(true);

        try {
            const [attendanceRes, calendarRes, santriRes] = await Promise.all([
                supabase.from('attendance')
                    .select('id, user_id, attendance_date, check_in_timestamp, check_in_time, status, role, class_id, sesi')
                    .eq('user_id', user.id)
                    .order('attendance_date', { ascending: true }),
                supabase.from('academic_calendar').select('date').eq('is_holiday', true),
                supabase
                    .from('santri')
                    .select('id, nama_lengkap, sesi_mengaji, current_class_id, foto_url, kategori, status, class:current_class_id(sesi, nama_kelas)')
                    .eq('id', user.id)
                    .single()
            ]);

            if (attendanceRes.error) {
                console.error("[DEBUG] Error fetching attendance:", attendanceRes.error);
                throw attendanceRes.error;
            }
            
            setAttendance(attendanceRes.data || []);
            setHolidays(new Set((calendarRes.data || []).map(c => c.date)));
            setSantriData(santriRes.data);
        } catch (err) {
            setError(err.message);
            console.error("[DEBUG] Error in fetchAllData:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [user?.id]);

    const stats = useMemo(() => {
        let totalSessions = 0;
        let hadirCount = 0;
        let terlambatCount = 0;
        let tidakHadirCount = 0;

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let d = 1; d <= daysInMonth; d++) {
            const dateToCompare = new Date(year, month, d);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayOfWeek = dateToCompare.getDay();

            // Count only weekday dates in the month (Mon-Fri)
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                const isHoliday = holidays.has(dateStr);
                const isPastOrToday = dateToCompare <= today;

                if (!isHoliday && isPastOrToday) {
                    totalSessions++;
                    
                    const record = attendance.find(a => a.attendance_date === dateStr);
                    const sessionStart = getSessionStartTimestamp(dateStr, santriData?.sesi_mengaji || santriData?.class?.sesi);
                    const computedStatus = getComputedStatus(record, sessionStart);

                    if (computedStatus === 'Hadir') {
                        hadirCount++;
                    } else if (computedStatus === 'Terlambat') {
                        terlambatCount++;
                    } else {
                        tidakHadirCount++;
                    }
                }
            }
        }

        let hadirPerc = 0;
        let terlambatPerc = 0;
        let tidakHadirPerc = 0;
        let overallPerc = 0;

        if (totalSessions > 0) {
            hadirPerc = Math.round((hadirCount / totalSessions) * 1000) / 10;
            terlambatPerc = Math.round((terlambatCount / totalSessions) * 1000) / 10;
            tidakHadirPerc = Math.round((tidakHadirCount / totalSessions) * 1000) / 10;
            overallPerc = hadirPerc + terlambatPerc;
        }

        return { 
            hadir_count: hadirCount,
            hadir_percentage: hadirPerc,
            terlambat_count: terlambatCount,
            terlambat_percentage: terlambatPerc,
            tidak_hadir_count: tidakHadirCount,
            tidak_hadir_percentage: tidakHadirPerc,
            total_sessions: totalSessions,
            overall_percentage: overallPerc
        };
    }, [attendance, currentDate, holidays, santriData]);

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const handleDayClick = (day) => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const record = attendance.find(a => a.attendance_date === dateStr);
        
        const sessionStart = getSessionStartTimestamp(dateStr, santriData?.sesi_mengaji || santriData?.class?.sesi);
        const finalStatus = getComputedStatus(record, sessionStart);

        setModalDetails({
            id: record?.id,
            user_id: user.id,
            user_role: 'santri',
            status: finalStatus,
            attendance_date: dateStr,
            checkInTimestamp: record?.check_in_timestamp,
            sessionStartTime: sessionStart,
            lateMinutes: record ? calculateTimeDifference(record.check_in_timestamp, sessionStart) : 0,
            sesi: santriData?.sesi_mengaji || santriData?.class?.sesi,
            class_id: santriData?.current_class_id,
        });
        setIsModalOpen(true);
    };

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const days = [];
        let firstWeekdayFound = false;

        for (let i = 1; i <= daysInMonth; i++) {
            const dateToCompare = new Date(year, month, i);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayOfWeek = dateToCompare.getDay();

            if (dayOfWeek === 0 || dayOfWeek === 6) {
                continue;
            }

            if (!firstWeekdayFound) {
                const emptyCellsCount = dayOfWeek - 1;
                for (let e = 0; e < emptyCellsCount; e++) {
                    days.push(<div key={`empty-${e}`} className="p-2 border border-transparent"></div>);
                }
                firstWeekdayFound = true;
            }

            const record = attendance.find(a => a.attendance_date === dateStr);
            const isPastOrToday = dateToCompare <= today;
            
            let bgColor = "bg-gray-50 dark:bg-slate-800 text-gray-400";
            let tooltip = "Belum ada sesi/Libur";

            if (isPastOrToday) {
                const sessionStart = getSessionStartTimestamp(dateStr, santriData?.sesi_mengaji || santriData?.class?.sesi);
                let computedStatus = getComputedStatus(record, sessionStart);

                if (holidays.has(dateStr)) {
                    bgColor = "bg-gray-100 text-gray-400 dark:bg-slate-800 border-gray-200";
                    tooltip = "Libur Akademik";
                } else if (computedStatus === 'Hadir') {
                    bgColor = "bg-[hsl(var(--status-hadir))] text-white font-bold border-green-600 cursor-pointer shadow-sm opacity-90 hover:opacity-100";
                    tooltip = computedStatus;
                } else if (computedStatus === 'Terlambat') {
                    bgColor = "bg-[hsl(var(--status-terlambat))] text-white font-bold border-amber-600 cursor-pointer shadow-sm opacity-90 hover:opacity-100";
                    tooltip = computedStatus;
                } else {
                    bgColor = "bg-[hsl(var(--status-tidak-hadir))] text-white font-bold border-red-600 cursor-pointer shadow-sm opacity-90 hover:opacity-100";
                    tooltip = "Tidak Hadir";
                }
            }

            days.push(
                <div 
                    key={i} 
                    title={tooltip}
                    onClick={() => {
                        if (isPastOrToday && (!holidays.has(dateStr) || record)) {
                            handleDayClick(i);
                        }
                    }}
                    className={cn(
                        "flex items-center justify-center p-3 rounded-lg border transition-all text-sm",
                        bgColor
                    )}
                >
                    {i}
                </div>
            );
        }

        return days;
    };

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Memuat data absensi...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-900">
                    <CardContent className="p-4 sm:p-6 text-center flex flex-col items-center justify-center h-full">
                        <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                        <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm sm:text-base">Hadir / Tepat Waktu</h3>
                        <p className="text-3xl sm:text-4xl font-black text-green-600 mt-2">{stats.hadir_count}</p>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">{stats.hadir_percentage}% dari Bulan Ini</p>
                    </CardContent>
                </Card>

                <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-900">
                    <CardContent className="p-4 sm:p-6 text-center flex flex-col items-center justify-center h-full">
                        <Clock className="w-8 h-8 text-amber-500 mb-2" />
                        <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm sm:text-base">Terlambat</h3>
                        <p className="text-3xl sm:text-4xl font-black text-amber-600 mt-2">{stats.terlambat_count}</p>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">{stats.terlambat_percentage}% dari Bulan Ini</p>
                    </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900">
                    <CardContent className="p-4 sm:p-6 text-center flex flex-col items-center justify-center h-full">
                        <XCircle className="w-8 h-8 text-red-500 mb-2" />
                        <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm sm:text-base">Tidak Hadir</h3>
                        <p className="text-3xl sm:text-4xl font-black text-red-600 mt-2">{stats.tidak_hadir_count}</p>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">{stats.tidak_hadir_percentage}% dari Bulan Ini</p>
                    </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-900">
                    <CardContent className="p-4 sm:p-6 text-center flex flex-col items-center justify-center h-full">
                        <Percent className="w-8 h-8 text-blue-500 mb-2" />
                        <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm sm:text-base">Persentase Kehadiran</h3>
                        <p className="text-3xl sm:text-4xl font-black text-blue-600 mt-2">{stats.overall_percentage}%</p>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Sesi Bulan Ini ({stats.total_sessions} Hari)</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-lg border-none overflow-hidden">
                <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b flex flex-row items-center justify-between py-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-primary" />
                        Kalender Kehadiran (Senin-Jumat)
                    </CardTitle>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={prevMonth}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="font-semibold min-w-[120px] text-center">
                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </span>
                        <Button variant="outline" size="icon" onClick={nextMonth} disabled={currentDate.getMonth() >= new Date().getMonth() && currentDate.getFullYear() >= new Date().getFullYear()}>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-5 gap-2 mb-2">
                        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum'].map(day => (
                            <div key={day} className="text-center font-bold text-xs sm:text-sm text-muted-foreground py-2">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                        {renderCalendar()}
                    </div>
                </CardContent>
            </Card>

            <AttendanceDetailsModal 
                isOpen={isModalOpen} 
                onClose={() => { setIsModalOpen(false); setModalDetails(null); }} 
                details={modalDetails} 
                onSuccess={fetchAllData} 
            />
        </div>
    );
};

export default SantriAbsensiRecap;
