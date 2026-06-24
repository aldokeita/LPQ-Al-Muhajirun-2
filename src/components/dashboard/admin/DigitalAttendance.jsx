
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Fingerprint, Search, CheckCircle, XCircle, AlertTriangle, Clock, HelpCircle, Smartphone } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/components/ui/use-toast';
import {
    buildSantriAttendancePayload,
    getAttendanceErrorMessage,
    getLocalDateString,
    getSantriSession,
    isActiveSantri,
    normalizeRfidTag,
} from '@/lib/attendanceAdapters';

const sessionTimes = {
  'Pagi': { start: '08:00', end: '09:15' },
  'Siang': { start: '14:00', end: '15:15' },
  'Sore': { start: '16:00', end: '17:15' },
};

const DigitalClock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    return (
        <div className="font-mono text-xl md:text-2xl text-muted-foreground">
            {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
    );
};

const DigitalAttendance = () => {
    const [rfidTag, setRfidTag] = useState('');
    const [lastScan, setLastScan] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [nfcStatus, setNfcStatus] = useState('idle');
    const inputRef = useRef(null);
    const confirmationTimerRef = useRef(null);
    const nfcReaderRef = useRef(null);

    useEffect(() => {
        const focusInput = () => {
            if (document.activeElement !== inputRef.current) {
                inputRef.current?.focus();
            }
        };
        focusInput();
        const reFocusHandler = () => setTimeout(focusInput, 100);
        window.addEventListener('click', reFocusHandler);
        return () => window.removeEventListener('click', reFocusHandler);
    }, []);

    // Countdown logic
    useEffect(() => {
        if (lastScan?.type === 'confirmation' && lastScan.timer > 0) {
            confirmationTimerRef.current = setTimeout(() => {
                setLastScan(prev => ({ ...prev, timer: prev.timer - 1 }));
            }, 1000);
        } else if (lastScan?.type === 'confirmation' && lastScan.timer === 0) {
            setLastScan(null);
        }
        return () => clearTimeout(confirmationTimerRef.current);
    }, [lastScan]);

    // NFC Logic
    const startNfcScan = async () => {
        if ('NDEFReader' in window) {
            try {
                // Access NDEFReader from window to avoid ESLint no-undef error
                const ndef = new window.NDEFReader();
                nfcReaderRef.current = ndef;
                await ndef.scan();
                setNfcStatus('scanning');
                toast({ title: "NFC Ready", description: "Silakan tempelkan kartu." });

                ndef.onreading = event => {
                    const serialNumber = event.serialNumber;
                    if (serialNumber) {
                        const formattedTag = serialNumber.replace(/:/g, '').toUpperCase();
                        setRfidTag(formattedTag);
                        processScan(formattedTag);
                    }
                };

                ndef.onreadingerror = () => {
                    toast({ title: "NFC Error", description: "Gagal membaca kartu.", variant: "destructive" });
                };
            } catch (error) {
                console.error("NFC Error:", error);
                setNfcStatus('error');
                toast({ title: "NFC Gagal", description: error.message, variant: "destructive" });
            }
        } else {
            setNfcStatus('unsupported');
            toast({ title: "NFC Tidak Didukung", description: "Browser ini tidak mendukung NFC.", variant: "destructive" });
        }
    };

    const canCheckIn = (sesi, role) => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) { return { can: false, message: 'Absensi libur pada hari Sabtu dan Minggu.' }; }

        const sessionStartTime = sessionTimes[sesi]?.start;
        if (!sessionStartTime) return { can: false, message: `Sesi ${sesi} tidak valid.` };

        if (role === 'santri') {
            return { can: true, message: '' };
        }

        const now = new Date();
        const [hours, minutes] = sessionStartTime.split(':');
        const startTime = new Date();
        startTime.setHours(hours, minutes, 0, 0);

        const oneHourBefore = new Date(startTime.getTime() - 60 * 60 * 1000);

        if (now < oneHourBefore) {
            const timeString = oneHourBefore.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            return { can: false, message: `Absensi sesi ${sesi} baru dibuka pukul ${timeString}.` };
        }
        return { can: true, message: '' };
    };

    const processScan = async (tagToProcess) => {
        if (!tagToProcess || isLoading) return;
        const tag = normalizeRfidTag(tagToProcess);

        if (lastScan?.type === 'confirmation') {
             if (tag === lastScan.rfid) {
                 setIsLoading(true);
                 try {
                    const nowTime = new Date().toTimeString().split(' ')[0];
                    const timestamp = new Date().toISOString();

                    const { error } = await supabase
                        .from('attendance')
                        .update({
                            check_in_time: nowTime,
                            check_in_timestamp: timestamp // Updated timestamp field
                        })
                        .eq('id', lastScan.attendanceId);

                    if (error) throw error;

                    setLastScan({
                        type: 'success',
                        message: `Absensi berhasil diperbarui!`,
                        name: lastScan.name,
                        photo: lastScan.photo,
                        time: nowTime
                    });
                 } catch (err) {
                    setLastScan({ type: 'error', message: err.message, name: 'Error' });
                 } finally {
                    setIsLoading(false);
                    setRfidTag('');
                    return;
                 }
             } else {
                 setLastScan(null);
             }
        }

        setIsLoading(true);
        setLastScan({type: 'scanning'});

        try {
            await new Promise(resolve => setTimeout(resolve, 500));

            const today = getLocalDateString();

            let user = null, userRole = '', sesiUser = '';
            let { data: guruData } = await supabase.from('guru').select('*').eq('rfid_tag', tag).maybeSingle();

            if (guruData) {
                user = guruData; userRole = 'guru';
                const now = new Date();
                for (const sesi of ['Sore', 'Siang', 'Pagi']) {
                    const sessionStartTime = sessionTimes[sesi]?.start;
                    if(!sessionStartTime) continue;
                    const [hours, minutes] = sessionStartTime.split(':');
                    const startTime = new Date(); startTime.setHours(hours, minutes, 0);
                    const thirtyMinutesBefore = new Date(startTime.getTime() - 30 * 60 * 1000);
                    const [endHours, endMinutes] = sessionTimes[sesi].end.split(':');
                    const endTime = new Date(); endTime.setHours(endHours, endMinutes, 0, 0);
                    if (now >= thirtyMinutesBefore && now <= endTime) { sesiUser = sesi; break; }
                }
                if (!sesiUser) {
                     setLastScan({ type: 'warning', message: 'Tidak ada sesi mengajar yang sedang berlangsung.', name: user.nama, photo: user.foto_url });
                     return;
                }
            } else {
                let { data: santriData } = await supabase
                    .from('santri')
                    .select('id, nama_lengkap, nama_panggilan, kategori, status, foto_url, rfid_tag, current_class_id, sesi_mengaji, jilid, points, jenis_kelamin, class:current_class_id(id, nama_kelas, sesi, id_guru, is_active)')
                    .eq('rfid_tag', tag)
                    .maybeSingle();
                if (santriData) {
                    if (!isActiveSantri(santriData.status)) {
                        setLastScan({ type: 'warning', message: 'Santri nonaktif tidak dapat dicatat absensinya.', name: santriData.nama_lengkap, photo: santriData.foto_url });
                        return;
                    }
                    if (!santriData.current_class_id) {
                        setLastScan({ type: 'warning', message: 'Santri belum memiliki kelas aktif.', name: santriData.nama_lengkap, photo: santriData.foto_url });
                        return;
                    }
                    user = santriData;
                    userRole = 'santri';
                    sesiUser = getSantriSession(santriData);
                }
            }

            if (!user) { setLastScan({ type: 'error', message: 'RFID tidak dikenal. Tidak ada absensi yang dibuat.', name: 'Tidak Dikenal' }); return; }

            const checkInStatus = canCheckIn(sesiUser, userRole);
            if (!checkInStatus.can) { setLastScan({ type: 'warning', message: checkInStatus.message, name: user.nama || user.nama_lengkap, photo: user.foto_url }); return; }

            const timestamp = new Date();
            const newAttendance = userRole === 'santri'
                ? buildSantriAttendancePayload({ santri: user, timestamp })
                : {
                    user_id: user.id,
                    role: userRole,
                    attendance_date: today,
                    check_in_time: timestamp.toTimeString().split(' ')[0],
                    check_in_timestamp: timestamp.toISOString(),
                    class_id: null,
                    sesi: sesiUser,
                    status: 'Hadir',
                    source: 'rfid',
                };
            const { error: insertError } = await supabase.from('attendance').insert(newAttendance);

            if (insertError) { setLastScan({ type: 'error', message: getAttendanceErrorMessage(insertError), name: user.nama || user.nama_lengkap, photo: user.foto_url });
            } else { setLastScan({ type: 'success', message: `Absensi sesi ${sesiUser} berhasil!`, name: user.nama || user.nama_lengkap, photo: user.foto_url, time: newAttendance.check_in_time }); }
        } finally {
            setIsLoading(false);
            setRfidTag('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleRfidSubmit = (e) => {
        e.preventDefault();
        processScan(rfidTag);
    };

    const ScanResult = ({ scan }) => {
        const variants = {
            success: { bg: 'bg-gradient-to-br from-green-500 to-teal-500', icon: <CheckCircle className="w-16 h-16 mb-4" /> },
            error: { bg: 'bg-gradient-to-br from-red-500 to-rose-600', icon: <XCircle className="w-16 h-16 mb-4" /> },
            warning: { bg: 'bg-gradient-to-br from-yellow-500 to-amber-500', icon: <AlertTriangle className="w-16 h-16 mb-4" /> },
            confirmation: { bg: 'bg-gradient-to-br from-blue-500 to-indigo-500', icon: <HelpCircle className="w-16 h-16 mb-4 animate-pulse" /> },
        };

        if (scan?.type === 'scanning') {
          return <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full">
            <div className="w-48 h-32 bg-gray-800 rounded-xl relative overflow-hidden border-2 border-blue-400">
              <motion.div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 shadow-[0_0_10px_2px_#0ff]" animate={{ y: [0, 128] }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
              <p className="text-white text-center mt-12">Scanning ID Card...</p>
            </div>
          </motion.div>
        }

        if (!scan) return <div className="h-48"></div>;
        const baseClasses = "flex flex-col items-center justify-center p-6 rounded-2xl text-white text-center shadow-lg transition-all duration-500";
        const currentVariant = variants[scan.type];

        return (<motion.div key={scan.name + scan.message} initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -50, scale: 0.9 }} className={`${baseClasses} ${currentVariant.bg}`}>
                {currentVariant.icon}
                {scan.photo && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                        className="mb-4"
                    >
                        <Avatar className="w-28 h-28 border-4 border-white/50 shadow-lg rounded-2xl">
                            <AvatarImage src={scan.photo} />
                            <AvatarFallback className="text-4xl font-bold rounded-2xl">{scan.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    </motion.div>
                )}
                <p className="text-2xl font-bold">{scan.name}</p>
                <p className="text-lg">{scan.message}</p>
                {scan.type === 'confirmation' && (
                    <div className="mt-2 text-4xl font-mono font-bold">{scan.timer}</div>
                )}
                {scan.time && <p className="text-sm font-light mt-2 flex items-center gap-1"><Clock className="w-4 h-4"/> {scan.time}</p>}
        </motion.div>);
    };

    return (
        <div className="bg-card p-6 rounded-2xl shadow-xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-accent-foreground flex items-center gap-2"><Fingerprint className="w-8 h-8 text-primary" /> Absensi Digital (Scan ID Card)</h2>
              <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={startNfcScan} className={nfcStatus === 'scanning' ? "animate-pulse border-green-500 text-green-500" : ""}><Smartphone className="w-4 h-4 mr-2"/> {nfcStatus === 'scanning' ? 'NFC Aktif' : 'Start NFC'}</Button>
                  <DigitalClock />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                    <form onSubmit={handleRfidSubmit} className="space-y-4">
                        <label htmlFor="rfid-input" className="block text-sm font-medium text-muted-foreground">Tempelkan ID card atau masukkan kode di bawah ini, lalu tekan Enter.</label>
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" /><Input ref={inputRef} id="rfid-input" type="text" placeholder="Menunggu ID Card..." value={rfidTag} onChange={(e) => setRfidTag(e.target.value)} className="pl-10 text-lg h-12" disabled={isLoading} autoFocus/></div>
                        <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? 'Memproses...' : 'Proses Absensi'}</Button>
                    </form>
                </div>
                <div className="min-h-[250px] flex items-center justify-center"><AnimatePresence mode="wait"><ScanResult scan={lastScan} /></AnimatePresence></div>
            </div>
        </div>
    );
};

export default DigitalAttendance;
