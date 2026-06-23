
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Fingerprint, Search, CheckCircle, XCircle, AlertTriangle, Clock, ArrowLeft, ScanLine, Activity, Sun, Moon, HelpCircle, Tv, Gamepad2, Phone, Crown, Globe2, Zap, Book, Users, Briefcase, Star, ArrowRight, User, Dices, Trophy, Library } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useTheme } from '@/contexts/ThemeContext';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import MediaPlayerWidget from '@/components/MediaPlayerWidget';
import { determineAttendanceStatus, calculateTimeDifference } from '@/utils/AttendanceStatusLogic';
import { enableDeferredFeatures } from '@/lib/featureFlags';

// --- Animated Background Particles ---
const Particle = ({ delay, isDark }) => (
    <motion.div
        className={`absolute rounded-full blur-[2px] ${isDark ? 'bg-white/20' : 'bg-[#4CAF50]/30'}`}
        initial={{ y: "110vh", x: Math.random() * 100 + "vw", opacity: 0, scale: 0 }}
        animate={{ 
            y: "-10vh", 
            opacity: [0, 0.4, 0], 
            scale: [0, Math.random() * 2 + 0.5, 0],
            rotate: 360
        }}
        transition={{ 
            duration: Math.random() * 15 + 20, 
            repeat: Infinity, 
            delay: delay, 
            ease: "linear" 
        }}
        style={{ width: Math.random() * 10 + 4, height: Math.random() * 10 + 4 }}
    />
);

const sessionTimes = {
  'Pagi': { start: '08:00', end: '11:00', defaultQuota: 60 },
  'Siang': { start: '13:00', end: '15:30', defaultQuota: 80 },
  'Sore': { start: '16:00', end: '18:00', defaultQuota: 80 },
  'Malam': { start: '18:30', end: '23:00', defaultQuota: 50 },
};

const guruQuotes = [
    "Mengajar adalah belajar dua kali.",
    "Guru terbaik mengajar dari hati, bukan hanya dari buku.",
    "Pendidikan adalah senjata paling ampuh untuk mengubah dunia.",
    "Satu anak, satu guru, satu pena bisa mengubah dunia.",
    "Kesabaran Anda adalah jembatan masa depan mereka.",
    "Lelahmu hari ini akan menjadi saksi amal jariyahmu nanti.",
    "Mendidik pikiran tanpa mendidik hati adalah bukan pendidikan sama sekali.",
    "Jadilah inspirasi sebelum mengajarkan materi."
];

const motivationalMessages = [
    "Semangat belajar mengajinya ya!", 
    "Jadilah anak yang taat bagi kedua orang tua!", 
    "Menuntut ilmu itu wajib bagi setiap muslim.", 
    "Barang siapa menempuh jalan mencari ilmu, Allah mudahkan jalan ke surga.", 
    "Hafalanmu adalah cahayamu.", 
    "Teruslah berbuat baik kepada orang tua.", 
    "Jangan lupa sholat 5 waktu ya!", 
    "Ilmu adalah harta yang tidak akan habis.", 
    "Hafalanmu hari ini adalah tabungan untuk surgamu nanti. Semangat!", 
    "Jangan takut salah baca ya, Allah tetap akan catat usahamu kok.", 
    "Lelahmu dalam belajar itu bernilai jihad lho. Keren!", 
    "Anak sholeh/sholehah adalah harta terindah Ayah Bunda.", 
    "Jadilah alasan Ayah dan Bunda tersenyum hari ini.", 
    "Bersih itu ciri orang beriman. Sampahnya dibuang di tempatnya ya.", 
    "Jujur itu hebat! Santri LPQ Al-Muhajirun pantang berbohong.", 
    "Siapa yang bersungguh-sungguh, pasti akan berhasil. Man Jadda Wajada!", 
    "Hari ini pembelajar, besok jadi pemimpin. Aamiin!", 
    "Absen diterima! Silakan masuk, pintu ilmu sudah terbuka.", 
    "Terima kasih sudah hadir. Kehadiranmu sangat berarti buat kakak."
];

const adultQuotes = [
    "Tak ada kata terlambat untuk belajar Al-Qur'an.",
    "Sebaik-baik kalian adalah yang belajar Al-Qur'an dan mengajarkannya.",
    "Lelah bekerja seharian, sembuhkan dengan lantunan ayat suci.",
    "Setiap huruf yang dibaca adalah pahala yang berlipat ganda.",
    "Kesabaran dunia jangan sampai melalaikan akhirat.",
    "Istiqomah itu berat, tapi hadiahnya surga.",
    "Allah melihat usahamu, bukan hanya hasilmu.",
    "Membaca Al-Qur'an dengan terbata-bata pun mendapat dua pahala."
];

const canCheckIn = (sesi, userRole, isPentashih = false) => {
    if (isPentashih) return { can: true, message: '' };
    if (userRole === 'santri') return { can: true, message: '' };

    const today = new Date();
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return { can: false, message: 'Absensi libur pada hari Sabtu dan Minggu.' };
    
    const now = new Date();
    const sessionConfig = sessionTimes[sesi];
    if (!sessionConfig) {
         return { can: false, message: `Sesi ${sesi} tidak valid saat ini.` };
    }
    
    const [hours, minutes] = sessionConfig.start.split(':');
    const startTime = new Date();
    startTime.setHours(hours, minutes, 0, 0);
    const sixtyMinutesBefore = new Date(startTime.getTime() - 60 * 60 * 1000);
    
    if (now < sixtyMinutesBefore) {
        const timeString = sixtyMinutesBefore.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        return { can: false, message: `Absensi sesi ${sesi} baru dibuka pukul ${timeString}.` };
    }
    return { can: true, message: '' };
};

const DigitalClock = ({ showSeconds = true }) => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);
  
  return <div className="flex flex-col items-center justify-center space-y-2 relative z-20">
            <div className="text-6xl md:text-8xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#1B5E20] to-[#4CAF50] dark:from-[#4CAF50] dark:to-[#D4AF37] drop-shadow-sm dark:drop-shadow-[0_0_15px_rgba(76,175,80,0.5)] transition-all duration-300">
                {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: showSeconds ? '2-digit' : undefined })}
            </div>
            <div className="text-xl md:text-2xl text-slate-500 dark:text-[#4CAF50]/70 font-light tracking-widest transition-colors duration-300">
                {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
        </div>;
};

