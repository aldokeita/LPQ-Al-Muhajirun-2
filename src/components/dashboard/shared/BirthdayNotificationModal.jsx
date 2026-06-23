import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { Cake, Calendar, User, Loader2, PartyPopper, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const BirthdayNotificationModal = ({ isOpen, onClose }) => {
    const [birthdays, setBirthdays] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentMonthName, setCurrentMonthName] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchBirthdays();
        }
        
        const date = new Date();
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        setCurrentMonthName(monthNames[date.getMonth()]);
    }, [isOpen]);

    const fetchBirthdays = async () => {
        setIsLoading(true);
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // 1-12
        const currentDay = today.getDate();

        try {
            console.log(`Fetching birthdays for month: ${currentMonth}`);
            
            // Fetch Santri and Guru Birthdays concurrently
            const [santriRes, guruRes] = await Promise.all([
                supabase.from('santri').select('id, nama_lengkap, tanggal_lahir, foto_url, status, jilid').eq('status', 'Aktif'),
                supabase.from('guru').select('id, nama, tanggal_lahir, foto_url, status_guru, jabatan')
            ]);

            if (santriRes.error) throw new Error(`Gagal mengambil data ulang tahun santri: ${santriRes.error.message}`);
            if (guruRes.error) throw new Error(`Gagal mengambil data ulang tahun guru: ${guruRes.error.message}`);

            console.log("Raw Guru Data fetched:", guruRes.data);

            // Safe date parser to avoid timezone shifts
            const parseDateStr = (dateStr) => {
                if (!dateStr) return null;
                // handle both YYYY-MM-DD and full ISO strings
                const datePart = dateStr.split('T')[0]; 
                const parts = datePart.split('-');
                if (parts.length !== 3) return null;
                return {
                    year: parseInt(parts[0], 10),
                    month: parseInt(parts[1], 10),
                    day: parseInt(parts[2], 10)
                };
            };

            // Filter for current month and format Santri
            const santriBirthdays = (santriRes.data || [])
                .map(item => ({ item, parsedDate: parseDateStr(item.tanggal_lahir) }))
                .filter(({ parsedDate }) => parsedDate && parsedDate.month === currentMonth)
                .map(({ item, parsedDate }) => ({
                    id: item.id,
                    name: item.nama_lengkap,
                    role: 'Santri',
                    detail: `Santri • ${item.jilid || 'TPQ'}`,
                    date: new Date(parsedDate.year, parsedDate.month - 1, parsedDate.day),
                    day: parsedDate.day,
                    foto_url: item.foto_url,
                    age: today.getFullYear() - parsedDate.year
                }));

            // Filter for current month and format Guru
            const guruBirthdays = (guruRes.data || [])
                // Less strict status filter just in case "Aktif" is not consistently used
                .filter(item => !item.status_guru || item.status_guru !== 'Nonaktif')
                .map(item => ({ item, parsedDate: parseDateStr(item.tanggal_lahir) }))
                .filter(({ parsedDate }) => parsedDate && parsedDate.month === currentMonth)
                .map(({ item, parsedDate }) => ({
                    id: item.id,
                    name: item.nama,
                    role: 'Guru',
                    detail: `Guru • ${item.jabatan || 'Pengajar'}`,
                    date: new Date(parsedDate.year, parsedDate.month - 1, parsedDate.day),
                    day: parsedDate.day,
                    foto_url: item.foto_url,
                    age: today.getFullYear() - parsedDate.year
                }));

            console.log("Filtered Guru Birthdays:", guruBirthdays);

            const allBirthdays = [...santriBirthdays, ...guruBirthdays];
            console.log("Final Merged Birthdays Array:", allBirthdays);

            // Sort logic: Upcoming (>= today) first, then passed (< today)
            allBirthdays.sort((a, b) => {
                const aUpcoming = a.day >= currentDay;
                const bUpcoming = b.day >= currentDay;
                
                if (aUpcoming && !bUpcoming) return -1;
                if (!aUpcoming && bUpcoming) return 1;
                
                return a.day - b.day;
            });

            setBirthdays(allBirthdays);

        } catch (error) {
            console.error("Birthday Fetch Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const currentDay = new Date().getDate();

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-0">
                <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                    <DialogTitle className="flex items-center gap-2 text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-rose-600">
                        <Cake className="w-6 h-6 text-pink-500" /> 
                        Ulang Tahun {currentMonthName}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 dark:text-slate-400">
                        Daftar santri dan guru yang merayakan ulang tahun bulan ini.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-10 h-10 animate-spin text-pink-500" /></div>
                ) : (
                    <ScrollArea className="max-h-[60vh] pr-2 -mr-2">
                        {birthdays.length > 0 ? (
                            <div className="space-y-3 py-2">
                                {birthdays.map((person, index) => {
                                    const isToday = person.day === currentDay;
                                    const isPassed = person.day < currentDay;

                                    return (
                                        <div 
                                            key={`${person.role}-${person.id}`} 
                                            className={cn(
                                                "group flex items-center justify-between p-3 rounded-xl border transition-all duration-300",
                                                isToday 
                                                    ? "bg-pink-50 border-pink-200 shadow-sm scale-[1.02]" 
                                                    : isPassed 
                                                        ? "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 opacity-70 grayscale-[0.5]" 
                                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-pink-200 hover:shadow-md"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <Avatar className={cn("w-12 h-12 border-2", isToday ? "border-pink-400" : "border-slate-200")}>
                                                        <AvatarImage src={person.foto_url} />
                                                        <AvatarFallback>{person.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    {isToday && (
                                                        <div className="absolute -top-1 -right-1 bg-yellow-400 text-white p-1 rounded-full shadow-sm animate-bounce">
                                                            <PartyPopper className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-sm text-foreground line-clamp-1">{person.name}</p>
                                                        {isToday && <Badge className="text-[10px] bg-pink-500 hover:bg-pink-600 border-0 h-4 px-1.5">Hari Ini!</Badge>}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] px-1.5 py-0 border-slate-200 dark:border-slate-700",
                                                            person.role === 'Guru' 
                                                                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200" 
                                                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                                        )}>
                                                            {person.detail}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" /> {person.day} {currentMonthName}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right pl-2">
                                                <span className={cn(
                                                    "text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap",
                                                    isToday ? "text-pink-600 bg-pink-100" : "text-slate-500 bg-slate-100 dark:bg-slate-800"
                                                )}>
                                                    Ke-{person.age}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground space-y-2">
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                                    <Cake className="w-8 h-8 opacity-20" />
                                </div>
                                <p className="text-sm">Tidak ada yang berulang tahun bulan ini.</p>
                            </div>
                        )}
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default BirthdayNotificationModal;