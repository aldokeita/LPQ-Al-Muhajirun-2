import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { buildJakartaTimestamp, formatTimestamp, determineAttendanceStatus, calculateTimeDifference } from '@/utils/AttendanceStatusLogic';
import AttendanceStatusIcon from './AttendanceStatusIcon';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Calendar, CheckCircle } from 'lucide-react';

const AttendanceDetailsModal = ({ isOpen, onClose, details, onSuccess }) => {
  const { role } = useAuth();
  const { toast } = useToast();
  const [timeInput, setTimeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin and Guru can edit Waktu Hadir. Santri is strictly read-only.
  const isAuthorized = role === 'guru' || role === 'admin';

  useEffect(() => {
    if (details) {
      if (details.status !== 'Tidak Hadir' && details.checkInTimestamp) {
        const d = new Date(details.checkInTimestamp);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        setTimeInput(`${hh}:${mm}:${ss}`);
      } else if (details.status === 'Tidak Hadir') {
        if (details.sessionStartTime) {
          const d = new Date(details.sessionStartTime);
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          const ss = String(d.getSeconds()).padStart(2, '0');
          setTimeInput(`${hh}:${mm}:${ss}`);
        } else {
          const now = new Date();
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');
          const ss = String(now.getSeconds()).padStart(2, '0');
          setTimeInput(`${hh}:${mm}:${ss}`);
        }
      }
    }
  }, [details]);

  const handleConfirmAttendance = async () => {
    if (!isAuthorized) return; // Failsafe
    
    if (!timeInput) {
      toast({ title: 'Error', description: 'Waktu hadir harus diisi', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const attendanceDate = details.attendance_date || new Date().toLocaleDateString('en-CA');
      const checkInTimestamp = new Date(buildJakartaTimestamp(attendanceDate, timeInput)).toISOString();
      const newStatus = determineAttendanceStatus(checkInTimestamp, details.sessionStartTime);

      if (details.id && details.status !== 'Tidak Hadir') {
        // UPDATE existing record
        const { error } = await supabase.from('attendance').update({
          check_in_time: timeInput,
          check_in_timestamp: checkInTimestamp,
          status: newStatus
        }).eq('id', details.id);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Waktu kehadiran berhasil diperbarui",
        });
      } else {
        // INSERT new record (Confirm "Tidak Hadir")
        const newAttendance = {
          user_id: details.user_id,
          role: details.user_role || 'santri',
          attendance_date: attendanceDate,
          check_in_time: timeInput,
          check_in_timestamp: checkInTimestamp,
          class_id: details.class_id,
          sesi: details.sesi,
          status: newStatus
        };

        const { error } = await supabase.from('attendance').insert(newAttendance);
        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Kehadiran berhasil dikonfirmasi",
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal memperbarui waktu kehadiran",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!details) return null;

  const statusLabel = details.status === 'Hadir' ? 'Tepat Waktu' : details.status;

  // Calculate late minutes dynamically for the view
  const computedLateMinutes = details.checkInTimestamp && details.sessionStartTime
    ? calculateTimeDifference(details.checkInTimestamp, details.sessionStartTime)
    : (details.lateMinutes || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-transparent border-none shadow-none">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 relative w-full overflow-hidden"
            >
              <DialogHeader className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                  <AttendanceStatusIcon status={details.status} className="w-8 h-8 pointer-events-none" />
                  Detail Kehadiran
                </DialogTitle>
              </DialogHeader>

              <div className="p-6 space-y-5">
                {/* --- STATE 1 & 2: Hadir / Terlambat --- */}
                {details.status !== 'Tidak Hadir' && (
                  <>
                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Status</p>
                        <p className="font-semibold text-lg text-slate-800 dark:text-slate-200">{statusLabel}</p>
                      </div>
                      <AttendanceStatusIcon status={details.status} className="w-12 h-12 pointer-events-none" />
                    </div>

                    <div className="grid gap-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Waktu Absensi Saat Ini</p>
                          <p className="font-mono font-medium text-slate-700 dark:text-slate-300">
                            {details.checkInTimestamp ? formatTimestamp(details.checkInTimestamp) : '-'}
                          </p>
                        </div>
                      </div>

                      {details.sessionStartTime && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700">
                          <Calendar className="w-5 h-5 text-blue-500" />
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Waktu Sesi</p>
                            <p className="font-mono font-medium text-slate-700 dark:text-slate-300">
                              {formatTimestamp(details.sessionStartTime)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {details.status === 'Terlambat' && computedLateMinutes > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-center gap-3">
                        <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
                        <p className="font-semibold">Terlambat: {computedLateMinutes} menit</p>
                      </div>
                    )}

                    {isAuthorized && (
                        <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                           <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Edit Waktu Hadir</label>
                              <Input 
                                type="time" 
                                step="1" 
                                value={timeInput} 
                                onChange={(e) => setTimeInput(e.target.value)} 
                                className="font-mono text-lg text-center"
                              />
                           </div>
                           <div className="flex gap-3">
                              <Button 
                                variant="outline" 
                                className="w-1/2" 
                                onClick={onClose}
                                disabled={isSubmitting}
                              >
                                Batal
                              </Button>
                              <Button 
                                className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white" 
                                onClick={handleConfirmAttendance}
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                              </Button>
                           </div>
                        </div>
                     )}
                     
                     {!isAuthorized && (
                        <Button variant="outline" className="w-full mt-4" onClick={onClose}>
                          Tutup
                        </Button>
                     )}
                  </>
                )}

                {/* --- STATE 3: Tidak Hadir --- */}
                {details.status === 'Tidak Hadir' && (
                  <div className="space-y-4">
                     <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-center">
                        <p className="font-semibold mb-1">Status: Tidak Hadir</p>
                        <p className="text-sm">Santri belum melakukan absensi pada tanggal ini.</p>
                     </div>

                     <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                         <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                             <Calendar className="w-4 h-4" />
                             <span className="text-sm font-medium">{details.attendance_date}</span>
                         </div>
                         {details.sessionStartTime && (
                             <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                 <Clock className="w-4 h-4" />
                                 <span className="text-sm font-medium">{new Date(details.sessionStartTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                             </div>
                         )}
                     </div>

                     {isAuthorized && (
                        <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Waktu Hadir Manual</label>
                              <Input 
                                type="time" 
                                step="1" 
                                value={timeInput} 
                                onChange={(e) => setTimeInput(e.target.value)} 
                                className="font-mono text-lg text-center"
                              />
                            </div>
                            <div className="flex gap-3">
                              <Button 
                                variant="outline" 
                                className="w-1/2" 
                                onClick={onClose}
                                disabled={isSubmitting}
                              >
                                Batal
                              </Button>
                              <Button 
                                className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white" 
                                onClick={handleConfirmAttendance}
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? 'Menyimpan...' : 'Konfirmasi Kehadiran'}
                              </Button>
                            </div>
                        </div>
                     )}

                     {!isAuthorized && (
                        <Button variant="outline" className="w-full mt-4" onClick={onClose}>
                          Tutup
                        </Button>
                     )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceDetailsModal;
