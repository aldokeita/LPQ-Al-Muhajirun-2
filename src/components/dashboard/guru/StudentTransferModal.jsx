import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  School,
  User,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import {
  fetchGuruTransferClassOptions,
  getClassTransferErrorMessage,
  transferSantriByGuru,
} from '@/lib/classTransferAdapters';
import { cn } from '@/lib/utils';

const sessionOrder = ['Pagi', 'Pagi 2', 'Siang', 'Sore', 'Malam'];

const classSort = (a, b) => {
  const aIndex = sessionOrder.indexOf(a.sesi);
  const bIndex = sessionOrder.indexOf(b.sesi);
  const safeA = aIndex === -1 ? sessionOrder.length : aIndex;
  const safeB = bIndex === -1 ? sessionOrder.length : bIndex;
  return safeA - safeB || String(a.nama_kelas || '').localeCompare(String(b.nama_kelas || ''), 'id');
};

const StudentTransferModal = ({ isOpen, onClose, santri, onTransferSuccess }) => {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isConfirmation, setIsConfirmation] = useState(false);

  const loadClasses = useCallback(async () => {
    if (!santri?.id) return;
    setStatus('loading');
    setErrorMessage('');
    try {
      const result = await fetchGuruTransferClassOptions(santri.id);
      setClasses(result.sort(classSort));
      setStatus('ready');
    } catch (error) {
      setClasses([]);
      setErrorMessage(getClassTransferErrorMessage(error));
      setStatus('error');
    }
  }, [santri?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedClassId('');
    setReason('');
    setIsConfirmation(false);
    loadClasses();
  }, [isOpen, loadClasses]);

  const currentClass = useMemo(
    () => classes.find((item) => item.is_current) || santri?.class || null,
    [classes, santri?.class],
  );
  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId],
  );
  const selectableClasses = useMemo(
    () => classes.filter((item) => item.is_selectable),
    [classes],
  );

  const closeModal = () => {
    if (status === 'submitting') return;
    onClose();
  };

  const submitTransfer = async () => {
    if (!selectedClass || !santri?.id) return;
    setStatus('submitting');
    setErrorMessage('');
    try {
      const result = await transferSantriByGuru({
        santriId: santri.id,
        targetClassId: selectedClass.id,
        reason: reason || `Transfer dari ${currentClass?.nama_kelas || 'kelas asal'} ke ${selectedClass.nama_kelas}`,
      });
      toast({
        title: 'Transfer kelas berhasil',
        description: `${santri.nama_lengkap} sekarang berada di ${selectedClass.nama_kelas}.`,
      });
      onClose();
      try {
        await onTransferSuccess?.(result);
      } catch {
        toast({
          title: 'Daftar kelas perlu dimuat ulang',
          description: 'Transfer sudah tersimpan. Muat ulang halaman bila daftar belum berubah.',
        });
      }
    } catch (error) {
      const friendlyMessage = getClassTransferErrorMessage(error);
      setErrorMessage(friendlyMessage);
      setStatus('error');
      toast({ title: 'Transfer kelas gagal', description: friendlyMessage, variant: 'destructive' });
    }
  };

  if (!santri) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col overflow-hidden border-white/70 bg-background/95 p-0 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95">
        <DialogHeader className="border-b border-border/70 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 px-5 py-5 text-left dark:from-emerald-950/35 dark:via-slate-950 dark:to-cyan-950/25 sm:px-7">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white/80 text-emerald-700 shadow-sm dark:border-emerald-400/20 dark:bg-white/5 dark:text-emerald-300">
              <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-black tracking-tight sm:text-2xl">
                {isConfirmation ? 'Konfirmasi transfer kelas' : 'Transfer kelas santri'}
              </DialogTitle>
              <DialogDescription className="mt-1 leading-relaxed">
                {isConfirmation
                  ? 'Periksa perpindahan sebelum menyimpan. Riwayat mutasi akan dicatat otomatis.'
                  : 'Pilih kelas aktif dengan kategori yang sama. Kelas asal tidak dapat dipilih kembali.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="border-b border-border/60 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 shrink-0 border-2 border-white shadow-md dark:border-slate-800">
              <AvatarImage src={santri.foto_url} className="object-cover" />
              <AvatarFallback className="bg-emerald-100 font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                {santri.nama_lengkap?.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black text-foreground sm:text-lg">{santri.nama_lengkap}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
                <span>{santri.jilid || 'Jilid belum diatur'}</span>
                <span className="inline-flex items-center gap-1"><School className="h-3.5 w-3.5" />{currentClass?.nama_kelas || 'Kelas asal tidak ditemukan'}</span>
                <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />Sesi {santri.sesi_mengaji || currentClass?.sesi || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {isConfirmation ? (
          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
            <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-400/20 dark:bg-rose-950/20">
                <p className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-300">Kelas asal</p>
                <p className="mt-2 font-black">{currentClass?.nama_kelas || '-'}</p>
                <p className="mt-1 text-xs text-muted-foreground">Sesi {currentClass?.sesi || santri.sesi_mengaji || '-'}</p>
              </div>
              <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-muted-foreground sm:rotate-0" aria-hidden="true" />
              <div className="rounded-lg border border-emerald-300 bg-emerald-50/80 p-4 dark:border-emerald-400/25 dark:bg-emerald-950/25">
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Kelas tujuan</p>
                <p className="mt-2 font-black">{selectedClass?.nama_kelas}</p>
                <p className="mt-1 text-xs text-muted-foreground">Sesi {selectedClass?.sesi || '-'} · {selectedClass?.guru_name || 'Guru belum ditentukan'}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <label htmlFor="class-transfer-reason" className="text-sm font-bold">Alasan transfer <span className="font-normal text-muted-foreground">(opsional)</span></label>
              <Textarea
                id="class-transfer-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value.slice(0, 500))}
                placeholder="Contoh: Penyesuaian jadwal belajar"
                className="min-h-[88px] resize-none"
                disabled={status === 'submitting'}
              />
              <p className="text-right text-xs text-muted-foreground">{reason.length}/500</p>
            </div>

            {errorMessage && (
              <div role="alert" className="mt-4 flex gap-3 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-5 py-5 sm:px-7">
              {status === 'loading' && (
                <div role="status" className="flex min-h-52 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <p>Memuat pilihan kelas aktif...</p>
                </div>
              )}

              {status === 'error' && (
                <div role="alert" className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <div><p className="font-bold">Pilihan kelas belum dapat dimuat</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{errorMessage}</p></div>
                  <Button type="button" variant="outline" onClick={loadClasses}><RefreshCw className="mr-2 h-4 w-4" />Coba lagi</Button>
                </div>
              )}

              {status === 'ready' && selectableClasses.length === 0 && (
                <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-6 text-center">
                  <School className="h-9 w-9 text-muted-foreground" />
                  <div><p className="font-bold">Belum ada kelas tujuan</p><p className="mt-1 text-sm text-muted-foreground">Tidak ditemukan kelas aktif lain dengan kategori yang sama.</p></div>
                </div>
              )}

              {status === 'ready' && classes.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {classes.map((kelas) => {
                    const isSelected = selectedClassId === kelas.id;
                    const isDisabled = !kelas.is_selectable;
                    return (
                      <button
                        key={kelas.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setSelectedClassId(kelas.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          'min-h-[112px] rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                          isDisabled && 'cursor-not-allowed border-border bg-muted/60 opacity-60',
                          !isDisabled && !isSelected && 'border-border bg-card hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:hover:border-emerald-400/40',
                          isSelected && 'border-emerald-500 bg-emerald-50 shadow-md ring-1 ring-emerald-500 dark:bg-emerald-950/25',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0"><p className="truncate font-black">{kelas.nama_kelas}</p><Badge variant="outline" className="mt-2">Sesi {kelas.sesi || '-'}</Badge></div>
                          {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />}
                          {isDisabled && <Badge variant="secondary" className="shrink-0">Kelas asal</Badge>}
                        </div>
                        <p className="mt-3 flex items-center gap-1.5 truncate text-xs text-muted-foreground"><User className="h-3.5 w-3.5" />{kelas.guru_name || 'Guru belum ditentukan'}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="border-t border-border/70 bg-muted/30 px-5 py-4 sm:px-7">
          {isConfirmation ? (
            <>
              <Button type="button" variant="outline" onClick={() => { setIsConfirmation(false); setStatus('ready'); setErrorMessage(''); }} disabled={status === 'submitting'}>Kembali</Button>
              <Button type="button" onClick={submitTransfer} disabled={status === 'submitting'} className="min-w-[150px] bg-emerald-700 text-white hover:bg-emerald-800">
                {status === 'submitting' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memindahkan...</> : <><ArrowRightLeft className="mr-2 h-4 w-4" />Konfirmasi transfer</>}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={closeModal}>Batal</Button>
              <Button type="button" onClick={() => setIsConfirmation(true)} disabled={!selectedClassId || status !== 'ready'} className="min-w-[140px] bg-emerald-700 text-white hover:bg-emerald-800">
                Lanjutkan <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudentTransferModal;