const DigitalAttendancePage = () => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [rfidTag, setRfidTag] = useState('');
  const [lastScan, setLastScan] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [levelConfig, setLevelConfig] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
      const fetchConfig = async () => {
          const { data } = await supabase.from('website_content').select('content').eq('key', 'level_config').maybeSingle();
          if (data?.content) setLevelConfig(data.content);
      };
      fetchConfig();
  }, []);

  const getLevelInfo = (points = 0, gender) => {
      const defaultInfo = { 
          label: 'Level C', 
          color: '#4CAF50', 
          badgeIcon: <Book className="w-8 h-8 text-[#4CAF50]" />,
          enableGradient: false,
          cardBgColor: '#ffffff',
          textColor: '#333333',
          cardBorderThickness: 8,
          avatarBorderThickness: 4,
          textGradient: false
      };
      
      if (!levelConfig) return defaultInfo;
      const levels = gender === 'Perempuan' ? levelConfig.female : levelConfig.male;
      
      if (!Array.isArray(levels) || levels.length === 0) return defaultInfo;
      
      const matchedLevel = levels.find(l => points >= (l.min || 0) && points <= (l.max || 9999)) || levels[0];
      if (!matchedLevel) return defaultInfo;
      
      let icon = <Book className="w-8 h-8" style={{ color: matchedLevel.color }} />;
      if ((matchedLevel.name || '').toLowerCase().includes('mahir') || (matchedLevel.name || '').toLowerCase().includes('s')) {
          icon = <Crown className="w-10 h-10 animate-bounce drop-shadow-md" style={{ color: matchedLevel.color }} />;
      } else if ((matchedLevel.name || '').toLowerCase().includes('menengah') || (matchedLevel.name || '').toLowerCase().includes('a')) {
          icon = <Globe2 className="w-10 h-10 animate-pulse" style={{ color: matchedLevel.color }} />;
      }
      
      return {
          label: matchedLevel.name,
          color: matchedLevel.color,
          badgeIcon: icon,
          enableGradient: matchedLevel.enableGradient,
          cardBgColor: matchedLevel.cardBgColor || '#ffffff',
          textColor: matchedLevel.textColor || '#333333',
          cardBorderThickness: matchedLevel.cardBorderThickness || 8,
          avatarBorderThickness: matchedLevel.avatarBorderThickness || 4,
          textGradient: matchedLevel.textGradient || false
      };
  };

  const forceFocus = () => { if (inputRef.current) { inputRef.current.focus(); } };

  useEffect(() => {
    forceFocus();
    const reFocusHandler = () => setTimeout(forceFocus, 100);
    window.addEventListener('click', reFocusHandler);
    return () => window.removeEventListener('click', reFocusHandler);
  }, [lastScan]);

  const processScan = async (tagToProcess) => {
      if (!tagToProcess || isLoading) return;
      const tag = tagToProcess.trim();

      // Pentashih handling
      if (lastScan?.type === 'success' && lastScan.isPentashih && lastScan.rfid === tag) {
          setIsLoading(true);
          const { data: history } = await supabase.from('class_mutations').select(`*, santri(nama_lengkap, foto_url, jilid), from_class:from_class_id(nama_kelas, guru:id_guru(nama)), to_class:to_class_id(nama_kelas, guru:id_guru(nama))`).order('mutation_date', { ascending: false }).limit(6);
          setLastScan({ ...lastScan, type: 'pentashih_history', historyData: history || [] });
          setIsLoading(false); setRfidTag(''); setTimeout(forceFocus, 50); return;
      }

      // Guru Detail View handling
      if ((lastScan?.type === 'guru_info' || lastScan?.type === 'warning' || lastScan?.type === 'success') && lastScan.rfid === tag && lastScan.role === 'guru' && !lastScan.isPentashih) {
          if(!lastScan.classesData) {
             setIsLoading(true);
             const { data: guruData } = await supabase.from('guru').select('id').eq('rfid_tag', tag).single();
             if(guruData) {
                 const { data: classes } = await supabase.from('classes').select('*, santri(id, nama_lengkap, jilid, foto_url)').eq('id_guru', guruData.id).order('sesi');
                 setLastScan({ ...lastScan, type: 'guru_schedule_detail', classesData: classes || [] });
             }
             setIsLoading(false);
          } else { setLastScan({ ...lastScan, type: 'guru_schedule_detail' }); }
          setRfidTag(''); setTimeout(forceFocus, 50); return;
      }

      // Re-scan confirmation handling for normal attendance
      if (lastScan?.type === 'confirmation') {
        if (tag === lastScan.rfid) {
          setIsLoading(true);
          try {
            const nowTime = new Date().toTimeString().split(' ')[0];
            const timestamp = new Date().toISOString();
            
            if (lastScan.isMMQ) {
                 const { error: updErr } = await supabase.from('mmq_attendance').update({ check_in_timestamp: timestamp }).eq('id', lastScan.attendanceId);
                 if (updErr) throw updErr;
                 setLastScan(prev => ({ ...prev, type: 'success', time: nowTime, message: 'Absensi MMQ diperbarui!', quote: lastScan.pendingQuote }));
            } else {
                const { error } = await supabase.from('attendance').update({ check_in_time: nowTime, check_in_timestamp: timestamp }).eq('id', lastScan.attendanceId);
                if (error) throw error;
                const levelInfo = (lastScan.role === 'santri' && lastScan.kategori !== 'Dewasa') ? getLevelInfo(lastScan.points, lastScan.gender) : null;
                setLastScan(prev => ({ ...prev, type: 'success', time: nowTime, levelInfo, message: 'Absensi berhasil diperbarui!', quote: lastScan.pendingQuote }));
            }
          } catch (err) { setLastScan({ type: 'error', message: err.message, name: 'Error' }); } 
          finally { setIsLoading(false); setRfidTag(''); setTimeout(forceFocus, 50); return; }
        } else { setLastScan(null); setRfidTag(''); return; }
      }

      setIsLoading(true);
      setLastScan({ type: 'scanning' });
      
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        const todayDate = new Date();
        const todayStr = todayDate.toLocaleDateString('en-CA'); 
        
        let user = null, userRole = '', sesiUser = '', kategori = '';
        let { data: guruData } = await supabase.from('guru').select('*').eq('rfid_tag', tag).maybeSingle();
        
        // Check MMQ Schedule if it's a Guru
        if (guruData) {
            user = guruData; userRole = 'guru';
            const todayDay = todayDate.getDay();
            const { data: mmqSchedule } = await supabase.from('mmq_schedule')
                .select('*')
                .eq('day_of_week', todayDay)
                .eq('is_active', true)
                .maybeSingle();

            if (mmqSchedule) {
                // =========================================================
                // MMQ DAY LOGIC (WITH COMPREHENSIVE VALIDATION & LOGGING)
                // =========================================================
                try {
                    console.log(`\n--- [MMQ ABSENSI] CHECK-IN START FOR ${user.nama} ---`);
                    const timestamp = new Date().toISOString();
                    const sessionStart = new Date(`${todayStr}T${mmqSchedule.start_time}`).toISOString();
                    
                    // Determine raw status from logic
                    let rawStatus = determineAttendanceStatus(timestamp, sessionStart);
                    const timeDiff = calculateTimeDifference(timestamp, sessionStart);

                    // Valid allowed statuses defined in database check constraint mmq_attendance_status_check
                    const allowedStatuses = ['Hadir', 'Terlambat', 'Tidak Hadir', 'Alpha', 'Izin', 'Sakit'];
                    let validStatus = 'Hadir'; // Default fallback

                    // Map raw logic to strictly exact database constraint values
                    if (rawStatus === 'Terlambat') validStatus = 'Terlambat';
                    else if (['Tidak Hadir', 'Alpha', 'Ghaib'].includes(rawStatus)) validStatus = 'Tidak Hadir';
                    else if (['Tepat Waktu', 'Hadir'].includes(rawStatus)) validStatus = 'Hadir';
                    else if (rawStatus === 'Izin') validStatus = 'Izin';
                    else if (rawStatus === 'Sakit') validStatus = 'Sakit';

                    const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

                    // 1. Validation Logging
                    console.log(`[MMQ Validation] Current Date : ${todayStr}`);
                    console.log(`[MMQ Validation] Check-in Time: ${timestamp}`);
                    console.log(`[MMQ Validation] Session Start: ${sessionStart}`);
                    console.log(`[MMQ Validation] Raw Status   : '${rawStatus}'`);
                    console.log(`[MMQ Validation] Mapped Status: '${validStatus}'`);
                    console.log(`[MMQ Validation] MMQ SessionID: '${mmqSchedule.id}'`);
                    console.log(`[MMQ Validation] Guru ID      : '${user.id}'`);

                    // 2. Strict Validations
                    if (!allowedStatuses.includes(validStatus)) {
                        console.error(`[MMQ DB Error] Status '${validStatus}' is not allowed by CHECK constraint.`);
                        throw new Error(`Sistem Error: Status absensi '${validStatus}' tidak diizinkan.`);
                    }

                    if (!mmqSchedule.id) {
                        console.error("[MMQ DB Error] mmq_session_id is NULL or missing from mmqSchedule payload.");
                        // Try fetching fallback schedule
                        const { data: fallbackSchedule } = await supabase.from('mmq_schedule').select('id').eq('is_active', true).limit(1).maybeSingle();
                        if (fallbackSchedule?.id) {
                            console.log(`[MMQ Fix] Using fallback schedule ID: ${fallbackSchedule.id}`);
                            mmqSchedule.id = fallbackSchedule.id;
                        } else {
                            throw new Error("Gagal: Sesi MMQ untuk hari ini tidak ditemukan di database.");
                        }
                    }

                    if (!isValidUUID(mmqSchedule.id)) {
                        console.error(`[MMQ DB Error] Invalid mmq_session_id format: ${mmqSchedule.id}`);
                        throw new Error("Gagal: Format ID Jadwal MMQ tidak valid.");
                    }

                    if (!user.id || !isValidUUID(user.id)) {
                        console.error(`[MMQ DB Error] Invalid guru_id format: ${user.id}`);
                        throw new Error("Gagal: Format ID Guru tidak valid.");
                    }

                    // Check if already checked in
                    const { data: existingMMQ, error: checkError } = await supabase.from('mmq_attendance')
                        .select('id')
                        .eq('guru_id', user.id)
                        .eq('attendance_date', todayStr)
                        .maybeSingle();

                    if (checkError) {
                        console.error("[MMQ DB Error] Failed checking existing attendance:", checkError);
                        throw new Error("Gagal memeriksa status absensi sebelumnya.");
                    }

                    const randomQuote = adultQuotes[Math.floor(Math.random() * adultQuotes.length)];
                    
                    if (existingMMQ) {
                        console.log(`[MMQ Check-in] Guru already checked in (ID: ${existingMMQ.id}). Prompting confirmation.`);
                        setLastScan({ 
                            type: 'confirmation', 
                            role: 'guru', 
                            isMMQ: true,
                            message: 'Konfirmasi Kehadiran MMQ', 
                            name: user.nama, 
                            photo: user.foto_url, 
                            rfid: tag, 
                            attendanceId: existingMMQ.id, 
                            pendingQuote: randomQuote 
                        });
                        return;
                    }

                    // 3. Prepare Payload
                    const insertPayload = {
                        guru_id: user.id,
                        mmq_session_id: mmqSchedule.id,
                        attendance_date: todayStr,
                        check_in_timestamp: timestamp,
                        status: validStatus
                    };

                    console.log("[MMQ Check-in] Attempting INSERT with payload:", insertPayload);

                    // 4. Execute Insert
                    const { error: mmqError } = await supabase.from('mmq_attendance').insert(insertPayload);

                    if (mmqError) {
                        console.error("[MMQ DB Error] Database INSERT failed:", mmqError);
                        let friendlyMessage = "Gagal menyimpan absensi MMQ ke database.";
                        if (mmqError.message.includes("mmq_attendance_status_check")) {
                            friendlyMessage = `Gagal: Status "${validStatus}" tidak sesuai dengan aturan database. Hubungi admin.`;
                        }
                        throw new Error(friendlyMessage);
                    }

                    console.log("[MMQ Check-in] ✅ INSERT Successful!");

                    let msg = `Absensi MMQ: ${validStatus}`;
                    if (validStatus === 'Terlambat') msg += ` (${timeDiff} menit)`;
                    
                    setLastScan({
                        type: 'mmq_success',
                        name: user.nama,
                        photo: user.foto_url,
                        status: validStatus,
                        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                        message: msg,
                        quote: randomQuote
                    });
                } catch (err) {
                    console.error("[MMQ Exception] Caught error during MMQ process:", err);
                    setLastScan({ 
                        type: 'error', 
                        message: err.message || "Terjadi kesalahan sistem saat absensi MMQ.", 
                        name: user.nama || "Error", 
                        photo: user?.foto_url 
                    });
                }
                return; // Early return to bypass regular attendance
            }

            // Normal Guru Attendance Session Assignment
            const now = new Date();
            for (const sesi of ['Sore', 'Siang', 'Pagi', 'Malam']) {
                const sessionStartTime = sessionTimes[sesi]?.start;
                if (!sessionStartTime) continue;
                const [hours, minutes] = sessionStartTime.split(':');
                const startTime = new Date(); startTime.setHours(hours, minutes, 0);
                const oneHourBefore = new Date(startTime.getTime() - 60 * 60 * 1000);
                const [endHours, endMinutes] = sessionTimes[sesi].end.split(':');
                const endTime = new Date(); endTime.setHours(endHours, endMinutes, 0, 0);
                if (now >= oneHourBefore && now <= endTime) { sesiUser = sesi; break; }
            }
        } else {
          let { data: santriData } = await supabase.from('santri').select('*, class:id_kelas(*)').eq('rfid_tag', tag).maybeSingle();
          if (santriData) { 
              user = santriData; userRole = 'santri'; kategori = santriData.kategori || 'Anak';
              sesiUser = santriData.sesi_mengaji || santriData.class?.sesi || 'Pagi'; 
          }
        }
        
        if (!user) { setLastScan({ type: 'error', message: 'Kartu tidak terdaftar!', name: 'Tidak Dikenal' }); return; }

        const isPentashih = userRole === 'guru' && ((user.roles && user.roles.includes('Pentashih')) || (user.jabatan && user.jabatan.toLowerCase().includes('pentashih')));
        const checkInStatus = canCheckIn(sesiUser, userRole, isPentashih);

        if (userRole === 'guru' && (!sesiUser || !checkInStatus.can) && !isPentashih) {
              const [classesResult, attendanceCountResult, historyResult] = await Promise.all([
                  supabase.from('classes').select('*, santri(id, nama_lengkap, jilid, foto_url)').eq('id_guru', user.id).order('sesi'),
                  supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('attendance_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
                  supabase.from('attendance').select('attendance_date').eq('user_id', user.id).order('attendance_date', { ascending: false }).limit(30)
              ]);
              const guruClasses = classesResult.data;
              const uniqueSessions = [...new Set((guruClasses || []).map(c => c.sesi))];
              const scheduledSessionsCount = uniqueSessions.length;
              const totalMonthAttendance = attendanceCountResult.count || 0;
              const hoursTaught = (totalMonthAttendance * 1.25).toFixed(2); 
              const uniqueDates = [...new Set(historyResult.data?.map(h => h.attendance_date) || [])];
              let streak = 0;
              const checkDate = new Date(); checkDate.setDate(checkDate.getDate() - 1); 
              while (true) {
                  const dateStr = checkDate.toLocaleDateString('en-CA');
                  if (uniqueDates.includes(dateStr)) { streak++; checkDate.setDate(checkDate.getDate() - 1); } 
                  else { const day = checkDate.getDay(); if (day === 0 || day === 6) { checkDate.setDate(checkDate.getDate() - 1); continue; } break; }
              }
              if ((attendanceCountResult.count || 0) > 0) streak++; 
              const timeMap = { 'Pagi': 8, 'Siang': 14, 'Sore': 16, 'Malam': 18 };
              const sortedSessions = uniqueSessions.sort((a, b) => (timeMap[a] || 0) - (timeMap[b] || 0));
              const currentHour = new Date().getHours();
              let nextSession = sortedSessions.find(s => (timeMap[s] || 0) > currentHour);
              if (!nextSession && sortedSessions.length > 0) { nextSession = `${sortedSessions[0]} (Besok)`; } else if (!nextSession) { nextSession = "-"; } else { const startTime = sessionTimes[nextSession]?.start || ''; nextSession = `${nextSession} (${startTime})`; }
              const quote = guruQuotes[Math.floor(Math.random() * guruQuotes.length)];
              setLastScan({ type: 'guru_info', rfid: tag, role: 'guru', name: user.nama, photo: user.foto_url, quote, classesData: guruClasses, roles: user.roles || [], jabatan: user.jabatan, gender: user.jenis_kelamin || 'Laki-laki', no_hp: user.no_hp, stats: { sessions: scheduledSessionsCount, hours: hoursTaught, streak: streak, nextSession }});
              return; 
        }

        if (!checkInStatus.can) { setLastScan({ type: 'warning', message: checkInStatus.message, name: user.nama || user.nama_lengkap, photo: user.foto_url, role: userRole, rfid: tag }); return; }

        let existingAttendance = null;
        if (userRole === 'guru') {
             const { data } = await supabase.from('attendance').select('*').eq('user_id', user.id).eq('attendance_date', todayStr).eq('sesi', sesiUser).maybeSingle();
             existingAttendance = data;
        } else {
             const { data } = await supabase.from('attendance').select('*').eq('user_id', user.id).eq('attendance_date', todayStr).maybeSingle();
             existingAttendance = data;
        }

        const isAdult = kategori === 'Dewasa';
        const randomQuote = (userRole === 'guru' || isAdult) ? (isAdult ? adultQuotes[Math.floor(Math.random() * adultQuotes.length)] : guruQuotes[Math.floor(Math.random() * guruQuotes.length)]) : motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
        const successData = { type: 'success', role: userRole, kategori, name: user.nama || user.nama_lengkap, photo: user.foto_url, quote: randomQuote, points: user.points, jilid: user.jilid, jabatan: user.jabatan, no_hp: user.no_hp, rfid: tag, gender: user.jenis_kelamin, isPentashih };

        if (existingAttendance) {
          if (isPentashih) {
             const nowTime = new Date().toTimeString().split(' ')[0];
             const timestamp = new Date().toISOString();
             await supabase.from('attendance').update({ check_in_time: nowTime, check_in_timestamp: timestamp }).eq('id', existingAttendance.id);
             setLastScan({ ...successData, message: 'Absensi diperbarui!', time: nowTime });
             return;
          }
          setLastScan({ type: 'confirmation', role: userRole, kategori, message: 'Konfirmasi Kehadiran', name: user.nama || user.nama_lengkap, photo: user.foto_url, rfid: tag, attendanceId: existingAttendance.id, pendingQuote: randomQuote, points: user.points, jilid: user.jilid, gender: user.jenis_kelamin, jabatan: user.jabatan, no_hp: user.no_hp });
          return;
        }
        
        const timestamp = new Date().toISOString();
        let sessionStartTime = null;
        if (sessionTimes[sesiUser]) {
            sessionStartTime = new Date(`${todayStr}T${sessionTimes[sesiUser].start}:00`).toISOString();
        }
        const attendanceStatusText = determineAttendanceStatus(timestamp, sessionStartTime);

        const newAttendance = { 
            user_id: user.id, 
            role: userRole, 
            attendance_date: todayStr, 
            check_in_time: new Date().toTimeString().split(' ')[0], 
            check_in_timestamp: timestamp,
            class_id: userRole === 'santri' ? user.id_kelas : null, 
            sesi: sesiUser || (isPentashih ? 'Flex' : 'Pagi'), 
            status: attendanceStatusText
        };
        const { error: insertError } = await supabase.from('attendance').insert(newAttendance);

        if (userRole === 'guru' && !isPentashih) {
            await supabase.from('mmq_absensi').insert({
                guru_id: user.id,
                tanggal_absensi: todayStr,
                status: attendanceStatusText,
                check_in_timestamp: timestamp
            });
        }

        if (insertError) { setLastScan({ type: 'error', message: insertError.message, name: user.nama || user.nama_lengkap, photo: user.foto_url }); } 
        else {
          let newPoints = user.points || 0;
          if (userRole === 'santri' && !isAdult) { await supabase.rpc('increment_santri_points', { p_santri_id: user.id, p_amount: 1 }); newPoints += 1; }
          const levelInfo = (userRole === 'santri' && !isAdult) ? getLevelInfo(newPoints, user.jenis_kelamin) : null;
          let adultStats = null;
          if (isAdult) {
              const { count: daysCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
              adultStats = { daysStudied: daysCount || 1, timesStudied: daysCount || 1 };
          }
          let guruStats = null;
          if (userRole === 'guru' && !isPentashih) {
             const { count: totalMonthAttendance } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('attendance_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
             const hoursTaught = ((totalMonthAttendance || 1) * 1.25).toFixed(2);
             const { data: historyResult } = await supabase.from('attendance').select('attendance_date').eq('user_id', user.id).order('attendance_date', { ascending: false }).limit(30);
             const uniqueDates = [...new Set(historyResult?.map(h => h.attendance_date) || [])];
              let streak = 0;
              const checkDate = new Date(); checkDate.setDate(checkDate.getDate() - 1); 
              while (true) {
                  const dateStr = checkDate.toLocaleDateString('en-CA');
                  if (uniqueDates.includes(dateStr)) { streak++; checkDate.setDate(checkDate.getDate() - 1); } 
                  else { const day = checkDate.getDay(); if (day === 0 || day === 6) { checkDate.setDate(checkDate.getDate() - 1); continue; } break; }
              }
              streak++; 
              guruStats = { hours: hoursTaught, streak, session: sesiUser };
          }
          setLastScan({ ...successData, message: `Absensi ${isPentashih ? '' : `sesi ${sesiUser}`} berhasil!`, time: newAttendance.check_in_time, points: newPoints, levelInfo, adultStats, guruStats });
        }
      } finally { setIsLoading(false); setRfidTag(''); setTimeout(forceFocus, 50); }
  };

  const handleRfidSubmit = async e => { e.preventDefault(); processScan(rfidTag); };

  const ScanResult = ({ scan }) => {
     if (scan?.type === 'scanning') { return <div key="scanning" className="flex flex-col items-center justify-center h-full relative z-20"><div className="relative w-64 h-64 flex items-center justify-center"><div className="absolute inset-0 border-4 border-[#4CAF50]/30 rounded-full animate-ping" /><ScanLine className="w-32 h-32 text-[#4CAF50] animate-pulse" /></div><p className="text-[#4CAF50] text-xl mt-8 font-mono tracking-widest animate-pulse">PROCESSING DATA...</p></div>; }
     if (!scan) return <div className="flex flex-col items-center justify-center h-full opacity-50 relative z-20"><Fingerprint className="w-32 h-32 text-[#4CAF50]/30 mb-4 transition-colors duration-300" /><p className="text-[#4CAF50]/50 text-lg font-mono transition-colors duration-300">READY TO SCAN</p></div>;

     // MMQ Success View
     if (scan.type === 'mmq_success') {
        const isLate = scan.status === 'Terlambat';
        const colorClass = isLate ? 'border-amber-500' : 'border-green-500';
        const bgGradient = isLate ? 'from-amber-500/20 to-orange-500/20' : 'from-[#4CAF50]/20 to-emerald-500/20';
        return (
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`bg-gradient-to-br ${bgGradient} rounded-[2rem] shadow-2xl border-[3px] ${colorClass} p-8 max-w-lg mx-auto text-center relative overflow-hidden z-20 backdrop-blur-md`}>
                 <div className="absolute top-4 right-4"><Badge className="bg-white/90 text-primary border-none shadow-sm"><Library className="w-3 h-3 mr-1"/> MMQ Mode</Badge></div>
                 <div className="flex justify-center mb-6">
                    <Avatar className={`w-32 h-32 border-4 ${colorClass} shadow-md`}>
                        <AvatarImage src={scan.photo} className="object-cover" />
                        <AvatarFallback>{scan.name?.[0]}</AvatarFallback>
                    </Avatar>
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{scan.name}</h2>
                 <p className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-6">{scan.message}</p>
                 <div className="bg-white/80 dark:bg-black/40 p-4 rounded-xl mb-4 border border-white/20">
                     <p className="font-mono text-3xl font-bold text-slate-800 dark:text-white">{scan.time}</p>
                 </div>
                 <p className="italic text-sm text-slate-600 dark:text-slate-300">"{scan.quote}"</p>
             </motion.div>
        );
     }

     if (scan.type === 'confirmation') {
         return (
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-4 border-[#4CAF50] p-8 max-w-lg mx-auto text-center relative z-20">
                 {scan.isMMQ && <div className="absolute top-4 right-4"><Badge className="bg-[#4CAF50]/20 text-[#1B5E20] border-none"><Library className="w-3 h-3 mr-1"/> MMQ</Badge></div>}
                 <div className="flex justify-center mb-6"><Avatar className="w-32 h-32 border-4 border-[#e8f5e9] shadow-md"><AvatarImage src={scan.photo} className="object-cover" /><AvatarFallback>{scan.name?.[0]}</AvatarFallback></Avatar></div>
                 <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{scan.name}</h2>
                 <p className="text-slate-600 dark:text-slate-300 mb-6">Anda sudah absen hari ini.</p>
                 <div className="bg-[#e8f5e9] dark:bg-[#1B5E20]/20 p-4 rounded-xl border border-[#4CAF50]/30 mb-2"><p className="font-semibold text-[#1B5E20] dark:text-[#4CAF50] text-lg animate-pulse">Tap kartu sekali lagi untuk update jam pulang/masuk.</p></div>
                 <p className="text-xs text-muted-foreground mt-4">Atau biarkan untuk membatalkan.</p>
             </motion.div>
         );
     }

     if (scan.type === 'guru_schedule_detail') {
         return (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-[#1B5E20] p-6 w-full max-w-7xl mx-auto flex flex-col h-auto relative z-20">
                 <div className="flex justify-between items-center mb-4 border-b pb-2"><h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><Briefcase className="w-6 h-6 text-[#1B5E20]"/> Kelas Anda</h2></div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                     {scan.classesData && scan.classesData.length > 0 ? scan.classesData.map(cls => (
                         <div key={cls.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border shadow-sm">
                             <div className="flex justify-between items-center mb-2 border-b pb-1"><h3 className="font-bold text-base truncate text-[#1B5E20] dark:text-[#4CAF50]">{cls.nama_kelas}</h3><Badge variant="secondary" className="text-[10px]">{cls.sesi}</Badge></div>
                             <div className="text-xs space-y-1">{cls.santri && cls.santri.length > 0 ? (<div className="flex flex-wrap gap-1">{cls.santri.map(s => (<span key={s.id} className="bg-white dark:bg-slate-950 border px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">{s.nama_lengkap}</span>))}</div>) : <span className="text-muted-foreground italic">Kosong</span>}</div>
                         </div>
                     )) : <div className="col-span-full text-center py-10 text-muted-foreground">Tidak ada kelas yang diampu.</div>}
                 </div>
             </motion.div>
         );
     }

     if (scan.type === 'pentashih_history') {
         return (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-[#4CAF50] p-6 w-full max-w-6xl mx-auto h-auto flex flex-col relative z-20">
                 <div className="flex justify-between items-center mb-6 border-b pb-4"><h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><Activity className="w-6 h-6 text-[#4CAF50]"/> Riwayat Mutasi Terkini</h2></div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {scan.historyData.map((history, idx) => (
                         <div key={idx} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                             <div className="absolute top-0 left-0 w-1 h-full bg-[#4CAF50]"></div>
                             <div className="flex items-center gap-3 mb-3"><Avatar className="w-10 h-10 border-2 border-white shadow-sm"><AvatarImage src={history.santri?.foto_url} /><AvatarFallback>{history.santri?.nama_lengkap?.[0]}</AvatarFallback></Avatar><div className="overflow-hidden"><p className="font-bold text-sm truncate">{history.santri?.nama_lengkap}</p><p className="text-xs text-muted-foreground">{new Date(history.mutation_date).toLocaleDateString()}</p></div></div>
                             <div className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border"><div className="text-center w-1/2"><p className="text-red-500 font-bold">{history.from_jilid || '?'}</p><p className="text-[10px] text-muted-foreground truncate">{history.from_class?.nama_kelas || '-'}</p></div><ArrowRight className="w-4 h-4 text-slate-400" /><div className="text-center w-1/2"><p className="text-green-500 font-bold">{history.to_jilid || '?'}</p><p className="text-[10px] text-muted-foreground truncate">{history.to_class?.nama_kelas || '-'}</p></div></div>
                         </div>
                     ))}
                 </div>
             </motion.div>
         );
     }

     if (scan.type === 'error') {
         return (
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border-[3px] border-red-500 p-8 max-w-md mx-auto text-center relative overflow-hidden z-20">
                 <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
                 <div className="flex justify-center mb-4">
                     <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
                         <XCircle className="w-16 h-16 text-red-500" />
                     </div>
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{scan.name}</h2>
                 <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-xl border border-red-100 dark:border-red-900/30 mb-4">
                     <p className="text-red-600 dark:text-red-400 font-medium">{scan.message}</p>
                 </div>
                 <p className="text-sm text-slate-500">Silakan hubungi admin jika ini adalah kesalahan.</p>
             </motion.div>
         );
     }

     if (scan.type === 'guru_info' || (scan.type === 'success' && scan.role === 'guru')) {
         const isFemale = scan.gender === 'Perempuan';
         const gradientClass = isFemale ? 'from-[#D4AF37] to-yellow-500' : 'from-[#1B5E20] to-[#4CAF50]';
         const borderClass = isFemale ? 'border-yellow-100 dark:border-yellow-900/30' : 'border-[#e8f5e9] dark:border-[#1B5E20]/30';
         const isPentashih = scan.type === 'guru_info' ? ((scan.roles && scan.roles.includes('Pentashih')) || (scan.jabatan && scan.jabatan.toLowerCase().includes('pentashih'))) : scan.isPentashih;

         return (
             <motion.div key="guru_info" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-4xl border-2 ${borderClass} relative mx-auto flex flex-col md:flex-row h-auto z-20`}>
                 <div className={`absolute top-0 left-0 w-full h-full md:w-1/3 bg-gradient-to-b ${gradientClass}`}></div>
                 <div className="relative p-8 flex flex-col items-center text-center z-10 md:w-1/3 justify-center">
                     <div className="relative"><Avatar className="w-56 h-56 border-[8px] border-white shadow-2xl rounded-3xl bg-white aspect-square object-cover"><AvatarImage src={scan.photo} className="object-cover" /><AvatarFallback className="text-8xl font-bold text-slate-300">{scan.name?.[0]}</AvatarFallback></Avatar>{scan.type === 'success' && <div className="absolute -bottom-3 -right-3 bg-[#4CAF50] text-white p-3 rounded-full shadow-lg animate-bounce"><CheckCircle className="w-8 h-8" /></div>}</div>
                     <h2 className="text-3xl font-black mt-6 text-white leading-tight drop-shadow-md">{scan.name}</h2>
                     <p className="text-white/90 mt-2 uppercase tracking-wide text-sm font-bold bg-black/20 px-3 py-1 rounded-full">{scan.jabatan || 'Guru Pengajar'}</p>
                 </div>
                 <div className="p-8 flex-1 flex flex-col justify-center bg-white dark:bg-slate-900">
                     <div className="w-full space-y-6">
                         {scan.type === 'success' && isPentashih && (<div className="bg-[#e8f5e9] dark:bg-[#1B5E20]/30 p-6 rounded-2xl border border-[#4CAF50]/30 text-center space-y-4"><div className="inline-flex items-center gap-2 bg-[#4CAF50]/20 px-4 py-2 rounded-full text-[#1B5E20] dark:text-[#4CAF50] font-bold text-xl animate-pulse"><CheckCircle className="w-6 h-6"/> Absensi Berhasil</div><p className="text-4xl font-mono font-bold text-slate-800 dark:text-white">{scan.time}</p><div className="grid grid-cols-2 gap-4 text-left bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800"><div><p className="text-xs text-muted-foreground uppercase">Nama Lengkap</p><p className="font-bold text-slate-800 dark:text-white">{scan.name}</p></div><div><p className="text-xs text-muted-foreground uppercase">Jabatan</p><p className="font-bold text-[#D4AF37]">{scan.jabatan}</p></div></div></div>)}
                         {scan.type === 'success' && !isPentashih && (<><div className="bg-[#e8f5e9] dark:bg-[#1B5E20]/30 p-6 rounded-2xl border border-[#4CAF50]/30 text-center flex items-center justify-between"><div className="flex items-center gap-3"><div className="bg-[#4CAF50]/20 p-2 rounded-full"><CheckCircle className="w-8 h-8 text-[#4CAF50]"/></div><div className="text-left"><p className="text-[#1B5E20] dark:text-[#4CAF50] font-bold text-xl">Absensi Berhasil</p><p className="text-sm text-[#4CAF50]">Selamat Mengajar!</p></div></div><p className="text-3xl text-[#1B5E20] dark:text-[#4CAF50] font-mono font-bold">{scan.time}</p></div>{scan.guruStats && (<div className="grid grid-cols-3 gap-4 w-full"><div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center"><p className="text-2xl font-black text-slate-800 dark:text-white">{scan.guruStats.session}</p><p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Sesi</p></div><div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center"><p className="text-2xl font-black text-slate-800 dark:text-white">{scan.guruStats.hours}</p><p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Jam Total</p></div><div className="bg-[#D4AF37]/10 p-4 rounded-2xl border border-[#D4AF37]/30 text-center"><p className="text-2xl font-black text-[#D4AF37]">{scan.guruStats.streak}</p><p className="text-xs text-[#D4AF37] uppercase font-bold tracking-wider">Streak</p></div></div>)}</>)}
                         {scan.type === 'guru_info' && scan.stats && (<div className="grid grid-cols-3 gap-4 w-full"><div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center"><p className="text-3xl font-black text-slate-800 dark:text-white">{scan.stats.sessions}</p><p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Kelas</p></div><div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center"><p className="text-3xl font-black text-slate-800 dark:text-white">{scan.stats.hours}</p><p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Jam Total</p></div><div className="bg-[#D4AF37]/10 p-4 rounded-2xl border border-[#D4AF37]/30 text-center"><p className="text-3xl font-black text-[#D4AF37]">{scan.stats.streak}</p><p className="text-xs text-[#D4AF37] uppercase font-bold tracking-wider">Streak</p></div></div>)}
                         {scan.quote && (<div className="bg-[#D4AF37]/10 p-6 rounded-2xl border border-[#D4AF37]/30 relative overflow-hidden"><p className="text-lg italic text-[#1B5E20] dark:text-[#D4AF37] font-serif relative z-10 leading-relaxed text-center">"{scan.quote}"</p></div>)}
                     </div>
                 </div>
             </motion.div>
         );
     }

     if (scan.type === 'success' && scan.role === 'santri' && scan.kategori === 'Dewasa') {
         const isFemale = scan.gender === 'Perempuan';
         const borderClass = isFemale ? 'border-pink-500' : 'border-[#4CAF50]';
         const glowColor = isFemale ? 'shadow-pink-500/50' : 'shadow-[#4CAF50]/50';
         const bgGradient = isFemale ? 'from-pink-50 via-white to-pink-50 dark:from-pink-950/30 dark:via-slate-900 dark:to-pink-950/20' : 'from-[#e8f5e9] via-white to-[#e8f5e9] dark:from-[#1B5E20]/30 dark:via-slate-900 dark:to-[#1B5E20]/20';
         return (
             <motion.div key="success_adult" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`bg-gradient-to-br ${bgGradient} rounded-[2rem] shadow-2xl border-[3px] ${borderClass} p-8 w-full max-w-md mx-auto relative overflow-hidden z-20`}>
                 <div className="absolute top-4 right-4"><Badge variant="outline" className="bg-white/80 dark:bg-black/50 text-xs uppercase tracking-wider border-slate-200 dark:border-slate-700 backdrop-blur-sm">Santri Dewasa</Badge></div>
                 <div className="flex flex-col items-center text-center relative z-10"><div className="relative mb-6"><Avatar className={`w-48 h-48 rounded-full border-[6px] ${borderClass} shadow-2xl ${glowColor}`}><AvatarImage src={scan.photo} className="object-cover" /><AvatarFallback className="rounded-full text-6xl font-bold">{scan.name?.[0]}</AvatarFallback></Avatar><div className="absolute -bottom-2 -right-2 bg-[#4CAF50] text-white p-2 rounded-full shadow-lg border-4 border-white dark:border-slate-900"><CheckCircle className="w-6 h-6" /></div></div><h2 className="text-3xl font-black text-slate-800 dark:text-white leading-tight mb-1 drop-shadow-sm">{scan.name}</h2><p className="text-sm text-muted-foreground font-medium mb-6 uppercase tracking-widest">{scan.jilid}</p><div className="bg-white/70 dark:bg-black/30 rounded-2xl p-5 w-full mb-6 border border-slate-200 dark:border-slate-700 shadow-inner backdrop-blur-md"><div className="flex items-center justify-center gap-3 mb-2"><div className="h-3 w-3 rounded-full bg-[#4CAF50]"></div><span className="font-bold text-[#4CAF50] text-xl tracking-wide">ABSEN BERHASIL</span></div><p className="text-md text-slate-500 dark:text-slate-400 font-mono font-medium">{scan.time}</p></div>{scan.quote && <div className="w-full bg-[#D4AF37]/10 p-4 rounded-xl border border-[#D4AF37]/30 relative"><p className="text-sm italic text-[#1B5E20] dark:text-[#D4AF37] font-serif leading-relaxed">"{scan.quote}"</p></div>}</div>
             </motion.div>
         );
     }

     if (scan.type === 'success' && scan.role === 'santri') {
         const { label, color, badgeIcon, enableGradient, textColor, avatarBorderThickness, textGradient } = scan.levelInfo || { label: 'Level C', color: '#4CAF50', badgeIcon: <Book className="w-8 h-8"/>, enableGradient: false, textColor: '#333333', avatarBorderThickness: 4, textGradient: false };
         const textGradientClass = "bg-clip-text text-transparent bg-gradient-to-r from-[#D4AF37] to-yellow-500"; 
         return (
            <motion.div 
                key="success" 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative flex flex-col items-center p-10 rounded-[2.5rem] mx-auto w-fit max-w-4xl z-20 glass-card bg-gradient-to-br from-[#4CAF50]/10 to-[#1B5E20]/10"
                style={{ borderColor: `color-mix(in srgb, ${color} 40%, transparent)` }}
            >
                <div className="relative mb-8 mt-2">
                    <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="absolute -top-6 -right-6 glass-card p-4 rounded-2xl z-20 flex items-center justify-center border-t-white/40 border-l-white/40" style={{ borderColor: color }}>{badgeIcon}</motion.div>
                    
                    <Avatar className="w-64 h-64 rounded-[2.5rem] premium-shadow" style={{ borderWidth: `${avatarBorderThickness}px`, borderColor: color, borderStyle: 'solid', boxShadow: `0 0 30px color-mix(in srgb, ${color} 50%, transparent)` }}><AvatarImage src={scan.photo} className="object-cover" /><AvatarFallback className="rounded-[2.5rem] text-7xl font-bold text-slate-300">{scan.name?.[0]}</AvatarFallback></Avatar>
                    
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 glass-card px-8 py-2 rounded-full z-20 whitespace-nowrap min-w-[140px] text-center border-t-white/40 border-l-white/40" style={{ borderColor: color }}>
                      <span className={`text-sm font-black uppercase tracking-[0.2em] ${enableGradient ? 'gradient-text' : ''}`} style={{ color: enableGradient ? 'inherit' : color }}>{label}</span>
                    </div>
                </div>
                
                <div className="text-center space-y-4 mt-4 w-full">
                    <h2 className={`text-5xl font-black leading-tight px-4 drop-shadow-sm text-foreground ${textGradient ? textGradientClass : ''}`} style={{ color: textGradient ? undefined : textColor }}>{scan.name}</h2>
                    
                    <div className="flex items-center justify-center gap-3 opacity-90 mt-2">
                      <div className="flex items-center gap-2 px-5 py-2 rounded-full glass-card border-t-white/40 border-l-white/40">
                        <Clock className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        <span className="font-mono text-xl font-bold text-slate-700 dark:text-slate-200">{scan.time}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-center gap-4 mt-4">
                      {scan.jilid && 
                        <div className="glass-card px-6 py-3 rounded-2xl text-center border-t-white/40 border-l-white/40">
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">Jilid</p>
                          <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{scan.jilid}</p>
                        </div>
                      }
                      {scan.points !== undefined && 
                        <div className="glass-card px-6 py-3 rounded-2xl text-center border-t-white/40 border-l-white/40">
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">Poin</p>
                          <p className="text-2xl font-black text-yellow-600 dark:text-yellow-400">{scan.points}</p>
                        </div>
                      }
                    </div>
                    
                    <div className="pt-6 pb-2">
                      <p className="text-xl font-medium text-slate-700 dark:text-slate-200 opacity-90">{scan.message}</p>
                    </div>
                    
                    {scan.quote && (
                      <div className="mt-4 max-w-lg mx-auto p-5 glass-card rounded-2xl border-t-white/40 border-l-white/40 text-center">
                        <div className="mb-3 animate-shine font-bold uppercase text-sm tracking-widest flex items-center justify-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500"/>
                          Pesan Untukmu
                          <Star className="w-4 h-4 text-yellow-500"/>
                        </div>
                        <p className="italic font-serif text-lg text-slate-700 dark:text-slate-300 opacity-90">"{scan.quote}"</p>
                      </div>
                    )}
                </div>
                
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: 'spring' }} className="absolute top-6 left-6">
                  <div className="bg-[#4CAF50] text-white p-3 rounded-full premium-shadow border-2 border-white/20">
                    <CheckCircle className="w-7 h-7" />
                  </div>
                </motion.div>
            </motion.div>
         );
     }
     return null;
  };

  return <>
        <Helmet><title>Absensi Digital - LPQ Al-Muhajirun</title></Helmet>
        <div className="min-h-screen relative overflow-hidden flex flex-col transition-colors duration-300 bg-white dark:bg-slate-950">
            <div className="absolute inset-0 z-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#f8fafc] via-[#e8f5e9] to-[#c8e6c9] dark:from-slate-950 dark:via-[#0a1f10] dark:to-[#1B5E20]/20 transition-colors duration-500" />
                <motion.div animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }} className={`absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full blur-[100px] transition-colors duration-500 ${isDark ? 'bg-green-800/20' : 'bg-green-200/40'}`} />
                <motion.div animate={{ x: [0, -100, 0], y: [0, 100, 0], scale: [1, 1.5, 1] }} transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }} className={`absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[120px] transition-colors duration-500 ${isDark ? 'bg-emerald-800/20' : 'bg-emerald-200/40'}`} />
                <div className={`absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 mix-blend-overlay ${!isDark && 'invert opacity-10'}`}></div>
                {[...Array(20)].map((_, i) => <Particle key={i} delay={i * 0.5} isDark={isDark} />)}
            </div>
            <div className="relative z-10 p-6 flex justify-between items-center">
                <Button variant="ghost" className="text-slate-600 dark:text-[#4CAF50] hover:text-slate-900 dark:hover:text-emerald-300 hover:bg-slate-200 dark:hover:bg-green-900/30 gap-2 transition-colors duration-300" onClick={() => navigate('/dashboard')}><ArrowLeft className="w-5 h-5" /> Kembali ke Dashboard</Button>
                <div className="flex items-center gap-4">
                    {enableDeferredFeatures && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => navigate('/top-score')} className="rounded-full hover:bg-slate-200 dark:hover:bg-green-900/30 transition-colors duration-300 text-yellow-600 dark:text-yellow-400 animate-pulse" title="Top Score"><Trophy className="w-5 h-5"/></Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate('/random-name')} className="rounded-full hover:bg-slate-200 dark:hover:bg-green-900/30 transition-colors duration-300 text-slate-600 dark:text-[#4CAF50]" title="Acak Nama"><Dices className="w-5 h-5"/></Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate('/gatcha-game')} className="rounded-full hover:bg-slate-200 dark:hover:bg-green-900/30 transition-colors duration-300 text-slate-600 dark:text-[#4CAF50]" title="Gatcha Game"><Gamepad2 className="w-5 h-5"/></Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate('/quiz-hafalan')} className="rounded-full hover:bg-slate-200 dark:hover:bg-green-900/30 transition-colors duration-300 text-slate-600 dark:text-[#4CAF50]" title="Quiz Mode"><Gamepad2 className="w-5 h-5"/></Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => navigate('/tv-display-mode')} className="rounded-full hover:bg-slate-200 dark:hover:bg-green-900/30 transition-colors duration-300 text-slate-600 dark:text-[#4CAF50]" title="TV Display Mode"><Tv className="w-5 h-5"/></Button>
                    <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full hover:bg-slate-200 dark:hover:bg-green-900/30 transition-colors duration-300">{isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}</Button>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-[#1B5E20]/30 border border-slate-200 dark:border-[#4CAF50]/30 transition-colors duration-300"><Activity className="w-4 h-4 text-green-500 dark:text-green-400 animate-pulse" /><span className="text-xs text-slate-600 dark:text-[#4CAF50] font-mono">SYSTEM ONLINE</span></div>
                </div>
            </div>
            <div className="relative z-10 flex-grow flex flex-col items-center justify-center p-4 md:p-8 gap-8">
                <DigitalClock />
                <div className="w-full flex items-center justify-center">{lastScan ? <ScanResult scan={lastScan} /> : <ScanResult scan={null} />}</div>
                <div className="w-full max-w-md relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-[#1B5E20] to-[#4CAF50] dark:from-[#4CAF50] dark:to-[#D4AF37] rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <form onSubmit={handleRfidSubmit} className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#4CAF50] transition-colors duration-300"><Search className="w-5 h-5" /></div>
                        <Input ref={inputRef} type="text" placeholder="Menunggu Scan Kartu..." value={rfidTag} onChange={e => setRfidTag(e.target.value)} className="w-full bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-[#4CAF50]/30 text-slate-900 dark:text-emerald-100 placeholder:text-slate-400 dark:placeholder:text-[#4CAF50]/50 pl-12 h-14 rounded-lg focus:ring-2 focus:ring-[#4CAF50] dark:focus:ring-[#4CAF50] focus:border-transparent font-mono text-lg tracking-wider shadow-xl transition-all duration-300" disabled={isLoading} autoFocus autoComplete="off" />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">{isLoading && <div className="w-5 h-5 border-2 border-[#4CAF50] dark:border-[#4CAF50] border-t-transparent rounded-full animate-spin"></div>}</div>
                    </form>
                    <p className="text-center text-slate-400 dark:text-[#4CAF50]/50 text-xs mt-3 font-mono transition-colors duration-300">SILAHKAN TAP KARTU UNTUK SCAN ABSEN</p>
                </div>
                {enableDeferredFeatures && <MediaPlayerWidget />}
            </div>
            <div className="relative z-10 p-6 text-center"><p className="text-slate-400 dark:text-slate-600 text-sm font-mono transition-colors duration-300">LPQ AL-MUHAJIRUN • DIGITAL ATTENDANCE SYSTEM v4.0 (Premium)</p></div>
        </div>
  </>;
};
export default DigitalAttendancePage;
